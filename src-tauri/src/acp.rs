use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub const EVENT_SESSION: &str = "session://update";
pub const EVENT_PERMISSION: &str = "permission://ask";
pub const EVENT_AGENT: &str = "agent://status";
pub const EVENT_MODELS: &str = "models://update";
pub const EVENT_TURN: &str = "session://turn";

pub struct Agent {
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>>,
    next_id: AtomicU64,
    child: Mutex<Child>,
    shutdown: Arc<AtomicBool>,
}

impl Agent {
    pub fn spawn(
        app: &AppHandle,
        bin: &Path,
        model: Option<&str>,
        log_file: &Path,
    ) -> Result<Self, String> {
        if let Some(parent) = log_file.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let mut command = Command::new(bin);
        command.arg("agent");
        if let Some(model) = model.filter(|value| !value.is_empty()) {
            command.args(["-m", model]);
        }
        command.args([
            "--no-leader",
            "--debug-file",
            &log_file.to_string_lossy(),
            "stdio",
        ]);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to start grok agent: {error}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or("agent stdin is unavailable")?;
        let stdout = child
            .stdout
            .take()
            .ok_or("agent stdout is unavailable")?;
        let stderr = child.stderr.take();

        if let Some(stderr) = stderr {
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for _line in reader.lines() {}
            });
        }

        let pending: Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let stdin = Arc::new(Mutex::new(stdin));
        let pending_reader = Arc::clone(&pending);
        let stdin_reader = Arc::clone(&stdin);
        let app_reader = app.clone();
        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_reader = Arc::clone(&shutdown);

        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let Ok(message) = serde_json::from_str::<Value>(line) else {
                    continue;
                };
                handle_message(&app_reader, &pending_reader, &stdin_reader, message);
            }
            if !shutdown_reader.load(Ordering::SeqCst) {
                let _ = app_reader.emit(
                    EVENT_AGENT,
                    json!({ "state": "disconnected", "message": "Grok agent stopped" }),
                );
            }
        });

        let agent = Self {
            stdin,
            pending,
            next_id: AtomicU64::new(1),
            child: Mutex::new(child),
            shutdown,
        };

        agent.initialize()?;
        let _ = app.emit(EVENT_AGENT, json!({ "state": "ready" }));
        Ok(agent)
    }

    fn initialize(&self) -> Result<Value, String> {
        self.request(
            "initialize",
            json!({
                "protocolVersion": 1,
                "clientInfo": { "name": "GrokUI", "version": env!("CARGO_PKG_VERSION") },
                "clientCapabilities": {}
            }),
            Duration::from_secs(15),
        )
    }

    pub fn new_session(
        &self,
        cwd: &str,
        yolo: bool,
        model: Option<&str>,
    ) -> Result<Value, String> {
        let mut meta = serde_json::Map::new();
        if yolo {
            meta.insert("yoloMode".into(), Value::Bool(true));
        }
        if let Some(model) = model.filter(|value| !value.is_empty()) {
            meta.insert("model".into(), Value::String(model.to_string()));
        }
        self.request(
            "session/new",
            json!({
                "cwd": cwd,
                "mcpServers": [],
                "_meta": meta
            }),
            Duration::from_secs(30),
        )
    }

    pub fn load_session(
        &self,
        session_id: &str,
        cwd: &str,
        yolo: bool,
    ) -> Result<Value, String> {
        let mut meta = serde_json::Map::new();
        if yolo {
            meta.insert("yoloMode".into(), Value::Bool(true));
        }
        self.request(
            "session/load",
            json!({
                "sessionId": session_id,
                "cwd": cwd,
                "mcpServers": [],
                "_meta": meta
            }),
            Duration::from_secs(45),
        )
    }

    pub fn send_prompt_bg(
        &self,
        app: AppHandle,
        session_id: String,
        text: &str,
    ) -> Result<(), String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "agent lock poisoned")?
            .insert(id, tx);
        write_message(
            &self.stdin,
            &json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "session/prompt",
                "params": {
                    "sessionId": session_id,
                    "prompt": [{ "type": "text", "text": text }]
                }
            }),
        )?;
        thread::spawn(move || {
            let result = match rx.recv_timeout(Duration::from_secs(60 * 15)) {
                Ok(value) => value,
                Err(RecvTimeoutError::Timeout) => Err("session/prompt timed out".into()),
                Err(RecvTimeoutError::Disconnected) => {
                    Err("session/prompt disconnected".into())
                }
            };
            let _ = app.emit(
                EVENT_TURN,
                json!({
                    "sessionId": session_id,
                    "ok": result.is_ok(),
                    "result": result.as_ref().ok(),
                    "error": result.as_ref().err(),
                }),
            );
        });
        Ok(())
    }

    pub fn is_alive(&self) -> bool {
        if self.shutdown.load(Ordering::SeqCst) {
            return false;
        }
        match self.child.lock() {
            Ok(mut child) => matches!(child.try_wait(), Ok(None)),
            Err(_) => false,
        }
    }

    pub fn cancel(&self, session_id: &str) -> Result<(), String> {
        self.notify("session/cancel", json!({ "sessionId": session_id }))
    }

    pub fn resolve_permission(&self, request_id: u64, option_id: Option<&str>) -> Result<(), String> {
        let result = match option_id {
            Some(id) => json!({
                "outcome": { "outcome": "selected", "optionId": id }
            }),
            None => json!({
                "outcome": { "outcome": "cancelled" }
            }),
        };
        write_message(
            &self.stdin,
            &json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": result
            }),
        )
    }

    fn request(&self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "agent lock poisoned")?
            .insert(id, tx);
        write_message(
            &self.stdin,
            &json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": method,
                "params": params
            }),
        )?;
        match rx.recv_timeout(timeout) {
            Ok(result) => result,
            Err(RecvTimeoutError::Timeout) => {
                if let Ok(mut pending) = self.pending.lock() {
                    pending.remove(&id);
                }
                Err(format!("{method} timed out"))
            }
            Err(RecvTimeoutError::Disconnected) => Err(format!("{method} disconnected")),
        }
    }

    fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        write_message(
            &self.stdin,
            &json!({
                "jsonrpc": "2.0",
                "method": method,
                "params": params
            }),
        )
    }
}

impl Drop for Agent {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn write_message(stdin: &Arc<Mutex<ChildStdin>>, value: &Value) -> Result<(), String> {
    let mut guard = stdin.lock().map_err(|_| "agent stdin lock poisoned")?;
    writeln!(guard, "{value}").map_err(|error| format!("failed to write to agent: {error}"))?;
    guard
        .flush()
        .map_err(|error| format!("failed to flush agent stdin: {error}"))
}

fn handle_message(
    app: &AppHandle,
    pending: &Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>>,
    stdin: &Arc<Mutex<ChildStdin>>,
    message: Value,
) {
    let id = message.get("id").and_then(json_id);
    let method = message.get("method").and_then(Value::as_str);
    let params = message.get("params").cloned().unwrap_or(Value::Null);

    if let Some(id) = id {
        if let Some(method) = method {
            handle_incoming_request(app, stdin, id, method, params);
            return;
        }
        let result = if let Some(error) = message.get("error") {
            Err(error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("agent error")
                .to_string())
        } else {
            Ok(message.get("result").cloned().unwrap_or(Value::Null))
        };
        if let Ok(mut map) = pending.lock() {
            if let Some(tx) = map.remove(&id) {
                let _ = tx.send(result);
            }
        }
        return;
    }

    if let Some(method) = method {
        handle_notification(app, method, params);
    }
}

fn handle_incoming_request(
    app: &AppHandle,
    stdin: &Arc<Mutex<ChildStdin>>,
    id: u64,
    method: &str,
    params: Value,
) {
    match method {
        "session/request_permission" => {
            let mut payload = params;
            if let Value::Object(ref mut map) = payload {
                map.insert("requestId".into(), json!(id));
            }
            let _ = app.emit(EVENT_PERMISSION, payload);
        }
        "fs/read_text_file" => {
            let result = read_text_file(&params);
            let _ = write_rpc_result(stdin, id, result);
        }
        "fs/write_text_file" => {
            let result = write_text_file(&params);
            let _ = write_rpc_result(stdin, id, result);
        }
        _ => {
            let _ = write_message(
                stdin,
                &json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": -32601, "message": format!("Method not found: {method}") }
                }),
            );
        }
    }
}

fn handle_notification(app: &AppHandle, method: &str, params: Value) {
    match method {
        "session/update" => {
            let _ = app.emit(EVENT_SESSION, params);
        }
        "_x.ai/models/update" => {
            let _ = app.emit(EVENT_MODELS, params);
        }
        _ => {}
    }
}

fn write_rpc_result(
    stdin: &Arc<Mutex<ChildStdin>>,
    id: u64,
    result: Result<Value, String>,
) -> Result<(), String> {
    match result {
        Ok(value) => write_message(
            stdin,
            &json!({ "jsonrpc": "2.0", "id": id, "result": value }),
        ),
        Err(message) => write_message(
            stdin,
            &json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32000, "message": message }
            }),
        ),
    }
}

fn read_text_file(params: &Value) -> Result<Value, String> {
    let path = params
        .get("path")
        .and_then(Value::as_str)
        .ok_or("missing path")?;
    let contents = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(json!({ "content": contents }))
}

fn write_text_file(params: &Value) -> Result<Value, String> {
    let path = params
        .get("path")
        .and_then(Value::as_str)
        .ok_or("missing path")?;
    let content = params
        .get("content")
        .and_then(Value::as_str)
        .ok_or("missing content")?;
    if let Some(parent) = PathBuf::from(path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(json!({}))
}

fn json_id(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_i64().and_then(|n| u64::try_from(n).ok()))
        .or_else(|| value.as_str()?.parse().ok())
}

pub fn log_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_log_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("agent.log")
}
