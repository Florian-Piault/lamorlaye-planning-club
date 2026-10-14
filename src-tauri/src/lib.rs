mod backup;
mod crypto;
mod db;
mod import;
mod output;

use std::fs;

use tauri::{Manager, RunEvent};

/// Nom du fichier SQLite, placé dans le dossier de données de l'application.
const DATABASE_FILE: &str = "planning.db";
/// Sous-dossier des sauvegardes automatiques.
const BACKUPS_DIR: &str = "sauvegardes";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            app.manage(db::DatabaseLocation(data_dir.join(DATABASE_FILE)));
            app.manage(backup::BackupDirectory(data_dir.join(BACKUPS_DIR)));
            app.manage(import::PendingImport::default());
            app.manage(output::LastOutput::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::database_url,
            db::db_select_rows,
            db::db_batch,
            backup::backups_location,
            backup::backup_list,
            backup::backup_create,
            backup::backup_export,
            backup::backup_inspect,
            backup::backup_restore,
            import::import_choose_file,
            import::import_read_file,
            output::output_save,
            output::output_open_last
        ])
        .build(tauri::generate_context!())
        .expect("erreur au lancement de l'application")
        .run(|app, event| {
            // Copie de sécurité à chaque fermeture (§11.3).
            if let RunEvent::Exit = event {
                backup::backup_on_exit(app);
            }
        });
}
