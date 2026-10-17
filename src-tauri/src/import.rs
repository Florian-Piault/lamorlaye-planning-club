//! Lecture du fichier choisi pour l'import d'élèves (docs/SPECS.md §9.1).
//!
//! Plutôt que d'accorder au front un accès général au système de fichiers
//! (`tauri-plugin-fs`), le dialogue « Ouvrir » est affiché côté Rust et le
//! chemin choisi par l'utilisateur est conservé ici : le front ne peut lire
//! que ce fichier-là, une seule fois, et jamais un chemin de son choix. Seuls
//! les fichiers CSV ou Excel de taille raisonnable sont acceptés. Les octets
//! sont renvoyés tels quels (réponse binaire) ; l'analyse (encodage,
//! séparateur, classeur) est faite côté TypeScript.

use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

/// Extensions acceptées (comparées sans tenir compte de la casse).
pub const ALLOWED_EXTENSIONS: &[&str] = &["csv", "txt", "tsv", "xlsx", "xls"];
/// Taille maximale du fichier : 20 Mo, bien au-delà d'un export de quelques centaines d'adhérents.
pub const MAX_FILE_SIZE: u64 = 20 * 1024 * 1024;

/// Fichier choisi dans le dialogue d'import, en attente de lecture.
#[derive(Default)]
pub struct PendingImport(Mutex<Option<PathBuf>>);

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error(
        "Format de fichier non pris en charge : choisissez un fichier CSV ou Excel (.xlsx, .xls)."
    )]
    UnsupportedFile,
    #[error("Le fichier est trop volumineux (20 Mo au maximum).")]
    TooLarge,
    #[error("Aucun fichier à importer n'a été choisi.")]
    NoFileChosen,
    #[error("Lecture du fichier impossible : {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for ImportError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Le fichier a-t-il une extension acceptée pour l'import ?
pub fn is_importable(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| ALLOWED_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Lit un fichier d'import après vérification de son extension, de sa nature et de sa taille.
pub fn read_import_file(path: &Path) -> Result<Vec<u8>, ImportError> {
    if !is_importable(path) {
        return Err(ImportError::UnsupportedFile);
    }
    let file = File::open(path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(ImportError::UnsupportedFile);
    }
    if metadata.len() > MAX_FILE_SIZE {
        return Err(ImportError::TooLarge);
    }
    // Limite appliquée aussi à la lecture : le fichier peut grossir entre-temps.
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(MAX_FILE_SIZE + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_FILE_SIZE {
        return Err(ImportError::TooLarge);
    }
    Ok(bytes)
}

impl PendingImport {
    fn replace(&self, path: Option<PathBuf>) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = path;
    }

    /// Lit le fichier choisi ; il ne peut être lu qu'une fois.
    fn read(&self) -> Result<Vec<u8>, ImportError> {
        let path = self
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
            .ok_or(ImportError::NoFileChosen)?;
        read_import_file(&path)
    }
}

/// Affiche le dialogue « Ouvrir » ; renvoie le nom du fichier choisi (`null` si annulé).
#[tauri::command]
pub async fn import_choose_file(
    window: WebviewWindow,
    pending: State<'_, PendingImport>,
) -> Result<Option<String>, ImportError> {
    pending.replace(None);
    let picked = tauri::async_runtime::spawn_blocking(move || {
        window
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Importer des élèves")
            .add_filter("Fichiers CSV ou Excel", ALLOWED_EXTENSIONS)
            .blocking_pick_file()
    })
    .await
    .map_err(|e| ImportError::Io(std::io::Error::other(e.to_string())))?;
    let Some(path) = picked.and_then(|p| p.as_path().map(Path::to_path_buf)) else {
        return Ok(None);
    };
    if !is_importable(&path) {
        return Err(ImportError::UnsupportedFile);
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    pending.replace(Some(path));
    Ok(Some(name))
}

/// Contenu du fichier choisi par `import_choose_file`.
#[tauri::command]
pub fn import_read_file(pending: State<'_, PendingImport>) -> Result<Response, ImportError> {
    pending.read().map(Response::new)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "planning-club-import-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn accepte_les_fichiers_csv_et_excel() {
        for name in [
            "eleves.csv",
            "ELEVES.CSV",
            "export.xlsx",
            "ancien.XLS",
            "liste.txt",
        ] {
            assert!(is_importable(Path::new(name)), "{name}");
        }
        for name in ["planning.db", "photo.png", "sans-extension", ".csv"] {
            assert!(!is_importable(Path::new(name)), "{name}");
        }
    }

    #[test]
    fn lit_un_fichier_d_import() {
        let dir = temp_dir("lecture");
        let file = dir.join("eleves.csv");
        fs::write(&file, b"Nom;Pr\xe9nom\r\nMartin;L\xe9a\r\n").unwrap();
        assert_eq!(
            read_import_file(&file).unwrap(),
            b"Nom;Pr\xe9nom\r\nMartin;L\xe9a\r\n"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuse_les_autres_fichiers() {
        let dir = temp_dir("refus");
        let database = dir.join("planning.db");
        fs::write(&database, b"SQLite format 3\0").unwrap();
        assert!(matches!(
            read_import_file(&database),
            Err(ImportError::UnsupportedFile)
        ));
        let folder = dir.join("dossier.csv");
        fs::create_dir_all(&folder).unwrap();
        assert!(read_import_file(&folder).is_err());
        assert!(matches!(
            read_import_file(&dir.join("absent.csv")),
            Err(ImportError::Io(_))
        ));
        let large = dir.join("gros.csv");
        File::create(&large)
            .unwrap()
            .set_len(MAX_FILE_SIZE + 1)
            .unwrap();
        assert!(matches!(
            read_import_file(&large),
            Err(ImportError::TooLarge)
        ));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ne_lit_que_le_fichier_choisi_et_une_seule_fois() {
        let dir = temp_dir("choix");
        let file = dir.join("eleves.csv");
        fs::write(&file, b"Nom\r\nMartin\r\n").unwrap();
        let pending = PendingImport::default();
        assert!(matches!(pending.read(), Err(ImportError::NoFileChosen)));
        pending.replace(Some(file));
        assert_eq!(pending.read().unwrap(), b"Nom\r\nMartin\r\n");
        assert!(matches!(pending.read(), Err(ImportError::NoFileChosen)));
        let _ = fs::remove_dir_all(&dir);
    }
}
