//! macOS glue built on stock command-line tools (osascript, screencapture, pbcopy/pbpaste),
//! so it needs no extra native bindings. Keystrokes and window geometry go through
//! System Events, which requires the Accessibility permission.

use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use image::RgbaImage;

pub const ACCESSIBILITY_HINT: &str =
    "需要「輔助使用」權限:系統設定 → 隱私權與安全性 → 輔助使用,開啟後完全結束並重開 App(開發時是你用的終端機)。";

fn stamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub fn osascript(script: &str) -> Result<String, String> {
    let out = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("osascript failed to start: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout)
            .trim_end_matches('\n')
            .to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).to_string();
        // -1719 / -25211 / 1002: not allowed to use assistive access or send keystrokes.
        if err.contains("-1719")
            || err.contains("-25211")
            || err.contains("1002")
            || err.contains("assistive")
        {
            Err(ACCESSIBILITY_HINT.to_string())
        } else {
            Err(err.trim().to_string())
        }
    }
}

fn applescript_string(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

fn pb_read() -> String {
    Command::new("/usr/bin/pbpaste")
        .env("LANG", "en_US.UTF-8")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

fn pb_write(text: &str) {
    if let Ok(mut child) = Command::new("/usr/bin/pbcopy")
        .env("LANG", "en_US.UTF-8")
        .stdin(Stdio::piped())
        .spawn()
    {
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(text.as_bytes());
        }
        let _ = child.wait();
    }
}

pub fn frontmost_app() -> Result<String, String> {
    osascript(
        r#"tell application "System Events" to get name of first application process whose frontmost is true"#,
    )
}

const CHROMIUM_BROWSERS: &[&str] = &[
    "Google Chrome",
    "Google Chrome Canary",
    "Arc",
    "Brave Browser",
    "Microsoft Edge",
    "Vivaldi",
    "Opera",
    "Chromium",
];

/// URL and title of the active tab when `app` is a scriptable browser.
pub fn browser_tab(app: &str) -> Option<(String, String)> {
    let script = if app == "Safari" || app == "Safari Technology Preview" {
        format!(
            "tell application {} to return (URL of current tab of front window) & linefeed & (name of current tab of front window)",
            applescript_string(app)
        )
    } else if CHROMIUM_BROWSERS.contains(&app) {
        format!(
            "tell application {} to return (URL of active tab of front window) & linefeed & (title of active tab of front window)",
            applescript_string(app)
        )
    } else {
        return None;
    };
    let out = osascript(&script).ok()?;
    let (url, title) = out.split_once('\n')?;
    url.starts_with("http")
        .then(|| (url.to_string(), title.to_string()))
}

fn window_title_of(app: &str) -> Option<String> {
    osascript(&format!(
        "tell application \"System Events\" to tell process {} to get name of front window",
        applescript_string(app)
    ))
    .ok()
    .filter(|s| !s.is_empty())
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const BROWSERS_WITHOUT_AX_TEXT: &[&str] =
    &["Firefox", "Firefox Developer Edition", "Zen Browser"];

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
/// Whether `app` is a browser (where ⌘C is a safe fallback for reading the selection).
pub fn is_browser(app: &str) -> bool {
    app.starts_with("Safari")
        || CHROMIUM_BROWSERS.contains(&app)
        || BROWSERS_WITHOUT_AX_TEXT.contains(&app)
}

/// Where a selection in `app` came from: the browser tab, or the app and its window title.
pub fn source_of(app: &str) -> (String, String) {
    browser_tab(app).unwrap_or_else(|| {
        let title = window_title_of(app).unwrap_or_else(|| app.to_string());
        (
            format!("aureen-app://{}", app.replace(' ', "%20")),
            if title == app {
                app.to_string()
            } else {
                format!("{app} · {title}")
            },
        )
    })
}

/// Reads the frontmost app's selection by sending ⌘C, then puts the user's text clipboard back.
pub fn copy_selection_text() -> Result<Option<String>, String> {
    let saved = pb_read();
    let marker = format!("__aureen_selection_{}__", stamp());
    pb_write(&marker);

    let sent = osascript(r#"tell application "System Events" to keystroke "c" using command down"#);
    let mut text = marker.clone();
    if sent.is_ok() {
        for _ in 0..12 {
            sleep(Duration::from_millis(80));
            text = pb_read();
            if text != marker {
                break;
            }
        }
    }
    // Restore the previous text clipboard (when it held text).
    if !saved.is_empty() {
        pb_write(&saved);
    }
    sent?;
    Ok((text != marker && !text.trim().is_empty()).then(|| text.trim().to_string()))
}

pub struct Selection {
    pub text: String,
    pub url: String,
    pub page_title: String,
}

/// Copies the current selection of the frontmost app (⌘C) for the ⌘⇧1 shortcut.
pub fn grab_selection() -> Result<Selection, String> {
    let app = frontmost_app()?;
    let text = copy_selection_text()?
        .ok_or_else(|| "沒有讀到選取的文字。請先選取一段文字,再按 ⌘⇧1。".to_string())?;
    let (url, page_title) = source_of(&app);
    Ok(Selection {
        text,
        url,
        page_title,
    })
}

/// Unix pid of the frontmost app.
pub fn frontmost_pid() -> Option<i32> {
    #[cfg(target_os = "macos")]
    if let Some(pid) = crate::selection_watch::frontmost_pid() {
        return Some(pid);
    }
    osascript(r#"tell application "System Events" to get unix id of first application process whose frontmost is true"#)
        .ok()
        .and_then(|v| v.trim().parse().ok())
}

/// Name of the app process with `pid`.
pub fn app_name_of(pid: i32) -> Option<String> {
    osascript(&format!(
        r#"tell application "System Events" to get name of first application process whose unix id is {pid}"#
    ))
    .ok()
    .filter(|s| !s.is_empty())
}

/// Brings the app with `pid` to the front (so keystrokes such as Page Down reach it).
pub fn activate_pid(pid: i32) {
    let _ = osascript(&format!(
        r#"tell application "System Events" to set frontmost of (first application process whose unix id is {pid}) to true"#
    ));
}

/// The window a full-page capture works on.
pub struct Target {
    pub pid: i32,
    /// CGWindowID, so frames show just that window (Aureen's own bar never ends up in them).
    pub window_id: Option<u32>,
    /// Frame in screen points: fallback capture area and where to put the bar.
    pub rect: (i64, i64, i64, i64),
}

/// Frontmost window as (x, y, width, height) in screen points.
fn front_window_bounds() -> Result<(i64, i64, i64, i64), String> {
    let out = osascript(
        r#"tell application "System Events"
  tell (first application process whose frontmost is true)
    set {x, y} to position of front window
    set {w, h} to size of front window
  end tell
end tell
return (x as text) & "," & (y as text) & "," & (w as text) & "," & (h as text)"#,
    )?;
    let nums: Vec<i64> = out
        .split(',')
        .filter_map(|v| v.trim().parse::<f64>().ok())
        .map(|v| v as i64)
        .collect();
    match nums.as_slice() {
        [x, y, w, h] if *w > 0 && *h > 0 => Ok((*x, *y, *w, *h)),
        _ => Err(format!("無法取得視窗位置:{out}")),
    }
}

/// Front-most normal window (layer 0) owned by `pid`; the window list is ordered front to back.
#[cfg(target_os = "macos")]
fn front_window_id(pid: i32) -> Option<u32> {
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowLayer, kCGWindowListExcludeDesktopElements,
        kCGWindowListOptionOnScreenOnly, kCGWindowNumber, kCGWindowOwnerPID,
    };

    let list = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )?;
    let (owner_key, layer_key, number_key) = unsafe {
        (
            CFString::wrap_under_get_rule(kCGWindowOwnerPID),
            CFString::wrap_under_get_rule(kCGWindowLayer),
            CFString::wrap_under_get_rule(kCGWindowNumber),
        )
    };
    let number = |dict: &CFDictionary<CFString, CFType>, key: &CFString| -> Option<i64> {
        dict.find(key)
            .and_then(|v| v.downcast::<CFNumber>())
            .and_then(|n| n.to_i64())
    };
    for item in list.iter() {
        let dict: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(*item as CFDictionaryRef) };
        if number(&dict, &owner_key) == Some(pid as i64) && number(&dict, &layer_key) == Some(0) {
            return number(&dict, &number_key).map(|n| n as u32);
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn front_window_id(_pid: i32) -> Option<u32> {
    None
}

/// Picks the frontmost window as the full-page capture target.
pub fn front_target() -> Result<Target, String> {
    let pid = frontmost_pid().ok_or_else(|| ACCESSIBILITY_HINT.to_string())?;
    let rect = front_window_bounds()?;
    Ok(Target {
        pid,
        window_id: front_window_id(pid),
        rect,
    })
}

pub fn capture_target(target: &Target) -> Result<RgbaImage, String> {
    let path = std::env::temp_dir().join(format!("aureen-frame-{}.png", stamp()));
    let mut cmd = Command::new("/usr/sbin/screencapture");
    cmd.args(["-x", "-t", "png"]);
    match target.window_id {
        Some(id) => cmd.args(["-o", "-l"]).arg(id.to_string()),
        None => {
            let (x, y, w, h) = target.rect;
            cmd.arg(format!("-R{x},{y},{w},{h}"))
        }
    };
    let status = cmd.arg(&path).status().map_err(|e| e.to_string())?;
    if !status.success() || !path.exists() {
        return Err("截圖失敗(請確認「螢幕錄製」權限)".into());
    }
    let img = image::open(&path).map_err(|e| e.to_string())?.to_rgba8();
    let _ = std::fs::remove_file(&path);
    Ok(img)
}

fn key_code(code: u32) -> Result<(), String> {
    osascript(&format!(
        r#"tell application "System Events" to key code {code}"#
    ))
    .map(|_| ())
}

const MAX_FRAMES: usize = 40;

/// Scrolls the target window from the top with Page Down, capturing it after every step.
/// Stops when the content stops moving, when `end` (the view the user chose with
/// "Capture to here") comes within reach, when `stop` is set, or after `MAX_FRAMES`.
pub fn capture_scrolling(
    target: &Target,
    end: Option<RgbaImage>,
    stop: &AtomicBool,
    on_frame: impl Fn(usize),
) -> Result<Vec<RgbaImage>, String> {
    activate_pid(target.pid);
    sleep(Duration::from_millis(250));
    key_code(115)?; // Home
    sleep(Duration::from_millis(500));

    let mut frames: Vec<RgbaImage> = Vec::new();
    loop {
        let frame = capture_target(target)?;
        if frames
            .last()
            .is_some_and(|prev| crate::stitch::frames_identical(prev, &frame))
        {
            break; // reached the end of the page
        }
        if let Some(end) = &end {
            if crate::stitch::continues_into(&frame, end) {
                frames.push(frame);
                frames.push(end.clone());
                on_frame(frames.len());
                break;
            }
        }
        frames.push(frame);
        on_frame(frames.len());
        if stop.load(Ordering::SeqCst) || frames.len() >= MAX_FRAMES {
            break;
        }
        key_code(121)?; // Page Down
        sleep(Duration::from_millis(450));
    }
    Ok(frames)
}
