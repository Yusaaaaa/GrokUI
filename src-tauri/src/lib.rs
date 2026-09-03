mod acp;
mod cli;
mod fs_tree;
mod sessions;
mod usage;

use acp::Agent;
use serde::Serialize;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

struct AppState {
    agent: Mutex<Option<Arc<Agent>>>,
}

fn agent_of(state: &State<AppState>) -> Result<Arc<Agent>, String> {
    state
        .agent
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?
        .clone()
        .ok_or_else(|| "Grok agent is not running".to_string())
}

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    phase: &'static str,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "Grok Build",
        version: env!("CARGO_PKG_VERSION"),
        phase: "3-acp",
    }
}

#[tauri::command]
fn cli_status(cli_path: Option<String>) -> cli::CliStatus {
    cli::probe(cli_path.as_deref())
}

#[tauri::command]
fn start_login(cli_path: Option<String>) -> Result<String, String> {
    cli::start_login(cli_path.as_deref())
}

#[tauri::command]
fn start_agent(
    app: AppHandle,
    state: State<AppState>,
    cli_path: Option<String>,
    model: Option<String>,
    force: Option<bool>,
) -> Result<cli::CliStatus, String> {
    let status = cli::probe(cli_path.as_deref());
    if !status.installed || !status.logged_in {
        return Err(status.message);
    }
    let bin = status
        .path
        .clone()
        .ok_or_else(|| "Grok CLI path is missing".to_string())?;
    let force = force.unwrap_or(false);
    {
        let mut slot = state.agent.lock().map_err(|_| "state lock poisoned")?;
        if !force {
            if let Some(agent) = slot.as_ref() {
                if agent.is_alive() {
                    return Ok(status);
                }
            }
        }
        *slot = None;
    }
    let log = acp::log_path(&app);
    let agent = Agent::spawn(&app, std::path::Path::new(&bin), model.as_deref(), &log)?;
    let mut slot = state.agent.lock().map_err(|_| "state lock poisoned")?;
    *slot = Some(Arc::new(agent));
    Ok(status)
}

#[tauri::command]
fn new_session(
    state: State<AppState>,
    cwd: String,
    yolo: bool,
    model: Option<String>,
) -> Result<Value, String> {
    agent_of(&state)?.new_session(&cwd, yolo, model.as_deref())
}

#[tauri::command]
fn send_prompt(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    text: String,
) -> Result<(), String> {
    agent_of(&state)?.send_prompt_bg(app, session_id, &text)
}

#[tauri::command]
fn cancel_prompt(state: State<AppState>, session_id: String) -> Result<(), String> {
    agent_of(&state)?.cancel(&session_id)
}

#[tauri::command]
fn resolve_permission(
    state: State<AppState>,
    request_id: u64,
    option_id: Option<String>,
) -> Result<(), String> {
    agent_of(&state)?.resolve_permission(request_id, option_id.as_deref())
}

#[tauri::command]
async fn load_session(
    state: State<'_, AppState>,
    session_id: String,
    cwd: String,
    yolo: bool,
) -> Result<Value, String> {
    let agent = agent_of(&state)?;
    tauri::async_runtime::spawn_blocking(move || agent.load_session(&session_id, &cwd, yolo))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn list_sessions() -> Result<Vec<sessions::DiskSession>, String> {
    sessions::list_sessions()
}

#[tauri::command]
async fn session_history(session_id: String) -> Result<Vec<sessions::HistoryBlock>, String> {
    tauri::async_runtime::spawn_blocking(move || sessions::load_history(&session_id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn delete_session(session_id: String, cli_path: Option<String>) -> Result<(), String> {
    sessions::delete_session(&session_id, cli_path.as_deref())
}

#[tauri::command]
fn relocate_sessions(session_ids: Vec<String>, target_cwd: String) -> Result<(), String> {
    sessions::relocate_sessions(&session_ids, &target_cwd)
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<fs_tree::FsEntry>, String> {
    fs_tree::list_dir(&path)
}

#[tauri::command]
fn preview_file(path: String) -> Result<fs_tree::FilePreview, String> {
    fs_tree::preview(&path)
}

#[tauri::command]
fn watch_dir(
    app: AppHandle,
    watch: State<fs_tree::FsWatch>,
    path: String,
) -> Result<(), String> {
    fs_tree::watch_dir(app, &watch, &path)
}

#[tauri::command]
fn month_usage(year: Option<i32>, month: Option<u32>) -> Result<usage::MonthUsage, String> {
    usage::month_usage(year, month)
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<String, String> {
    cli::ensure_dir(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            agent: Mutex::new(None),
        })
        .manage(fs_tree::FsWatch::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            cli_status,
            start_login,
            start_agent,
            new_session,
            send_prompt,
            cancel_prompt,
            resolve_permission,
            load_session,
            list_sessions,
            session_history,
            delete_session,
            relocate_sessions,
            list_dir,
            preview_file,
            watch_dir,
            month_usage,
            ensure_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
