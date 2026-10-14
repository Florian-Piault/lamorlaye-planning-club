//! Chiffrement des sauvegardes exportées par mot de passe (SPECS.md §11.6).
//!
//! Format de fichier (version 1), toutes les valeurs entières en petit-boutiste :
//!
//! | Octets | Contenu                                              |
//! |--------|------------------------------------------------------|
//! | 8      | signature `PCLUBENC`                                 |
//! | 1      | version du format (`1`)                              |
//! | 4 × 3  | paramètres Argon2id : mémoire (Kio), passes, voies   |
//! | 16     | sel aléatoire                                        |
//! | 12     | nonce aléatoire                                      |
//! | reste  | base SQLite chiffrée par AES-256-GCM, suivie du tag  |
//!
//! La clé de 256 bits est dérivée du mot de passe par Argon2id ; l'en-tête
//! entier est authentifié (données associées), si bien qu'une altération des
//! paramètres comme du contenu est détectée. Un mauvais mot de passe et un
//! fichier altéré sont indiscernables : l'erreur le dit.
//!
//! La signature permet de reconnaître un fichier chiffré : une sauvegarde non
//! chiffrée commence par l'en-tête SQLite (`SQLite format 3`).

use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::aead::{Aead, OsRng, Payload};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use zeroize::Zeroizing;

/// Signature d'un fichier de sauvegarde chiffré.
pub const MAGIC: &[u8; 8] = b"PCLUBENC";
/// Version actuelle du format.
pub const FORMAT_VERSION: u8 = 1;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const HEADER_LEN: usize = MAGIC.len() + 1 + 12 + SALT_LEN + NONCE_LEN;

/// Limites des paramètres lus dans un fichier, pour qu'un fichier forgé ne
/// puisse pas réclamer une mémoire ou un temps de calcul déraisonnables.
const MAX_MEMORY_KIB: u32 = 1024 * 1024;
const MAX_ITERATIONS: u32 = 64;
const MAX_LANES: u32 = 16;

/// Paramètres de dérivation de la clé (Argon2id).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KdfParams {
    /// Mémoire, en Kio.
    pub memory_kib: u32,
    /// Nombre de passes.
    pub iterations: u32,
    /// Degré de parallélisme.
    pub lanes: u32,
}

/// Paramètres recommandés par l'OWASP pour Argon2id (19 Mio, 2 passes).
pub const DEFAULT_KDF: KdfParams = KdfParams {
    memory_kib: 19 * 1024,
    iterations: 2,
    lanes: 1,
};

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CryptoError {
    #[error("Le mot de passe ne peut pas être vide.")]
    EmptyPassword,
    #[error("Mot de passe incorrect, ou fichier de sauvegarde altéré.")]
    WrongPassword,
    #[error("Le fichier chiffré est incomplet ou illisible.")]
    Malformed,
    #[error(
        "Ce fichier chiffré utilise un format (version {0}) inconnu de cette version de Planning Club."
    )]
    UnsupportedVersion(u8),
    #[error("Le chiffrement de la sauvegarde a échoué.")]
    Encryption,
}

pub type CryptoResult<T> = Result<T, CryptoError>;

/// Le contenu est-il une sauvegarde chiffrée (signature en tête) ?
pub fn is_encrypted(bytes: &[u8]) -> bool {
    bytes.starts_with(MAGIC)
}

fn derive_key(
    password: &str,
    salt: &[u8],
    params: KdfParams,
) -> CryptoResult<Zeroizing<[u8; KEY_LEN]>> {
    let params = Params::new(
        params.memory_kib,
        params.iterations,
        params.lanes,
        Some(KEY_LEN),
    )
    .map_err(|_| CryptoError::Malformed)?;
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|_| CryptoError::Malformed)?;
    Ok(key)
}

fn header(params: KdfParams, salt: &[u8; SALT_LEN], nonce: &[u8; NONCE_LEN]) -> Vec<u8> {
    let mut header = Vec::with_capacity(HEADER_LEN);
    header.extend_from_slice(MAGIC);
    header.push(FORMAT_VERSION);
    header.extend_from_slice(&params.memory_kib.to_le_bytes());
    header.extend_from_slice(&params.iterations.to_le_bytes());
    header.extend_from_slice(&params.lanes.to_le_bytes());
    header.extend_from_slice(salt);
    header.extend_from_slice(nonce);
    header
}

/// Chiffre `plain` avec des paramètres, un sel et un nonce donnés.
pub fn encrypt_with(
    plain: &[u8],
    password: &str,
    params: KdfParams,
    salt: [u8; SALT_LEN],
    nonce: [u8; NONCE_LEN],
) -> CryptoResult<Vec<u8>> {
    if password.is_empty() {
        return Err(CryptoError::EmptyPassword);
    }
    let key = derive_key(password, &salt, params)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key.as_ref()));
    let mut output = header(params, &salt, &nonce);
    let encrypted = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: plain,
                aad: &output,
            },
        )
        .map_err(|_| CryptoError::Encryption)?;
    output.extend_from_slice(&encrypted);
    Ok(output)
}

/// Chiffre `plain` avec un sel et un nonce aléatoires.
pub fn encrypt(plain: &[u8], password: &str, params: KdfParams) -> CryptoResult<Vec<u8>> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    encrypt_with(plain, password, params, salt, nonce)
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    let mut value = [0u8; 4];
    value.copy_from_slice(&bytes[offset..offset + 4]);
    u32::from_le_bytes(value)
}

/// Déchiffre une sauvegarde chiffrée.
pub fn decrypt(data: &[u8], password: &str) -> CryptoResult<Vec<u8>> {
    if !is_encrypted(data) {
        return Err(CryptoError::Malformed);
    }
    let version = *data.get(MAGIC.len()).ok_or(CryptoError::Malformed)?;
    if version != FORMAT_VERSION {
        return Err(CryptoError::UnsupportedVersion(version));
    }
    // En-tête complet, puis au moins le tag d'authentification (16 octets).
    if data.len() < HEADER_LEN + 16 {
        return Err(CryptoError::Malformed);
    }
    if password.is_empty() {
        return Err(CryptoError::EmptyPassword);
    }
    let params_at = MAGIC.len() + 1;
    let params = KdfParams {
        memory_kib: read_u32(data, params_at),
        iterations: read_u32(data, params_at + 4),
        lanes: read_u32(data, params_at + 8),
    };
    if params.memory_kib > MAX_MEMORY_KIB
        || params.iterations > MAX_ITERATIONS
        || params.lanes > MAX_LANES
    {
        return Err(CryptoError::Malformed);
    }
    let salt_at = params_at + 12;
    let nonce_at = salt_at + SALT_LEN;
    let (header, encrypted) = data.split_at(HEADER_LEN);
    let key = derive_key(password, &data[salt_at..nonce_at], params)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key.as_ref()));
    cipher
        .decrypt(
            Nonce::from_slice(&data[nonce_at..HEADER_LEN]),
            Payload {
                msg: encrypted,
                aad: header,
            },
        )
        .map_err(|_| CryptoError::WrongPassword)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Paramètres réduits : les tests restent rapides en mode debug.
    const FAST: KdfParams = KdfParams {
        memory_kib: 64,
        iterations: 1,
        lanes: 1,
    };

    #[test]
    fn chiffre_puis_dechiffre() {
        let plain = b"SQLite format 3\0 contenu de la base";
        let encrypted = encrypt(plain, "mot de passe é", FAST).unwrap();
        assert!(is_encrypted(&encrypted));
        assert_eq!(encrypted[MAGIC.len()], FORMAT_VERSION);
        assert!(!encrypted.windows(plain.len()).any(|w| w == plain));
        assert_eq!(decrypt(&encrypted, "mot de passe é").unwrap(), plain);
    }

    #[test]
    fn deux_chiffrements_different() {
        let a = encrypt(b"x", "secret", FAST).unwrap();
        let b = encrypt(b"x", "secret", FAST).unwrap();
        assert_ne!(a, b, "sel et nonce aléatoires");
    }

    #[test]
    fn utilise_les_parametres_par_defaut() {
        let encrypted = encrypt(b"base", "secret", DEFAULT_KDF).unwrap();
        assert_eq!(decrypt(&encrypted, "secret").unwrap(), b"base");
    }

    #[test]
    fn refuse_un_mauvais_mot_de_passe() {
        let encrypted = encrypt(b"base", "bon", FAST).unwrap();
        assert_eq!(
            decrypt(&encrypted, "mauvais"),
            Err(CryptoError::WrongPassword)
        );
        assert_eq!(decrypt(&encrypted, ""), Err(CryptoError::EmptyPassword));
    }

    #[test]
    fn detecte_une_alteration() {
        let encrypted = encrypt(b"contenu", "secret", FAST).unwrap();
        // Contenu modifié.
        let mut tampered = encrypted.clone();
        let last = tampered.len() - 1;
        tampered[last] ^= 1;
        assert_eq!(
            decrypt(&tampered, "secret"),
            Err(CryptoError::WrongPassword)
        );
        // Paramètres modifiés (en-tête authentifié).
        let mut tampered = encrypted.clone();
        tampered[MAGIC.len() + 5] ^= 1; // nombre de passes : 1 → 0, refusé par Argon2
        assert!(decrypt(&tampered, "secret").is_err());
        // Fichier tronqué.
        assert_eq!(
            decrypt(&encrypted[..HEADER_LEN + 4], "secret"),
            Err(CryptoError::Malformed)
        );
    }

    #[test]
    fn refuse_une_version_inconnue_et_les_fichiers_non_chiffres() {
        let mut encrypted = encrypt(b"contenu", "secret", FAST).unwrap();
        encrypted[MAGIC.len()] = 2;
        assert_eq!(
            decrypt(&encrypted, "secret"),
            Err(CryptoError::UnsupportedVersion(2))
        );
        assert!(!is_encrypted(b"SQLite format 3\0"));
        assert_eq!(
            decrypt(b"SQLite format 3\0", "secret"),
            Err(CryptoError::Malformed)
        );
    }

    #[test]
    fn refuse_des_parametres_deraisonnables() {
        let mut forged = encrypt_with(b"x", "secret", FAST, [7; SALT_LEN], [9; NONCE_LEN]).unwrap();
        let at = MAGIC.len() + 1;
        forged[at..at + 4].copy_from_slice(&(MAX_MEMORY_KIB + 1).to_le_bytes());
        // Refusé avant toute dérivation de clé (aucune allocation de 1 Gio).
        assert_eq!(decrypt(&forged, "secret"), Err(CryptoError::Malformed));
    }

    #[test]
    fn refuse_un_mot_de_passe_vide_au_chiffrement() {
        assert_eq!(encrypt(b"x", "", FAST), Err(CryptoError::EmptyPassword));
    }
}
