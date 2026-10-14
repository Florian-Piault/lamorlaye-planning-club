//! Point d'entrée de l'application Tauri.
//!
//! Le Rust se limite à la configuration et aux plugins officiels. La seule
//! exception est le module `db`, qui complète `tauri-plugin-sql` avec deux
//! commandes (lignes sous forme de tableaux, lots transactionnels) nécessaires
//! au pilote `sqlite-proxy` de Drizzle.

mod db;

use std::fs;

use tauri::Manager;

/// Nom du fichier SQLite, placé dans le dossier de données de l'application.
const DATABASE_FILE: &str = "planning.db";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // Le plugin SQL ne crée que le dossier de configuration : on s'assure
            // que le dossier de données existe avant la première connexion.
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            app.manage(db::DatabaseLocation(data_dir.join(DATABASE_FILE)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::database_url,
            db::db_select_rows,
            db::db_batch
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application");
}
