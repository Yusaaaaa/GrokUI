use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    pub display_name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliStatus {
    pub installed: bool,
    pub logged_in: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub default_cwd: String,
    pub standalone_dir: String,
    pub account: Option<AccountProfile>,
    pub message: String,
}

pub fn probe(preferred: Option<&str>) -> CliStatus {
    let default_cwd = default_cwd();
    let standalone_dir = standalone_dir();
    let account = account_profile();
    let Some(path) = resolve_binary(preferred) else {
        return CliStatus {
            installed: false,
            logged_in: false,
            path: None,
            version: None,
            default_cwd,
            standalone_dir,
            account,
            message: "Grok CLI was not found".into(),
        };
    };

    let version = read_version(&path);
    let logged_in = is_logged_in(&path);
    CliStatus {
        installed: true,
        logged_in,
        path: Some(path.to_string_lossy().into_owned()),
        version,
        default_cwd,
        standalone_dir,
        account,
        message: if logged_in {
            "Ready".into()
        } else {
            "Grok CLI is installed but you are not signed in".into()
        },
    }
}

pub fn standalone_dir() -> String {
    home_dir()
        .map(|home| home.join("Documents").join("Grok Build").join("Chats"))
        .unwrap_or_else(|| PathBuf::from("/tmp/Grok Build/Chats"))
        .to_string_lossy()
        .into_owned()
}

pub fn ensure_dir(path: &str) -> Result<String, String> {
    fs::create_dir_all(path).map_err(|error| error.to_string())?;
    Ok(path.to_string())
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

fn account_profile() -> Option<AccountProfile> {
    let path = env::var_os("GROK_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".grok")))?
        .join("auth.json");
    let text = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    let records = value.as_object()?;
    for record in records.values() {
        let Some(obj) = record.as_object() else {
            continue;
        };
        let email = obj
            .get("email")
            .and_then(|item| item.as_str())
            .map(str::to_string);
        let first = obj
            .get("first_name")
            .and_then(|item| item.as_str())
            .unwrap_or("");
        let last = obj
            .get("last_name")
            .and_then(|item| item.as_str())
            .unwrap_or("");
        let name = format!("{first} {last}").trim().to_string();
        if email.is_some() || !name.is_empty() {
            return Some(AccountProfile {
                display_name: if name.is_empty() { None } else { Some(name) },
                email,
            });
        }
    }
    None
}

pub fn start_login(preferred: Option<&str>) -> Result<String, String> {
    let path = resolve_binary(preferred).ok_or("Grok CLI was not found")?;
    Command::new(&path)
        .arg("login")
        .spawn()
        .map_err(|error| format!("Failed to start grok login: {error}"))?;
    Ok("Browser login started".into())
}

pub fn resolve_binary(preferred: Option<&str>) -> Option<PathBuf> {
    if let Some(raw) = preferred.map(str::trim).filter(|value| !value.is_empty()) {
        let path = expand_path(raw);
        if let Some(found) = existing_binary(&path) {
            return Some(found);
        }
    }

    let home = env::var_os("HOME").map(PathBuf::from);
    let grok_home = env::var_os("GROK_HOME")
        .map(PathBuf::from)
        .or_else(|| home.as_ref().map(|h| h.join(".grok")));

    let mut candidates = Vec::new();
    if let Some(dir) = grok_home {
        candidates.push(dir.join("bin").join("grok"));
    }
    if let Some(home) = home {
        candidates.push(home.join(".grok").join("bin").join("grok"));
        candidates.push(home.join(".local").join("bin").join("grok"));
    }
    candidates.push(PathBuf::from("/usr/local/bin/grok"));
    candidates.push(PathBuf::from("/opt/homebrew/bin/grok"));

    for path in candidates {
        if let Some(found) = existing_binary(&path) {
            return Some(found);
        }
    }

    find_in_path("grok")
}

fn existing_binary(path: &Path) -> Option<PathBuf> {
    let resolved = if path.is_dir() {
        path.join("grok")
    } else {
        path.to_path_buf()
    };
    let meta = fs::metadata(&resolved).ok()?;
    if meta.is_file() {
        Some(resolved)
    } else {
        None
    }
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for dir in env::split_paths(&path_var) {
        if let Some(found) = existing_binary(&dir.join(name)) {
            return Some(found);
        }
    }
    None
}

fn expand_path(raw: &str) -> PathBuf {
    if let Some(rest) = raw.strip_prefix("~/") {
        if let Some(home) = env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(raw)
}

fn read_version(bin: &Path) -> Option<String> {
    let output = Command::new(bin).arg("--version").output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

fn is_logged_in(bin: &Path) -> bool {
    if env::var_os("XAI_API_KEY").is_some() {
        return true;
    }
    if auth_file_present() {
        return true;
    }
    let output = Command::new(bin)
        .arg("models")
        .output();
    match output {
        Ok(out) => {
            let text = format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            let lower = text.to_lowercase();
            out.status.success()
                && (lower.contains("logged in")
                    || lower.contains("available models")
                    || lower.contains("grok-"))
                && !lower.contains("not logged")
                && !lower.contains("sign in")
        }
        Err(_) => false,
    }
}

fn auth_file_present() -> bool {
    let path = env::var_os("GROK_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".grok")))
        .map(|dir| dir.join("auth.json"));
    path.and_then(|p| fs::metadata(p).ok())
        .is_some_and(|meta| meta.is_file() && meta.len() > 2)
}

pub fn default_cwd() -> String {
    let home = env::var_os("HOME").map(PathBuf::from);
    let candidates = [
        home.as_ref().map(|h| h.join("GrokWorkSpace")),
        Some(PathBuf::from("/Users/yusa/GrokWorkSpace/GrokUI")),
        Some(PathBuf::from("/Users/yusa/GrokWorkSpace")),
        home,
    ];
    for path in candidates.into_iter().flatten() {
        if path.is_dir() {
            return path.to_string_lossy().into_owned();
        }
    }
    env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "/".into())
}


