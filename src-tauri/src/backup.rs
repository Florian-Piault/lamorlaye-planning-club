//! Sauvegardes de la base (SPECS.md §11.3, §12.2).
//!
//! - copie automatique horodatée à chaque fermeture de l'application, par
//!   `VACUUM INTO` (copie cohérente même si la base est ouverte), avec
//!   conservation des 30 dernières ;
//! - export manuel vers un fichier choisi par l'utilisateur, éventuellement
//!   chiffré par un mot de passe (§11.6, voir `crypto.rs`) ;
//! - restauration d'un fichier exporté (chiffré ou non), après une sauvegarde
//!   de l'état courant.
//!
//! Les copies passent par une connexion SQLite dédiée, indépendante du pool de
//! `tauri-plugin-sql` : elles fonctionnent donc aussi pendant la fermeture,
//! quand l'interface n'est plus là.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection, Row, SqliteConnection};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::crypto::{self, CryptoError, KdfParams};
use crate::db::DatabaseLocation;

/// Nombre de sauvegardes conservées dans le dossier des sauvegardes.
pub const BACKUPS_KEPT: usize = 30;

const PREFIX: &str = "planning-";
const EXTENSION: &str = ".db";
const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";

/// Dossier des sauvegardes automatiques.
pub struct BackupDirectory(pub PathBuf);

#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("chemin de fichier invalide")]
    InvalidPath,
    #[error("Le fichier choisi n'est pas une sauvegarde valide de Kairos.")]
    InvalidBackup,
    #[error("Cette sauvegarde est chiffrée : saisissez son mot de passe.")]
    PasswordRequired,
    #[error(transparent)]
    Crypto(#[from] CryptoError),
}

impl Serialize for BackupError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

type BackupResult<T> = Result<T, BackupError>;

/// Motif d'une sauvegarde, inscrit dans le nom du fichier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackupReason {
    Closing,
    Manual,
    BeforeRestore,
}

impl BackupReason {
    fn slug(self) -> &'static str {
        match self {
            BackupReason::Closing => "fermeture",
            BackupReason::Manual => "manuelle",
            BackupReason::BeforeRestore => "avant-restauration",
        }
    }
}

/// Sauvegarde présente dans le dossier des sauvegardes.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    name: String,
    path: String,
    size: u64,
    /// Date de création, ISO 8601 UTC.
    created_at: String,
    reason: String,
}

/// Date civile (UTC) d'un nombre de jours depuis le 01/01/1970 (algorithme de H. Hinnant).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// Horodatage UTC `AAAA-MM-JJ_HH-MM-SS` utilisé dans les noms de fichiers.
fn file_timestamp(unix_seconds: u64) -> String {
    let days = (unix_seconds / 86_400) as i64;
    let secs = unix_seconds % 86_400;
    let (y, m, d) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{d:02}_{:02}-{:02}-{:02}",
        secs / 3_600,
        (secs % 3_600) / 60,
        secs % 60
    )
}

/// Nom du fichier de sauvegarde : `planning-2026-10-14_18-30-05_fermeture.db`,
/// suivi d'un numéro (`_2`, `_3`…) si un fichier du même nom existe déjà.
pub fn backup_file_name(unix_seconds: u64, reason: BackupReason, counter: u32) -> String {
    let suffix = if counter > 1 {
        format!("_{counter}")
    } else {
        String::new()
    };
    format!(
        "{PREFIX}{}_{}{suffix}{EXTENSION}",
        file_timestamp(unix_seconds),
        reason.slug()
    )
}

/// Lit le nom d'un fichier de sauvegarde : date de création (ISO 8601 UTC) et motif.
pub fn parse_backup_file_name(name: &str) -> Option<(String, String)> {
    let core = name.strip_prefix(PREFIX)?.strip_suffix(EXTENSION)?;
    let mut parts = core.split('_');
    let date = parts.next()?;
    let time = parts.next()?;
    let reason = parts.next()?;
    if let Some(counter) = parts.next() {
        if counter.is_empty() || !counter.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
    }
    if parts.next().is_some() || reason.is_empty() {
        return None;
    }
    let is_digits = |s: &str, lens: &[usize]| {
        let fields: Vec<&str> = s.split('-').collect();
        fields.len() == lens.len()
            && fields
                .iter()
                .zip(lens)
                .all(|(f, len)| f.len() == *len && f.chars().all(|c| c.is_ascii_digit()))
    };
    if !is_digits(date, &[4, 2, 2]) || !is_digits(time, &[2, 2, 2]) {
        return None;
    }
    Some((
        format!("{date}T{}Z", time.replace('-', ":")),
        reason.to_string(),
    ))
}

/// Sauvegardes à supprimer pour n'en garder que `keep` (les plus récentes).
/// Les fichiers dont le nom n'est pas celui d'une sauvegarde sont ignorés.
pub fn backups_to_prune(names: &[String], keep: usize) -> Vec<String> {
    let mut backups: Vec<(String, &String)> = names
        .iter()
        .filter_map(|name| parse_backup_file_name(name).map(|(created_at, _)| (created_at, name)))
        .collect();
    backups.sort_by(|a, b| b.cmp(a));
    backups
        .into_iter()
        .skip(keep)
        .map(|(_, name)| name.clone())
        .collect()
}

fn path_str(path: &Path) -> BackupResult<&str> {
    path.to_str().ok_or(BackupError::InvalidPath)
}

async fn connect(path: &Path, read_only: bool) -> BackupResult<SqliteConnection> {
    Ok(SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false)
        .read_only(read_only)
        .connect()
        .await?)
}

/// Copie cohérente de la base `source` vers `destination` (qui ne doit pas exister).
pub async fn vacuum_into(source: &Path, destination: &Path) -> BackupResult<()> {
    let mut conn = connect(source, false).await?;
    let result = sqlx::query("VACUUM INTO ?")
        .bind(path_str(destination)?)
        .execute(&mut conn)
        .await;
    conn.close().await?;
    if let Err(error) = result {
        let _ = fs::remove_file(destination);
        return Err(error.into());
    }
    Ok(())
}

/// Vérifie qu'un fichier est une base SQLite intègre de l'application.
pub async fn validate_backup(path: &Path) -> BackupResult<()> {
    let mut header = [0u8; SQLITE_HEADER.len()];
    let has_header = fs::File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .is_ok_and(|()| header == SQLITE_HEADER);
    if !has_header {
        return Err(BackupError::InvalidBackup);
    }
    let mut conn = connect(path, true)
        .await
        .map_err(|_| BackupError::InvalidBackup)?;
    let check: String = sqlx::query("PRAGMA quick_check")
        .fetch_one(&mut conn)
        .await?
        .try_get(0)?;
    let tables: i64 = sqlx::query(
        "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('__migrations', 'seasons')",
    )
    .fetch_one(&mut conn)
    .await?
    .try_get(0)?;
    conn.close().await?;
    if check != "ok" || tables != 2 {
        return Err(BackupError::InvalidBackup);
    }
    Ok(())
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default()
}

fn backup_info(path: &Path) -> Option<BackupInfo> {
    let name = path.file_name()?.to_str()?.to_string();
    let (created_at, reason) = parse_backup_file_name(&name)?;
    let size = fs::metadata(path).ok()?.len();
    Some(BackupInfo {
        path: path.to_str()?.to_string(),
        name,
        size,
        created_at,
        reason,
    })
}

/// Sauvegardes du dossier, de la plus récente à la plus ancienne.
pub fn list_backups(directory: &Path) -> BackupResult<Vec<BackupInfo>> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut backups: Vec<BackupInfo> = fs::read_dir(directory)?
        .filter_map(|entry| backup_info(&entry.ok()?.path()))
        .collect();
    backups.sort_by(|a, b| (&b.created_at, &b.name).cmp(&(&a.created_at, &a.name)));
    Ok(backups)
}

/// Supprime les sauvegardes les plus anciennes au-delà de `keep`.
pub fn prune_backups(directory: &Path, keep: usize) -> BackupResult<()> {
    let names: Vec<String> = fs::read_dir(directory)?
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .collect();
    for name in backups_to_prune(&names, keep) {
        fs::remove_file(directory.join(name))?;
    }
    Ok(())
}

/// Crée une sauvegarde horodatée dans le dossier des sauvegardes, puis applique la rotation.
pub async fn create_backup(
    database: &Path,
    directory: &Path,
    reason: BackupReason,
    unix_seconds: u64,
) -> BackupResult<PathBuf> {
    fs::create_dir_all(directory)?;
    let mut counter = 1;
    let mut destination = directory.join(backup_file_name(unix_seconds, reason, counter));
    while destination.exists() {
        counter += 1;
        destination = directory.join(backup_file_name(unix_seconds, reason, counter));
    }
    vacuum_into(database, &destination).await?;
    prune_backups(directory, BACKUPS_KEPT)?;
    Ok(destination)
}

/// Chiffrement demandé pour un export : mot de passe et paramètres de dérivation.
pub struct Encryption<'a> {
    pub password: &'a str,
    pub params: KdfParams,
}

/// Exporte la base vers `destination`, en remplaçant le fichier s'il existe ;
/// le fichier est chiffré si `encryption` est fourni.
pub async fn export_backup(
    database: &Path,
    destination: &Path,
    encryption: Option<Encryption<'_>>,
) -> BackupResult<()> {
    let file_name = destination
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or(BackupError::InvalidPath)?;
    if encryption.as_ref().is_some_and(|e| e.password.is_empty()) {
        return Err(CryptoError::EmptyPassword.into());
    }
    let partial = destination.with_file_name(format!("{file_name}.partiel"));
    if partial.exists() {
        fs::remove_file(&partial)?;
    }
    match encryption {
        None => vacuum_into(database, &partial).await?,
        Some(Encryption { password, params }) => {
            // Copie en clair à côté de la base (jamais sur le support de destination),
            // supprimée dès qu'elle est chiffrée.
            let plain = database.with_extension("db.export");
            if plain.exists() {
                fs::remove_file(&plain)?;
            }
            vacuum_into(database, &plain).await?;
            let result = fs::read(&plain)
                .map_err(BackupError::from)
                .and_then(|bytes| Ok(crypto::encrypt(&bytes, password, params)?))
                .and_then(|encrypted| Ok(fs::write(&partial, encrypted)?));
            let _ = fs::remove_file(&plain);
            if result.is_err() {
                let _ = fs::remove_file(&partial);
            }
            result?;
        }
    }
    fs::rename(&partial, destination)?;
    Ok(())
}

/// Le fichier est-il une sauvegarde chiffrée (signature en tête) ?
pub fn is_encrypted_file(path: &Path) -> BackupResult<bool> {
    let mut magic = [0u8; crypto::MAGIC.len()];
    let mut file = fs::File::open(path).map_err(|_| BackupError::InvalidBackup)?;
    match file.read_exact(&mut magic) {
        Ok(()) => Ok(crypto::is_encrypted(&magic)),
        Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => Ok(false),
        Err(error) => Err(error.into()),
    }
}

/// Prépare une restauration : copie `source` vers `staged` (en la déchiffrant
/// si elle est chiffrée), puis vérifie que la copie est une sauvegarde valide.
/// Le mot de passe est ignoré pour une sauvegarde non chiffrée.
pub async fn stage_backup(
    source: &Path,
    staged: &Path,
    password: Option<&str>,
) -> BackupResult<()> {
    if staged.exists() {
        fs::remove_file(staged)?;
    }
    let result = async {
        if is_encrypted_file(source)? {
            let password = password
                .filter(|p| !p.is_empty())
                .ok_or(BackupError::PasswordRequired)?;
            let plain = crypto::decrypt(&fs::read(source)?, password)?;
            fs::write(staged, plain)?;
        } else {
            fs::copy(source, staged)?;
        }
        validate_backup(staged).await
    }
    .await;
    if result.is_err() {
        let _ = fs::remove_file(staged);
    }
    result
}

/// Remplace le fichier de la base par `staged` (base déjà fermée).
fn replace_database_file(database: &Path, staged: &Path) -> BackupResult<()> {
    for suffix in ["-journal", "-wal", "-shm"] {
        let mut name = database.as_os_str().to_owned();
        name.push(suffix);
        let side_file = PathBuf::from(name);
        if side_file.exists() {
            fs::remove_file(side_file)?;
        }
    }
    fs::rename(staged, database)?;
    Ok(())
}

/// Clé du pool de `tauri-plugin-sql` : l'URL passée à `Database.load` côté front.
fn pool_key(database: &Path) -> BackupResult<String> {
    Ok(format!("sqlite:{}", path_str(database)?))
}

/// Dossier des sauvegardes automatiques.
#[tauri::command]
pub fn backups_location(directory: State<'_, BackupDirectory>) -> BackupResult<String> {
    Ok(path_str(&directory.0)?.to_string())
}

/// Liste des sauvegardes automatiques.
#[tauri::command]
pub fn backup_list(directory: State<'_, BackupDirectory>) -> BackupResult<Vec<BackupInfo>> {
    list_backups(&directory.0)
}

/// Crée immédiatement une sauvegarde dans le dossier des sauvegardes.
#[tauri::command]
pub async fn backup_create(
    location: State<'_, DatabaseLocation>,
    directory: State<'_, BackupDirectory>,
) -> BackupResult<BackupInfo> {
    let path = create_backup(
        &location.0,
        &directory.0,
        BackupReason::Manual,
        now_unix_seconds(),
    )
    .await?;
    backup_info(&path).ok_or(BackupError::InvalidPath)
}

/// Exporte une sauvegarde vers le fichier choisi par l'utilisateur, chiffrée
/// si un mot de passe est fourni.
#[tauri::command]
pub async fn backup_export(
    location: State<'_, DatabaseLocation>,
    destination: String,
    password: Option<String>,
) -> BackupResult<()> {
    let encryption = password.as_deref().map(|password| Encryption {
        password,
        params: crypto::DEFAULT_KDF,
    });
    export_backup(&location.0, Path::new(&destination), encryption).await
}

/// Nature d'un fichier de sauvegarde choisi pour une restauration.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupFileInfo {
    encrypted: bool,
}

/// Indique si le fichier choisi est chiffré (un mot de passe sera demandé).
#[tauri::command]
pub fn backup_inspect(source: String) -> BackupResult<BackupFileInfo> {
    Ok(BackupFileInfo {
        encrypted: is_encrypted_file(Path::new(&source))?,
    })
}

/// Restaure une sauvegarde : la copie (déchiffrée au besoin) est vérifiée,
/// l'état courant est sauvegardé, puis la base est fermée et son fichier
/// remplacé. Le front doit ensuite se recharger pour rouvrir la base (et
/// appliquer les migrations éventuelles).
#[tauri::command]
pub async fn backup_restore(
    instances: State<'_, DbInstances>,
    location: State<'_, DatabaseLocation>,
    directory: State<'_, BackupDirectory>,
    source: String,
    password: Option<String>,
) -> BackupResult<()> {
    let database = location.0.as_path();
    // Copie préalable : la source peut être une sauvegarde que la rotation va supprimer.
    let staged = database.with_extension("db.restauration");
    stage_backup(Path::new(&source), &staged, password.as_deref()).await?;
    let result = async {
        create_backup(
            database,
            &directory.0,
            BackupReason::BeforeRestore,
            now_unix_seconds(),
        )
        .await?;

        if let Some(DbPool::Sqlite(pool)) = instances.0.write().await.remove(&pool_key(database)?) {
            pool.close().await;
        }
        replace_database_file(database, &staged)
    }
    .await;
    if result.is_err() {
        // Ne pas laisser de copie intermédiaire en cas d'échec.
        let _ = fs::remove_file(&staged);
    }
    result
}

/// Sauvegarde automatique à la fermeture de l'application.
pub fn backup_on_exit(app: &AppHandle) {
    let (Some(location), Some(directory)) = (
        app.try_state::<DatabaseLocation>(),
        app.try_state::<BackupDirectory>(),
    ) else {
        return;
    };
    if !location.0.exists() {
        return;
    }
    let result = tauri::async_runtime::block_on(create_backup(
        &location.0,
        &directory.0,
        BackupReason::Closing,
        now_unix_seconds(),
    ));
    if let Err(error) = result {
        eprintln!("Sauvegarde à la fermeture impossible : {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "planning-club-test-{name}-{}-{}",
            std::process::id(),
            now_unix_seconds()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn convertit_les_jours_en_dates_civiles() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(-1), (1969, 12, 31));
        assert_eq!(civil_from_days(11_016), (2000, 2, 29));
        assert_eq!(civil_from_days(20_740), (2026, 10, 14));
    }

    #[test]
    fn nomme_les_sauvegardes_avec_un_horodatage_utc() {
        // 14/10/2026 18:30:05 UTC
        let t = 20_740 * 86_400 + 18 * 3_600 + 30 * 60 + 5;
        assert_eq!(
            backup_file_name(t, BackupReason::Closing, 1),
            "planning-2026-10-14_18-30-05_fermeture.db"
        );
        assert_eq!(
            backup_file_name(t, BackupReason::BeforeRestore, 2),
            "planning-2026-10-14_18-30-05_avant-restauration_2.db"
        );
    }

    #[test]
    fn lit_les_noms_de_sauvegarde() {
        assert_eq!(
            parse_backup_file_name("planning-2026-10-14_18-30-05_fermeture.db"),
            Some(("2026-10-14T18:30:05Z".into(), "fermeture".into()))
        );
        assert_eq!(
            parse_backup_file_name("planning-2026-10-14_18-30-05_manuelle_3.db"),
            Some(("2026-10-14T18:30:05Z".into(), "manuelle".into()))
        );
        for invalid in [
            "planning.db",
            "planning-2026-10-14_18-30-05_fermeture.db.partiel",
            "planning-2026-10-14_18-30_fermeture.db",
            "planning-2026-10-14_18-30-05_.db",
            "planning-2026-10-14_18-30-05_manuelle_x.db",
            "autre-2026-10-14_18-30-05_fermeture.db",
        ] {
            assert_eq!(parse_backup_file_name(invalid), None, "{invalid}");
        }
    }

    #[test]
    fn ne_conserve_que_les_plus_recentes() {
        let mut names: Vec<String> = (1..=32)
            .map(|day| format!("planning-2026-10-{day:02}_08-00-00_fermeture.db"))
            .map(|n| n.replace("2026-10-32", "2026-11-01"))
            .collect();
        names.push("notes.txt".into());
        names.push("planning.db".into());
        let mut pruned = backups_to_prune(&names, 30);
        pruned.sort();
        assert_eq!(
            pruned,
            vec![
                "planning-2026-10-01_08-00-00_fermeture.db".to_string(),
                "planning-2026-10-02_08-00-00_fermeture.db".to_string(),
            ]
        );
        assert!(backups_to_prune(&names[..5], 30).is_empty());
    }

    async fn sample_database(path: &Path) {
        let mut conn = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .connect()
            .await
            .unwrap();
        for sql in [
            "CREATE TABLE __migrations (tag TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)",
            "CREATE TABLE seasons (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL)",
            "INSERT INTO seasons VALUES ('a', '2026-2027'), ('b', 'Saison « été »')",
        ] {
            sqlx::query(sql).execute(&mut conn).await.unwrap();
        }
        conn.close().await.unwrap();
    }

    async fn season_names(path: &Path) -> Vec<String> {
        let mut conn = connect(path, true).await.unwrap();
        let rows = sqlx::query("SELECT name FROM seasons ORDER BY id")
            .fetch_all(&mut conn)
            .await
            .unwrap();
        conn.close().await.unwrap();
        rows.iter().map(|r| r.get::<String, _>(0)).collect()
    }

    #[test]
    fn sauvegarde_exporte_et_valide_une_base() {
        tauri::async_runtime::block_on(async {
            let dir = temp_dir("roundtrip");
            let database = dir.join("planning.db");
            let backups = dir.join("sauvegardes");
            sample_database(&database).await;

            let t = 20_740 * 86_400;
            let first = create_backup(&database, &backups, BackupReason::Closing, t)
                .await
                .unwrap();
            let second = create_backup(&database, &backups, BackupReason::Closing, t)
                .await
                .unwrap();
            assert_ne!(first, second);
            let listed = list_backups(&backups).unwrap();
            assert_eq!(listed.len(), 2);
            assert_eq!(listed[0].created_at, "2026-10-14T00:00:00Z");
            validate_backup(&first).await.unwrap();
            assert_eq!(
                season_names(&first).await,
                vec!["2026-2027", "Saison « été »"]
            );

            // Export par-dessus un fichier existant.
            let exported = dir.join("export.db");
            fs::write(&exported, b"ancien contenu").unwrap();
            export_backup(&database, &exported, None).await.unwrap();
            assert_eq!(season_names(&exported).await, season_names(&database).await);

            // Restauration : remplacement du fichier de la base.
            let staged = dir.join("planning.db.restauration");
            fs::copy(&exported, &staged).unwrap();
            replace_database_file(&database, &staged).unwrap();
            assert_eq!(
                season_names(&database).await,
                vec!["2026-2027", "Saison « été »"]
            );

            let _ = fs::remove_dir_all(&dir);
        });
    }

    #[test]
    fn refuse_un_fichier_qui_n_est_pas_une_sauvegarde() {
        tauri::async_runtime::block_on(async {
            let dir = temp_dir("invalid");
            let text = dir.join("texte.db");
            fs::write(&text, b"bonjour").unwrap();
            assert!(matches!(
                validate_backup(&text).await,
                Err(BackupError::InvalidBackup)
            ));

            let other = dir.join("autre.db");
            let mut conn = SqliteConnectOptions::new()
                .filename(&other)
                .create_if_missing(true)
                .connect()
                .await
                .unwrap();
            sqlx::query("CREATE TABLE t (x)")
                .execute(&mut conn)
                .await
                .unwrap();
            conn.close().await.unwrap();
            assert!(matches!(
                validate_backup(&other).await,
                Err(BackupError::InvalidBackup)
            ));
            assert!(validate_backup(&dir.join("absent.db")).await.is_err());

            let _ = fs::remove_dir_all(&dir);
        });
    }

    /// Paramètres de dérivation réduits : tests rapides en mode debug.
    const FAST: KdfParams = KdfParams {
        memory_kib: 64,
        iterations: 1,
        lanes: 1,
    };

    fn encryption(password: &str) -> Option<Encryption<'_>> {
        Some(Encryption {
            password,
            params: FAST,
        })
    }

    #[test]
    fn exporte_et_restaure_une_sauvegarde_chiffree() {
        tauri::async_runtime::block_on(async {
            let dir = temp_dir("chiffrement");
            let database = dir.join("planning.db");
            sample_database(&database).await;

            let exported = dir.join("export.pcenc");
            export_backup(&database, &exported, encryption("correct horse"))
                .await
                .unwrap();
            let bytes = fs::read(&exported).unwrap();
            assert!(crypto::is_encrypted(&bytes));
            assert!(!bytes
                .windows(SQLITE_HEADER.len())
                .any(|w| w == SQLITE_HEADER));
            assert!(is_encrypted_file(&exported).unwrap());
            assert!(!database.with_extension("db.export").exists());
            assert!(!dir.join("export.pcenc.partiel").exists());
            // Un fichier chiffré n'est pas une base SQLite : validation directe refusée.
            assert!(matches!(
                validate_backup(&exported).await,
                Err(BackupError::InvalidBackup)
            ));

            let staged = dir.join("planning.db.restauration");
            stage_backup(&exported, &staged, Some("correct horse"))
                .await
                .unwrap();
            assert_eq!(
                season_names(&staged).await,
                vec!["2026-2027", "Saison « été »"]
            );
            let _ = fs::remove_dir_all(&dir);
        });
    }

    #[test]
    fn refuse_un_mauvais_mot_de_passe_ou_son_absence() {
        tauri::async_runtime::block_on(async {
            let dir = temp_dir("mauvais-mot-de-passe");
            let database = dir.join("planning.db");
            sample_database(&database).await;
            let exported = dir.join("export.pcenc");
            export_backup(&database, &exported, encryption("bon"))
                .await
                .unwrap();
            let staged = dir.join("staged.db");

            let wrong = stage_backup(&exported, &staged, Some("mauvais")).await;
            assert!(matches!(
                wrong,
                Err(BackupError::Crypto(CryptoError::WrongPassword))
            ));
            assert_eq!(
                wrong.unwrap_err().to_string(),
                "Mot de passe incorrect, ou fichier de sauvegarde altéré."
            );
            assert!(!staged.exists(), "aucune copie intermédiaire laissée");
            assert!(matches!(
                stage_backup(&exported, &staged, None).await,
                Err(BackupError::PasswordRequired)
            ));
            assert!(matches!(
                stage_backup(&exported, &staged, Some("")).await,
                Err(BackupError::PasswordRequired)
            ));
            assert!(matches!(
                export_backup(&database, &dir.join("vide.pcenc"), encryption("")).await,
                Err(BackupError::Crypto(CryptoError::EmptyPassword))
            ));
            let _ = fs::remove_dir_all(&dir);
        });
    }

    #[test]
    fn restaure_toujours_une_sauvegarde_non_chiffree() {
        tauri::async_runtime::block_on(async {
            let dir = temp_dir("non-chiffree");
            let database = dir.join("planning.db");
            sample_database(&database).await;
            let exported = dir.join("export.db");
            export_backup(&database, &exported, None).await.unwrap();
            assert!(!is_encrypted_file(&exported).unwrap());

            let staged = dir.join("staged.db");
            stage_backup(&exported, &staged, None).await.unwrap();
            assert_eq!(season_names(&staged).await, season_names(&database).await);
            // Un mot de passe fourni par erreur est ignoré.
            stage_backup(&exported, &staged, Some("inutile"))
                .await
                .unwrap();
            assert_eq!(season_names(&staged).await, season_names(&database).await);

            // Fichiers invalides : toujours refusés, sans copie laissée.
            let text = dir.join("texte.db");
            fs::write(&text, b"bonjour").unwrap();
            assert!(!is_encrypted_file(&text).unwrap());
            assert!(matches!(
                stage_backup(&text, &staged, None).await,
                Err(BackupError::InvalidBackup)
            ));
            assert!(!staged.exists());
            assert!(matches!(
                is_encrypted_file(&dir.join("absent.db")),
                Err(BackupError::InvalidBackup)
            ));
            let _ = fs::remove_dir_all(&dir);
        });
    }

    #[test]
    fn applique_la_rotation_dans_le_dossier() {
        let dir = temp_dir("prune");
        for day in 1..=31 {
            fs::write(
                dir.join(format!("planning-2026-10-{day:02}_08-00-00_fermeture.db")),
                b"",
            )
            .unwrap();
        }
        fs::write(dir.join("autre.txt"), b"").unwrap();
        prune_backups(&dir, BACKUPS_KEPT).unwrap();
        let listed = list_backups(&dir).unwrap();
        assert_eq!(listed.len(), 30);
        assert_eq!(listed.last().unwrap().created_at, "2026-10-02T08:00:00Z");
        assert!(dir.join("autre.txt").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
