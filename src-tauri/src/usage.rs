use crate::sessions;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayUsage {
    pub date: String,
    pub day: u32,
    pub input: u64,
    pub output: u64,
    pub reasoning: u64,
    pub cache_read: u64,
    pub total: u64,
    pub turns: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthUsage {
    pub year: i32,
    pub month: u32,
    pub input: u64,
    pub output: u64,
    pub reasoning: u64,
    pub cache_read: u64,
    pub total: u64,
    pub turns: u32,
    pub days: Vec<DayUsage>,
}

pub fn month_usage(year: Option<i32>, month: Option<u32>) -> Result<MonthUsage, String> {
    let (year, month) = match (year, month) {
        (Some(y), Some(m)) if (1..=12).contains(&m) => (y, m),
        _ => local_year_month(),
    };
    let days_in_month = days_in_month(year, month);
    let mut by_day: BTreeMap<u32, DayUsage> = (1..=days_in_month)
        .map(|day| {
            (
                day,
                DayUsage {
                    date: format!("{year:04}-{month:02}-{day:02}"),
                    day,
                    input: 0,
                    output: 0,
                    reasoning: 0,
                    cache_read: 0,
                    total: 0,
                    turns: 0,
                },
            )
        })
        .collect();

    let root = sessions::sessions_root();
    if root.is_dir() {
        scan_dir(&root, year, month, &mut by_day);
    }

    let days: Vec<DayUsage> = by_day.into_values().collect();
    let mut summary = MonthUsage {
        year,
        month,
        input: 0,
        output: 0,
        reasoning: 0,
        cache_read: 0,
        total: 0,
        turns: 0,
        days,
    };
    for day in &summary.days {
        summary.input += day.input;
        summary.output += day.output;
        summary.reasoning += day.reasoning;
        summary.cache_read += day.cache_read;
        summary.total += day.total;
        summary.turns += day.turns;
    }
    Ok(summary)
}

fn scan_dir(
    dir: &std::path::Path,
    year: i32,
    month: u32,
    by_day: &mut BTreeMap<u32, DayUsage>,
) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir(&path, year, month, by_day);
            continue;
        }
        if path.file_name().and_then(|name| name.to_str()) != Some("updates.jsonl") {
            continue;
        }
        consume_updates(&path, year, month, by_day);
    }
}

fn consume_updates(
    path: &std::path::Path,
    year: i32,
    month: u32,
    by_day: &mut BTreeMap<u32, DayUsage>,
) {
    let Ok(file) = File::open(path) else {
        return;
    };
    for line in BufReader::new(file).lines().map_while(Result::ok) {
        if !line.contains("turn_completed") || !line.contains("usage") {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let update = value
            .pointer("/params/update")
            .cloned()
            .unwrap_or(Value::Null);
        if update.get("sessionUpdate").and_then(Value::as_str) != Some("turn_completed") {
            continue;
        }
        let Some(day) = event_day(&value, year, month) else {
            continue;
        };
        let usage = update.get("usage").cloned().unwrap_or(Value::Null);
        if let Some(row) = by_day.get_mut(&day) {
            row.input += as_u64(&usage, "inputTokens");
            row.output += as_u64(&usage, "outputTokens");
            row.reasoning += as_u64(&usage, "reasoningTokens");
            row.cache_read += as_u64(&usage, "cachedReadTokens");
            row.total += as_u64(&usage, "totalTokens");
            row.turns += 1;
        }
    }
}

fn event_day(value: &Value, year: i32, month: u32) -> Option<u32> {
    let ms = value
        .pointer("/params/_meta/agentTimestampMs")
        .and_then(Value::as_u64);
    let secs = ms
        .map(|value| value / 1000)
        .or_else(|| value.get("timestamp").and_then(Value::as_u64))?;
    let (y, m, d) = civil_date(secs)?;
    if y == year && m == month {
        Some(d)
    } else {
        None
    }
}

fn as_u64(value: &Value, key: &str) -> u64 {
    value
        .get(key)
        .and_then(Value::as_u64)
        .or_else(|| value.get(key).and_then(Value::as_i64).map(|n| n.max(0) as u64))
        .unwrap_or(0)
}

fn local_year_month() -> (i32, u32) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    civil_date(secs)
        .map(|(y, m, _)| (y, m))
        .unwrap_or((2026, 8))
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(year) => 29,
        2 => 28,
        _ => 31,
    }
}

fn is_leap(year: i32) -> bool {
    year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
}

fn civil_date(unix_secs: u64) -> Option<(i32, u32, u32)> {
    let offset = local_offset_secs();
    let adjusted = i64::try_from(unix_secs).ok()?.saturating_add(offset);
    if adjusted < 0 {
        return None;
    }
    let days = adjusted / 86_400;
    let z = days + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    Some((y as i32, m as u32, d as u32))
}

fn local_offset_secs() -> i64 {
    let now = SystemTime::now();
    let unix = now.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) as i64;
    let local = chrono_naive_offset(unix);
    local.unwrap_or(0)
}

fn chrono_naive_offset(unix: i64) -> Option<i64> {
    // libc localtime: tm_gmtoff is available on macOS.
    unsafe {
        let mut t = unix;
        let tm = libc::localtime(&mut t);
        if tm.is_null() {
            return None;
        }
        Some((*tm).tm_gmtoff)
    }
}
