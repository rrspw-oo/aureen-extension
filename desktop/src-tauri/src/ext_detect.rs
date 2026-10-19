#![cfg_attr(not(target_os = "macos"), allow(dead_code))]
//! Knows whether a Chromium browser has the Aureen extension installed and enabled, so the
//! desktop selection toolbar can step aside there (the extension shows its own toolbar).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Profile folders (under ~/Library/Application Support) of browsers that can run the extension.
fn browser_root(app: &str) -> Option<&'static str> {
    Some(match app {
        "Google Chrome" => "Google/Chrome",
        "Google Chrome Canary" => "Google/Chrome Canary",
        "Chromium" => "Chromium",
        "Arc" => "Arc/User Data",
        "Brave Browser" => "BraveSoftware/Brave-Browser",
        "Microsoft Edge" => "Microsoft Edge",
        "Vivaldi" => "Vivaldi",
        "Opera" => "com.operasoftware.Opera",
        _ => return None,
    })
}

fn is_aureen_manifest(dir: &Path) -> bool {
    std::fs::read_to_string(dir.join("manifest.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|m| {
            m.get("name")
                .and_then(|n| n.as_str())
                .map(|n| n.starts_with("Aureen"))
        })
        .unwrap_or(false)
}

fn enabled(entry: &serde_json::Value) -> bool {
    // Newer Chrome: a non-empty "disable_reasons" means disabled; older: "state" 0 = disabled.
    let reasons_ok = match entry.get("disable_reasons") {
        None => true,
        Some(v) => v
            .as_array()
            .map(|a| a.is_empty())
            .unwrap_or_else(|| v.as_i64() == Some(0)),
    };
    let state_ok = entry
        .get("state")
        .and_then(|s| s.as_i64())
        .map(|s| s != 0)
        .unwrap_or(true);
    reasons_ok && state_ok
}

/// Looks through every profile of the browser stored at `root` for an enabled Aureen extension.
pub fn has_aureen_extension_at(root: &Path) -> bool {
    let Ok(profiles) = std::fs::read_dir(root) else {
        return false;
    };
    for profile in profiles.flatten() {
        let dir = profile.path();
        for file in ["Secure Preferences", "Preferences"] {
            let Some(prefs) = std::fs::read_to_string(dir.join(file))
                .ok()
                .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
            else {
                continue;
            };
            let Some(settings) = prefs
                .pointer("/extensions/settings")
                .and_then(|s| s.as_object())
            else {
                continue;
            };
            for (id, entry) in settings {
                if !enabled(entry) {
                    continue;
                }
                let path = entry.get("path").and_then(|p| p.as_str()).unwrap_or("");
                let candidates: Vec<PathBuf> = if Path::new(path).is_absolute() {
                    vec![PathBuf::from(path)] // unpacked ("Load unpacked")
                } else if !path.is_empty() {
                    vec![dir.join("Extensions").join(path)]
                } else {
                    // Store installs: Extensions/<id>/<version>/
                    std::fs::read_dir(dir.join("Extensions").join(id))
                        .map(|vs| vs.flatten().map(|v| v.path()).collect())
                        .unwrap_or_default()
                };
                if candidates.iter().any(|c| is_aureen_manifest(c)) {
                    return true;
                }
            }
        }
    }
    false
}

static CACHE: Mutex<Option<HashMap<String, (bool, Instant)>>> = Mutex::new(None);

/// True when `app` is a browser running the Aureen extension (cached for a minute).
pub fn browser_has_extension(app: &str) -> bool {
    let Some(root) = browser_root(app) else {
        return false;
    };
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let cache = guard.get_or_insert_with(HashMap::new);
    if let Some((value, at)) = cache.get(app) {
        if at.elapsed() < Duration::from_secs(60) {
            return *value;
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    let value = has_aureen_extension_at(
        &Path::new(&home)
            .join("Library/Application Support")
            .join(root),
    );
    cache.insert(app.to_string(), (value, Instant::now()));
    value
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("aureen-ext-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_manifest(dir: &Path, name: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(
            dir.join("manifest.json"),
            format!(r#"{{"name":"{name}","version":"1"}}"#),
        )
        .unwrap();
    }

    #[test]
    fn finds_an_unpacked_extension() {
        let root = temp_root("unpacked");
        let unpacked = root.join("src/Aureen/dist");
        write_manifest(&unpacked, "Aureen - text highlights and region screenshots");
        fs::create_dir_all(root.join("Default")).unwrap();
        fs::write(
            root.join("Default/Secure Preferences"),
            format!(
                r#"{{"extensions":{{"settings":{{"abc":{{"path":"{}","location":4}}}}}}}}"#,
                unpacked.display()
            ),
        )
        .unwrap();
        assert!(has_aureen_extension_at(&root));
    }

    #[test]
    fn finds_a_store_install_and_ignores_other_extensions() {
        let root = temp_root("store");
        write_manifest(
            &root.join("Profile 1/Extensions/xyz/1.0.1_0"),
            "Aureen - text highlights and region screenshots",
        );
        write_manifest(
            &root.join("Profile 1/Extensions/other/2.0_0"),
            "Some other extension",
        );
        fs::write(
            root.join("Profile 1/Preferences"),
            r#"{"extensions":{"settings":{"other":{"state":1},"xyz":{"state":1}}}}"#,
        )
        .unwrap();
        assert!(has_aureen_extension_at(&root));
    }

    #[test]
    fn ignores_a_disabled_extension_or_a_missing_browser() {
        let root = temp_root("disabled");
        write_manifest(&root.join("Default/Extensions/xyz/1.0_0"), "Aureen");
        fs::write(
            root.join("Default/Preferences"),
            r#"{"extensions":{"settings":{"xyz":{"disable_reasons":[1]}}}}"#,
        )
        .unwrap();
        assert!(!has_aureen_extension_at(&root));
        assert!(!has_aureen_extension_at(&root.join("nope")));
    }
}
