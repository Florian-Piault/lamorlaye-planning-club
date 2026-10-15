//! Informations de l'écran « À propos » : version de l'application et de
//! Tauri, système, emplacement des données et des sauvegardes.

use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::backup::BackupDirectory;
use crate::db::DatabaseLocation;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// Version de l'application (`tauri.conf.json`).
    version: String,
    tauri_version: String,
    /// Système et architecture, ex. « macos » / « aarch64 ».
    os: String,
    arch: String,
    /// Dossier de données de l'application.
    data_dir: String,
    /// Fichier SQLite.
    database: String,
    /// Dossier des sauvegardes automatiques.
    backups_dir: String,
}

/// Chemin affichable (les caractères non UTF-8 sont remplacés).
fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// Assemble les informations à partir des emplacements de la base et des sauvegardes.
pub fn app_info_for(version: &str, database: &Path, backups: &Path) -> AppInfo {
    AppInfo {
        version: version.to_string(),
        tauri_version: tauri::VERSION.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        data_dir: database.parent().map(display).unwrap_or_default(),
        database: display(database),
        backups_dir: display(backups),
    }
}

/// Informations de l'écran « À propos ».
#[tauri::command]
pub fn app_info(
    app: AppHandle,
    location: State<'_, DatabaseLocation>,
    directory: State<'_, BackupDirectory>,
) -> AppInfo {
    app_info_for(
        &app.package_info().version.to_string(),
        &location.0,
        &directory.0,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn decrit_les_emplacements_de_l_application() {
        let data = PathBuf::from("/donnees/fr.tc-lamorlaye.planning");
        let info = app_info_for(
            "1.0.0",
            &data.join("planning.db"),
            &data.join("sauvegardes"),
        );
        assert_eq!(info.version, "1.0.0");
        assert_eq!(info.data_dir, display(&data));
        assert_eq!(info.database, display(&data.join("planning.db")));
        assert_eq!(info.backups_dir, display(&data.join("sauvegardes")));
        assert_eq!(info.os, std::env::consts::OS);
        assert!(!info.tauri_version.is_empty());
    }

    #[test]
    fn serialise_en_camel_case() {
        let info = app_info_for("1.0.0", Path::new("planning.db"), Path::new("sauvegardes"));
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["version"], "1.0.0");
        assert_eq!(json["dataDir"], "");
        assert_eq!(json["backupsDir"], "sauvegardes");
        assert!(json["tauriVersion"].is_string());
    }
}
