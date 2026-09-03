use crate::cli;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSession {
    pub id: String,
    pub cwd: String,
    pub title: String,
    pub preview: String,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryBlock {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Deserialize)]
struct SummaryFile {
    info: Option<SummaryInfo>,
    session_summary: Option<String>,
    generated_title: Option<String>,
    last_turn_summary: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    last_active_at: Option<String>,
}

#[derive(Deserialize)]
struct SummaryInfo {
    id: Option<String>,
    cwd: Option<String>,
}

pub fn sessions_root() -> PathBuf {
    std::env::var_os("GROK_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".grok")))
        .unwrap_or_else(|| PathBuf::from(".grok"))
        .join("sessions")
}

pub fn list_sessions() -> Result<Vec<DiskSession>, String> {
    let root = sessions_root();
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let groups = fs::read_dir(&root).map_err(|error| error.to_string())?;
    for group in groups.flatten() {
        let group_path = group.path();
        if !group_path.is_dir() {
            continue;
        }
        let group_cwd = group_cwd(&group_path);
        let children = fs::read_dir(&group_path).map_err(|error| error.to_string())?;
        for child in children.flatten() {
            let session_dir = child.path();
            if !session_dir.is_dir() {
                continue;
            }
            let summary_path = session_dir.join("summary.json");
            if !summary_path.is_file() {
                continue;
            }
            if let Some(session) = parse_summary(&summary_path, &group_cwd, &session_dir) {
                out.push(session);
            }
        }
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(out)
}

pub fn load_history(session_id: &str) -> Result<Vec<HistoryBlock>, String> {
    let Some(dir) = find_session_dir(session_id) else {
        return Ok(Vec::new());
    };
    let path = dir.join("updates.jsonl");
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let file = File::open(&path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    let mut blocks: Vec<HistoryBlock> = Vec::new();
    let mut index: usize = 0;
    for line in reader.lines() {
        let Ok(line) = line else { continue };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let update = value
            .pointer("/params/update")
            .cloned()
            .or_else(|| value.get("update").cloned())
            .unwrap_or(value);
        apply_history(&mut blocks, &mut index, &update);
    }
    if blocks.len() > 240 {
        let skip = blocks.len() - 240;
        blocks = blocks.split_off(skip);
    }
    Ok(blocks)
}

pub fn relocate_sessions(session_ids: &[String], target_cwd: &str) -> Result<(), String> {
    if target_cwd.trim().is_empty() {
        return Err("Target directory is missing".into());
    }
    let dest_group = sessions_root().join(percent_encode_path(target_cwd));
    fs::create_dir_all(&dest_group).map_err(|error| error.to_string())?;
    let _ = fs::write(dest_group.join(".cwd"), target_cwd);
    for session_id in session_ids {
        let Some(source) = find_session_dir(session_id) else {
            continue;
        };
        let dest = dest_group.join(session_id);
        if source == dest {
            patch_summary_cwd(&dest.join("summary.json"), target_cwd)?;
            continue;
        }
        if dest.exists() {
            fs::remove_dir_all(&dest).map_err(|error| error.to_string())?;
        }
        let parent = source.parent().map(Path::to_path_buf);
        fs::rename(&source, &dest).map_err(|error| error.to_string())?;
        patch_summary_cwd(&dest.join("summary.json"), target_cwd)?;
        if let Some(parent) = parent {
            maybe_remove_empty_group(&parent);
        }
    }
    Ok(())
}

fn patch_summary_cwd(path: &Path, cwd: &str) -> Result<(), String> {
    if !path.is_file() {
        return Ok(());
    }
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut value: Value =
        serde_json::from_str(&text).map_err(|error| error.to_string())?;
    if let Some(info) = value.get_mut("info") {
        if let Some(object) = info.as_object_mut() {
            object.insert("cwd".into(), Value::String(cwd.to_string()));
        }
    } else if let Some(object) = value.as_object_mut() {
        object.insert(
            "info".into(),
            serde_json::json!({ "cwd": cwd }),
        );
    }
    let next = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
    fs::write(path, next).map_err(|error| error.to_string())
}

fn maybe_remove_empty_group(path: &Path) {
    let Ok(mut entries) = fs::read_dir(path) else {
        return;
    };
    let leftover = entries.any(|entry| {
        entry
            .map(|item| {
                let name = item.file_name();
                name != ".cwd" && name != ".DS_Store"
            })
            .unwrap_or(true)
    });
    if !leftover {
        let _ = fs::remove_dir_all(path);
    }
}

fn percent_encode_path(path: &str) -> String {
    let mut out = String::new();
    for byte in path.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                out.push(*byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

pub fn delete_session(session_id: &str, cli_path: Option<&str>) -> Result<(), String> {
    if let Some(bin) = cli::resolve_binary(cli_path) {
        let status = Command::new(bin)
            .args(["sessions", "delete", session_id])
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            return Ok(());
        }
    }
    if let Some(dir) = find_session_dir(session_id) {
        fs::remove_dir_all(dir).map_err(|error| error.to_string())?;
        return Ok(());
    }
    Err(format!("Session {session_id} was not found"))
}

fn parse_summary(path: &Path, fallback_cwd: &str, session_dir: &Path) -> Option<DiskSession> {
    let text = fs::read_to_string(path).ok()?;
    let summary: SummaryFile = serde_json::from_str(&text).ok()?;
    let id = summary
        .info
        .as_ref()
        .and_then(|info| info.id.clone())
        .or_else(|| {
            session_dir
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
        })?;
    let cwd = summary
        .info
        .as_ref()
        .and_then(|info| info.cwd.clone())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback_cwd.to_string());
    let title = first_nonempty(&[
        summary.generated_title.as_deref(),
        summary.session_summary.as_deref(),
        summary.last_turn_summary.as_deref(),
    ])
    .unwrap_or("Untitled")
    .to_string();
    let preview = first_nonempty(&[
        summary.last_turn_summary.as_deref(),
        summary.session_summary.as_deref(),
    ])
    .unwrap_or("")
    .to_string();
    Some(DiskSession {
        id,
        cwd,
        title,
        preview,
        updated_at: summary
            .last_active_at
            .or(summary.updated_at)
            .unwrap_or_default(),
        created_at: summary.created_at.unwrap_or_default(),
    })
}

fn group_cwd(group_path: &Path) -> String {
    let marker = group_path.join(".cwd");
    if let Ok(text) = fs::read_to_string(marker) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    group_path
        .file_name()
        .map(|name| percent_decode(&name.to_string_lossy()))
        .unwrap_or_else(|| group_path.to_string_lossy().into_owned())
}

fn find_session_dir(session_id: &str) -> Option<PathBuf> {
    let root = sessions_root();
    let groups = fs::read_dir(root).ok()?;
    for group in groups.flatten() {
        let candidate = group.path().join(session_id);
        if candidate.join("summary.json").is_file() {
            return Some(candidate);
        }
    }
    None
}

fn apply_history(blocks: &mut Vec<HistoryBlock>, index: &mut usize, update: &Value) {
    let kind = update
        .get("sessionUpdate")
        .and_then(Value::as_str)
        .unwrap_or("");
    match kind {
        "user_message_chunk" => append_text(blocks, index, "user", text_of(update)),
        "agent_thought_chunk" => append_text(blocks, index, "thought", text_of(update)),
        "agent_message_chunk" => append_text(blocks, index, "text", text_of(update)),
        "tool_call" | "tool_call_update" => upsert_tool(blocks, index, update),
        "plan" => upsert_plan(blocks, index, update),
        _ => {}
    }
}

fn append_text(blocks: &mut Vec<HistoryBlock>, index: &mut usize, block_type: &str, chunk: String) {
    if chunk.is_empty() {
        return;
    }
    if let Some(last) = blocks.last_mut() {
        if last.block_type == block_type {
            let text = last.text.get_or_insert_with(String::new);
            text.push_str(&chunk);
            return;
        }
    }
    *index += 1;
    blocks.push(HistoryBlock {
        id: format!("{block_type}-{index}"),
        block_type: block_type.into(),
        text: Some(chunk),
        kind: None,
        title: None,
        status: None,
        path: None,
        detail: None,
    });
}

fn upsert_tool(blocks: &mut Vec<HistoryBlock>, index: &mut usize, update: &Value) {
    let id = update
        .get("toolCallId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if id.is_empty() {
        return;
    }
    let raw = update.get("rawInput").cloned().unwrap_or(Value::Null);
    let path = raw
        .get("path")
        .or_else(|| raw.get("file"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let command = raw.get("command").and_then(Value::as_str).map(str::to_string);
    let kind = tool_kind(update);
    let title = update
        .get("title")
        .or_else(|| update.get("toolName"))
        .and_then(Value::as_str)
        .unwrap_or("Tool")
        .to_string();
    let status = match update.get("status").and_then(Value::as_str).unwrap_or("") {
        "completed" | "failed" => "completed",
        "in_progress" | "running" => "running",
        _ => "pending",
    }
    .to_string();
    let detail = command.or_else(|| {
        if path.is_some() {
            None
        } else {
            serde_json::to_string(&raw).ok()
        }
    });

    if let Some(existing) = blocks.iter_mut().find(|block| block.id == id) {
        existing.kind = Some(kind);
        existing.title = Some(title);
        existing.status = Some(status);
        if path.is_some() {
            existing.path = path;
        }
        if detail.is_some() {
            existing.detail = detail;
        }
        return;
    }
    *index += 1;
    blocks.push(HistoryBlock {
        id,
        block_type: "tool".into(),
        text: None,
        kind: Some(kind),
        title: Some(title),
        status: Some(status),
        path,
        detail,
    });
}

fn upsert_plan(blocks: &mut Vec<HistoryBlock>, index: &mut usize, update: &Value) {
    let text = update
        .get("entries")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    entry
                        .get("content")
                        .or_else(|| entry.get("title"))
                        .and_then(Value::as_str)
                })
                .collect::<Vec<_>>()
                .join("\n")
        });
    if let Some(existing) = blocks.iter_mut().find(|block| block.block_type == "plan") {
        existing.text = text;
        return;
    }
    *index += 1;
    blocks.push(HistoryBlock {
        id: "plan".into(),
        block_type: "plan".into(),
        text,
        kind: None,
        title: Some("Plan".into()),
        status: None,
        path: None,
        detail: None,
    });
}

fn tool_kind(update: &Value) -> String {
    let direct = update.get("kind").and_then(Value::as_str);
    let nested = update
        .pointer("/_meta/x.ai/tool/kind")
        .and_then(Value::as_str);
    match direct.or(nested).unwrap_or("") {
        "edit" | "delete" | "move" => "edit",
        "execute" => "execute",
        "search" | "fetch" => "search",
        _ => "read",
    }
    .into()
}

fn text_of(update: &Value) -> String {
    update
        .pointer("/content/text")
        .and_then(Value::as_str)
        .or_else(|| update.get("text").and_then(Value::as_str))
        .unwrap_or("")
        .to_string()
}

fn first_nonempty<'a>(values: &[Option<&'a str>]) -> Option<&'a str> {
    values
        .iter()
        .copied()
        .flatten()
        .map(str::trim)
        .find(|value| !value.is_empty())
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(value) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("00"),
                16,
            ) {
                out.push(value);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
