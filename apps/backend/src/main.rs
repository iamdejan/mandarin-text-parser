use std::env;

use axum::{Json, Router, routing::get};

use serde_json::{Value, json};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let app = Router::new()
        .route("/healthcheck", get(health_check))
        .layer(CorsLayer::permissive());

    let port = env::var("PORT").unwrap_or_else(|_| return "3000".to_string());
    let host = env::var("HOST").unwrap_or_else(|_| return "127.0.0.1".to_string());

    let address = format!("{host}:{port}");
    let listener = tokio::net::TcpListener::bind(&address).await.unwrap();
    println!("Listening on http://{address}");
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Json<Value> {
    return Json(json!({"status": "ok", "message": "Axum backend is running!"}));
}
