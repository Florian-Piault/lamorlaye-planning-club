//! Enregistrement et ouverture des documents produits par l'application :
//! PDF (planning, feuilles d'appel), exports CSV et Excel (SPECS.md §9.2, §10).
//!
//! Comme pour l'import (`import.rs`), le front n'a aucun accès général au
//! système de fichiers : il envoie le contenu du document (corps binaire de la
//! requête), le dialogue « Enregistrer » est affiché côté Rust et le fichier
//! n'est écrit qu'à l'emplacement choisi par l'utilisateur. Le chemin est
//! conservé ici : `output_open_last` ouvre ce fichier-là, et lui seul, dans
//! l'application par défaut du système (lecteur PDF, tableur), sans que le
//! front ne manipule jamais de chemin.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

/// Taille maximale d'un document : 50 Mo, très au-delà d'un planning A3 ou d'un export.
pub const MAX_OUTPUT_SIZE: usize = 50 * 1024 * 1024;
/// En-tête portant le type de document (`pdf`, `csv`, `xlsx`, `json`).
const KIND_HEADER: &str = "x-output-kind";
/// En-tête portant le nom de fichier proposé, encodé en pourcentage (UTF-8).
const NAME_HEADER: &str = "x-output-name";

/// Type de document enregistré.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputKind {
    Pdf,
    Csv,
    Xlsx,
    /// Export des données personnelles d'un élève (RGPD, §11.6).
    Json,
}

impl OutputKind {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "pdf" => Some(Self::Pdf),
            "csv" => Some(Self::Csv),
            "xlsx" => Some(Self::Xlsx),
            "json" => Some(Self::Json),
            _ => None,
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            Self::Pdf => "pdf",
            Self::Csv => "csv",
            Self::Xlsx => "xlsx",
            Self::Json => "json",
        }
    }

    fn filter_name(self) -> &'static str {
        match self {
            Self::Pdf => "Document PDF",
            Self::Csv => "Fichier CSV",
            Self::Xlsx => "Classeur Excel",
            Self::Json => "Fichier JSON",
        }
    }

    fn dialog_title(self) -> &'static str {
        match self {
            Self::Pdf => "Enregistrer le PDF",
            Self::Csv | Self::Xlsx | Self::Json => "Enregistrer l'export",
        }
    }
}

/// Dernier document enregistré, seul fichier que `output_open_last` peut ouvrir.
#[derive(Default)]
pub struct LastOutput(Mutex<Option<PathBuf>>);

impl LastOutput {
    fn set(&self, path: Option<PathBuf>) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = path;
    }

    fn get(&self) -> Option<PathBuf> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum OutputError {
    #[error("Document invalide : contenu ou type de fichier manquant.")]
    InvalidRequest,
    #[error("Le document est trop volumineux (50 Mo au maximum).")]
    TooLarge,
    #[error("Aucun document n'a encore été enregistré.")]
    NothingSaved,
    #[error("Ouverture du document impossible : {0}")]
    Open(String),
    #[error("Enregistrement du document impossible : {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for OutputError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Décode une chaîne encodée en pourcentage (`encodeURIComponent`) ; `None` si elle est invalide.
pub fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

/// Nom de fichier proposé dans le dialogue : sans séparateur de dossier ni
/// caractère interdit sous Windows, avec l'extension du type de document.
pub fn sanitize_file_name(name: &str, kind: OutputKind) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '-'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    let base = if trimmed.is_empty() {
        "document"
    } else {
        trimmed
    };
    let suffix = format!(".{}", kind.extension());
    if base.to_lowercase().ends_with(&suffix) {
        base.to_string()
    } else {
        format!("{base}{suffix}")
    }
}

/// Ajoute l'extension du type de document au chemin choisi si elle manque.
pub fn with_extension(path: PathBuf, kind: OutputKind) -> PathBuf {
    let has_extension = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case(kind.extension()));
    if has_extension {
        return path;
    }
    let mut name = path.as_os_str().to_owned();
    name.push(format!(".{}", kind.extension()));
    PathBuf::from(name)
}

/// Écrit le document : fichier intermédiaire puis renommage, pour ne jamais
/// laisser un fichier tronqué à la place d'un document existant.
pub fn write_output(path: &Path, bytes: &[u8]) -> Result<(), OutputError> {
    if bytes.len() > MAX_OUTPUT_SIZE {
        return Err(OutputError::TooLarge);
    }
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or(OutputError::InvalidRequest)?;
    let partial = path.with_file_name(format!("{file_name}.partiel"));
    fs::write(&partial, bytes)?;
    if let Err(error) = fs::rename(&partial, path) {
        let _ = fs::remove_file(&partial);
        return Err(error.into());
    }
    Ok(())
}

fn header<'a>(request: &'a Request<'_>, name: &str) -> Option<&'a str> {
    request.headers().get(name)?.to_str().ok()
}

/// Affiche le dialogue « Enregistrer » puis écrit le document reçu à
/// l'emplacement choisi ; renvoie le nom du fichier (`null` si annulé).
#[tauri::command]
pub async fn output_save(
    window: WebviewWindow,
    last: State<'_, LastOutput>,
    request: Request<'_>,
) -> Result<Option<String>, OutputError> {
    let kind = header(&request, KIND_HEADER)
        .and_then(OutputKind::parse)
        .ok_or(OutputError::InvalidRequest)?;
    let suggested = header(&request, NAME_HEADER)
        .and_then(percent_decode)
        .unwrap_or_default();
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(OutputError::InvalidRequest);
    };
    if bytes.is_empty() {
        return Err(OutputError::InvalidRequest);
    }
    if bytes.len() > MAX_OUTPUT_SIZE {
        return Err(OutputError::TooLarge);
    }
    let bytes = bytes.clone();
    let file_name = sanitize_file_name(&suggested, kind);
    let picked = tauri::async_runtime::spawn_blocking(move || {
        window
            .dialog()
            .file()
            .set_parent(&window)
            .set_title(kind.dialog_title())
            .set_file_name(file_name)
            .add_filter(kind.filter_name(), &[kind.extension()])
            .blocking_save_file()
    })
    .await
    .map_err(|e| OutputError::Io(std::io::Error::other(e.to_string())))?;
    let Some(path) = picked.and_then(|p| p.as_path().map(Path::to_path_buf)) else {
        return Ok(None);
    };
    let path = with_extension(path, kind);
    write_output(&path, &bytes)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    last.set(Some(path));
    Ok(Some(name))
}

/// Ouvre le dernier document enregistré dans l'application par défaut du système.
#[tauri::command]
pub fn output_open_last(last: State<'_, LastOutput>) -> Result<(), OutputError> {
    let path = last.get().ok_or(OutputError::NothingSaved)?;
    if !path.is_file() {
        return Err(OutputError::NothingSaved);
    }
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|e| OutputError::Open(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "planning-club-output-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn reconnait_les_types_de_document() {
        assert_eq!(OutputKind::parse("pdf"), Some(OutputKind::Pdf));
        assert_eq!(OutputKind::parse("csv"), Some(OutputKind::Csv));
        assert_eq!(OutputKind::parse("xlsx"), Some(OutputKind::Xlsx));
        assert_eq!(OutputKind::parse("json"), Some(OutputKind::Json));
        assert_eq!(OutputKind::Json.extension(), "json");
        assert_eq!(OutputKind::parse("exe"), None);
        assert_eq!(OutputKind::parse("PDF"), None);
    }

    #[test]
    fn decode_les_noms_encodes() {
        assert_eq!(
            percent_decode("Planning%20%C3%A9t%C3%A9.pdf").as_deref(),
            Some("Planning été.pdf")
        );
        assert_eq!(percent_decode("simple").as_deref(), Some("simple"));
        assert_eq!(percent_decode("tronqu%C"), None);
        assert_eq!(percent_decode("%ZZ"), None);
        assert_eq!(percent_decode("%FF"), None);
    }

    #[test]
    fn nettoie_le_nom_propose() {
        assert_eq!(
            sanitize_file_name("Semaine du 02/11/2026", OutputKind::Pdf),
            "Semaine du 02-11-2026.pdf"
        );
        assert_eq!(
            sanitize_file_name("../../etc/passwd", OutputKind::Csv),
            "-..-etc-passwd.csv"
        );
        assert_eq!(
            sanitize_file_name("eleves.XLSX", OutputKind::Xlsx),
            "eleves.XLSX"
        );
        assert_eq!(sanitize_file_name("  ", OutputKind::Pdf), "document.pdf");
        assert_eq!(
            sanitize_file_name("a\u{0}b:c", OutputKind::Pdf),
            "a-b-c.pdf"
        );
    }

    #[test]
    fn ajoute_l_extension_manquante() {
        assert_eq!(
            with_extension(PathBuf::from("/tmp/planning"), OutputKind::Pdf),
            PathBuf::from("/tmp/planning.pdf")
        );
        assert_eq!(
            with_extension(PathBuf::from("/tmp/planning.PDF"), OutputKind::Pdf),
            PathBuf::from("/tmp/planning.PDF")
        );
        assert_eq!(
            with_extension(PathBuf::from("/tmp/cours.csv"), OutputKind::Xlsx),
            PathBuf::from("/tmp/cours.csv.xlsx")
        );
    }

    #[test]
    fn ecrit_et_remplace_le_document() {
        let dir = temp_dir("ecriture");
        let file = dir.join("planning.pdf");
        fs::write(&file, b"ancien").unwrap();
        write_output(&file, b"%PDF-1.3 nouveau").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"%PDF-1.3 nouveau");
        assert!(!dir.join("planning.pdf.partiel").exists());
        assert!(matches!(
            write_output(&dir.join("absent").join("x.pdf"), b"x"),
            Err(OutputError::Io(_))
        ));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuse_un_document_trop_volumineux() {
        let dir = temp_dir("taille");
        let big = vec![0u8; MAX_OUTPUT_SIZE + 1];
        assert!(matches!(
            write_output(&dir.join("gros.pdf"), &big),
            Err(OutputError::TooLarge)
        ));
        assert!(!dir.join("gros.pdf").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn n_ouvre_que_le_dernier_document_enregistre() {
        let last = LastOutput::default();
        assert_eq!(last.get(), None);
        last.set(Some(PathBuf::from("/tmp/a.pdf")));
        assert_eq!(last.get(), Some(PathBuf::from("/tmp/a.pdf")));
    }
}
