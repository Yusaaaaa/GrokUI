use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use serde_json::json;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub struct FsWatch {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl Default for FsWatch {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
        }
    }
}

const SKIP: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    ".preview",
    ".DS_Store",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub content: Option<String>,
    pub mime: Option<String>,
}

pub fn list_dir(path: &str) -> Result<Vec<FsEntry>, String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    let mut entries = Vec::new();
    let read = fs::read_dir(&root).map_err(|error| error.to_string())?;
    for item in read.flatten() {
        let name = item.file_name().to_string_lossy().into_owned();
        if should_skip(&name) {
            continue;
        }
        let file_type = item.file_type().map_err(|error| error.to_string())?;
        let kind = if file_type.is_dir() { "dir" } else { "file" };
        entries.push(FsEntry {
            name,
            path: item.path().to_string_lossy().into_owned(),
            kind: kind.into(),
        });
    }
    entries.sort_by(|a, b| {
        match (a.kind.as_str(), b.kind.as_str()) {
            ("dir", "file") => std::cmp::Ordering::Less,
            ("file", "dir") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    Ok(entries)
}

pub fn preview(path: &str) -> Result<FilePreview, String> {
    let file = PathBuf::from(path);
    let name = file
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string());
    let ext = file
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "pdf" {
        return preview_pdf(&file, path, &name);
    }
    if is_image(&ext) {
        return preview_image(&file, path, &name, &ext);
    }
    if is_text(&ext, &file) {
        let mut data = Vec::new();
        let handle = fs::File::open(&file).map_err(|error| error.to_string())?;
        handle
            .take(200_000)
            .read_to_end(&mut data)
            .map_err(|error| error.to_string())?;
        let content = String::from_utf8_lossy(&data).into_owned();
        return Ok(FilePreview {
            path: path.into(),
            name,
            kind: "text".into(),
            content: Some(content),
            mime: None,
        });
    }
    Ok(FilePreview {
        path: path.into(),
        name,
        kind: "binary".into(),
        content: None,
        mime: None,
    })
}

fn preview_pdf(file: &Path, path: &str, name: &str) -> Result<FilePreview, String> {
    let meta = fs::metadata(file).map_err(|error| error.to_string())?;
    if meta.len() > 12_000_000 {
        return Ok(FilePreview {
            path: path.into(),
            name: name.into(),
            kind: "binary".into(),
            content: None,
            mime: Some("application/pdf".into()),
        });
    }
    let bytes = fs::read(file).map_err(|error| error.to_string())?;
    Ok(FilePreview {
        path: path.into(),
        name: name.into(),
        kind: "pdf".into(),
        content: Some(data_url("application/pdf", &bytes)),
        mime: Some("application/pdf".into()),
    })
}

fn preview_image(file: &Path, path: &str, name: &str, ext: &str) -> Result<FilePreview, String> {
    let meta = fs::metadata(file).map_err(|error| error.to_string())?;
    if meta.len() > 1_500_000 {
        return Ok(FilePreview {
            path: path.into(),
            name: name.into(),
            kind: "binary".into(),
            content: None,
            mime: Some(format!("image/{ext}")),
        });
    }
    let bytes = fs::read(file).map_err(|error| error.to_string())?;
    let mime = match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    Ok(FilePreview {
        path: path.into(),
        name: name.into(),
        kind: "image".into(),
        content: Some(data_url(mime, &bytes)),
        mime: Some(mime.into()),
    })
}

fn data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", standard_base64(bytes))
}

fn standard_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as u32;
        let b = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let c = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (a << 16) | (b << 8) | c;
        out.push(TABLE[((triple >> 18) & 63) as usize] as char);
        out.push(TABLE[((triple >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn should_skip(name: &str) -> bool {
    SKIP.iter().any(|item| *item == name)
}

fn is_image(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico")
}

fn is_text(ext: &str, path: &Path) -> bool {
    if matches!(
        ext,
        "rs" | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "json"
            | "md"
            | "toml"
            | "css"
            | "html"
            | "txt"
            | "py"
            | "sh"
            | "zsh"
            | "yml"
            | "yaml"
            | "lock"
            | "svg"
            | "xml"
            | "csv"
            | "env"
            | "gitignore"
            | "c"
            | "h"
            | "cpp"
            | "go"
            | "java"
            | "kt"
            | "rb"
            | "php"
    ) {
        return true;
    }
    ext.is_empty() && looks_like_text(path)
}

fn looks_like_text(path: &Path) -> bool {
    let Ok(mut file) = fs::File::open(path) else {
        return false;
    };
    let mut buf = [0u8; 256];
    let Ok(read) = file.read(&mut buf) else {
        return false;
    };
    !buf[..read].contains(&0)
}

pub fn watch_dir(app: AppHandle, watch: &FsWatch, path: &str) -> Result<(), String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    let app = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: Result<Event, notify::Error>| {
        let Ok(event) = result else { return };
        let paths: Vec<String> = event
            .paths
            .iter()
            .filter(|item| !ignored_path(item))
            .map(|item| item.to_string_lossy().into_owned())
            .collect();
        if paths.is_empty() {
            return;
        }
        let _ = app.emit("fs://changed", json!({ "paths": paths }));
    })
    .map_err(|error| error.to_string())?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;
    let mut slot = watch.watcher.lock().map_err(|_| "watch lock poisoned")?;
    *slot = Some(watcher);
    Ok(())
}

fn ignored_path(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(
            component.as_os_str().to_str(),
            Some(".git" | "node_modules" | "target" | "dist" | ".preview" | ".DS_Store")
        )
    })
}
