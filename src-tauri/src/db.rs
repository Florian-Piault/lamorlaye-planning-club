//! Compléments à `tauri-plugin-sql` pour le pilote Drizzle `sqlite-proxy`.
//!
//! Le plugin gère la connexion (`load`), les écritures simples (`execute`) et la
//! fermeture. Il lui manque deux choses dont Drizzle a besoin :
//!
//! - des lignes renvoyées sous forme de **tableaux** (le plugin renvoie des
//!   objets, ce qui fusionne les colonnes homonymes d'une jointure) ;
//! - des **transactions** : le plugin s'appuie sur un pool de connexions, si bien
//!   que `BEGIN` et `COMMIT` envoyés séparément peuvent partir sur deux
//!   connexions différentes. `db_batch` exécute un lot de requêtes dans une
//!   seule transaction, sur une seule connexion.
//!
//! Ces commandes réutilisent le pool ouvert par le plugin (`DbInstances`).

use std::path::PathBuf;

use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::sqlite::{SqliteArguments, SqliteRow, SqliteValueRef};
use sqlx::{query::Query, Executor, Row, Sqlite, TypeInfo, ValueRef};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Chemin absolu du fichier SQLite de l'application.
pub struct DatabaseLocation(pub PathBuf);

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error("base de données non chargée : {0}")]
    NotLoaded(String),
    #[error("chemin de base de données invalide")]
    InvalidPath,
}

impl Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

type DbResult<T> = Result<T, DbError>;

/// Une requête d'un lot, avec ses paramètres positionnels.
#[derive(Debug, Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<JsonValue>,
}

/// Résultat d'une requête : lignes (tableaux de valeurs) et nombre de lignes modifiées.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementResult {
    rows: Vec<Vec<JsonValue>>,
    rows_affected: u64,
}

/// URL de connexion à passer à `Database.load` côté front.
#[tauri::command]
pub fn database_url(location: State<'_, DatabaseLocation>) -> DbResult<String> {
    let path = location.0.to_str().ok_or(DbError::InvalidPath)?;
    Ok(format!("sqlite:{path}"))
}

/// Exécute une requête de lecture et renvoie les lignes sous forme de tableaux.
#[tauri::command]
pub async fn db_select_rows(
    instances: State<'_, DbInstances>,
    db: String,
    sql: String,
    params: Vec<JsonValue>,
) -> DbResult<Vec<Vec<JsonValue>>> {
    let instances = instances.0.read().await;
    let DbPool::Sqlite(pool) = instances.get(&db).ok_or(DbError::NotLoaded(db.clone()))?;
    let rows = pool.fetch_all(bind_all(sqlx::query(&sql), params)).await?;
    rows.iter().map(row_to_values).collect()
}

/// Exécute un lot de requêtes dans une transaction unique (tout ou rien).
#[tauri::command]
pub async fn db_batch(
    instances: State<'_, DbInstances>,
    db: String,
    statements: Vec<Statement>,
) -> DbResult<Vec<StatementResult>> {
    let instances = instances.0.read().await;
    let DbPool::Sqlite(pool) = instances.get(&db).ok_or(DbError::NotLoaded(db.clone()))?;

    let mut tx = pool.begin().await?;
    let mut results = Vec::with_capacity(statements.len());
    for statement in statements {
        let query = bind_all(sqlx::query(&statement.sql), statement.params);
        // `fetch_many` donne à la fois les lignes et le nombre de lignes modifiées.
        let mut rows = Vec::new();
        let mut rows_affected = 0;
        let items: Vec<_> = (&mut *tx).fetch_many(query).try_collect().await?;
        for item in items {
            match item {
                sqlx::Either::Left(done) => rows_affected += done.rows_affected(),
                sqlx::Either::Right(row) => rows.push(row_to_values(&row)?),
            }
        }
        results.push(StatementResult {
            rows,
            rows_affected,
        });
    }
    // En cas d'erreur, la transaction est annulée automatiquement à sa destruction.
    tx.commit().await?;
    Ok(results)
}

/// Lie des paramètres JSON à une requête, avec les mêmes conventions que le plugin.
fn bind_all<'q>(
    mut query: Query<'q, Sqlite, SqliteArguments<'q>>,
    params: Vec<JsonValue>,
) -> Query<'q, Sqlite, SqliteArguments<'q>> {
    for value in params {
        query = match value {
            JsonValue::Null => query.bind(None::<String>),
            JsonValue::Bool(b) => query.bind(b),
            JsonValue::Number(n) => match n.as_i64() {
                Some(i) => query.bind(i),
                None => query.bind(n.as_f64().unwrap_or_default()),
            },
            JsonValue::String(s) => query.bind(s),
            other => query.bind(other.to_string()),
        };
    }
    query
}

fn row_to_values(row: &SqliteRow) -> DbResult<Vec<JsonValue>> {
    (0..row.len())
        .map(|i| Ok(value_to_json(row.try_get_raw(i)?)))
        .collect()
}

/// Convertit une valeur SQLite selon sa classe de stockage réelle.
fn value_to_json(value: SqliteValueRef<'_>) -> JsonValue {
    if value.is_null() {
        return JsonValue::Null;
    }
    let owned = sqlx::ValueRef::to_owned(&value);
    let decoded = match value.type_info().name() {
        "INTEGER" | "NUMERIC" | "BOOLEAN" => {
            sqlx::Value::try_decode::<i64>(&owned).map(JsonValue::from)
        }
        "REAL" => sqlx::Value::try_decode::<f64>(&owned).map(JsonValue::from),
        "BLOB" => sqlx::Value::try_decode::<Vec<u8>>(&owned).map(JsonValue::from),
        _ => sqlx::Value::try_decode::<String>(&owned).map(JsonValue::from),
    };
    decoded.unwrap_or(JsonValue::Null)
}
