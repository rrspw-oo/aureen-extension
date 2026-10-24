mod ext_detect;
mod mac;
#[cfg(target_os = "macos")]
mod selection_watch;
mod stitch;

use base64::Engine;
use serde::Serialize;
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU8, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const PANEL_LABEL: &str = "panel";
const TOOLBAR_LABEL: &str = "toolbar";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const TOOLBAR_SIZE: (f64, f64) = (300.0, 56.0);
const FULLBAR_LABEL: &str = "fullbar";
const FULLBAR_SIZE: (f64, f64) = (640.0, 84.0);

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// True when this process (in dev: the terminal app that launched it) may record the screen.
/// When it may not, asks macOS to show the permission prompt.
#[cfg(target_os = "macos")]
fn ensure_screen_access() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() }
}

#[cfg(not(target_os = "macos"))]
fn ensure_screen_access() -> bool {
    true
}

/// Runs macOS's built-in region picker (`screencapture -i`) and returns the PNG as a data URL.
/// `Ok(None)` means the user pressed Esc.
fn capture_region() -> Result<Option<String>, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = std::env::temp_dir().join(format!("aureen-{stamp}.png"));

    let status = Command::new("/usr/sbin/screencapture")
        .args(["-i", "-x"])
        .arg(&path)
        .status()
        .map_err(|e| format!("screencapture failed to start: {e}"))?;

    if !path.exists() {
        // Esc (or a click without dragging) leaves no file; that is a cancel, not an error.
        let _ = status;
        return Ok(None);
    }

    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(Some(format!("data:image/png;base64,{encoded}")))
}

fn place_panel_under(app: &AppHandle, tray_pos: PhysicalPosition<f64>, tray_size: (f64, f64)) {
    let Some(panel) = app.get_webview_window(PANEL_LABEL) else {
        return;
    };
    let scale = panel.scale_factor().unwrap_or(1.0);
    let width = panel
        .outer_size()
        .map(|s| s.width as f64)
        .unwrap_or(420.0 * scale);
    let mut x = tray_pos.x + tray_size.0 / 2.0 - width / 2.0;
    let y = tray_pos.y + tray_size.1 + 4.0 * scale;

    if let Ok(Some(monitor)) = panel.current_monitor() {
        let left = monitor.position().x as f64;
        let right = left + monitor.size().width as f64;
        x = x.clamp(left + 8.0 * scale, right - width - 8.0 * scale);
    }
    let _ = panel.set_position(PhysicalPosition::new(x, y));
}

fn show_panel(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window(PANEL_LABEL) {
        let _ = panel.show();
        let _ = panel.set_focus();
    }
}

fn hide_panel_window(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window(PANEL_LABEL) {
        let _ = panel.hide();
    }
}

/// The app the user was in before opening the panel (to hand focus back to it).
static LAST_EXTERNAL_PID: AtomicI32 = AtomicI32::new(0);

fn remember_frontmost_app() {
    if let Some(pid) = mac::frontmost_pid() {
        if pid != std::process::id() as i32 {
            LAST_EXTERNAL_PID.store(pid, Ordering::SeqCst);
        }
    }
}

/// Makes the window the user was working in frontmost again (when the action started from
/// the panel), and waits for the shortcut's modifier keys to be released.
fn give_focus_back(app: &AppHandle) {
    hide_panel_window(app);
    // Started from the panel or the floating button: Aureen is frontmost, hand focus back.
    let own = std::process::id() as i32;
    let pid = LAST_EXTERNAL_PID.load(Ordering::SeqCst);
    if mac::frontmost_pid() == Some(own) && pid > 0 {
        mac::activate_pid(pid);
    }
    std::thread::sleep(std::time::Duration::from_millis(450));
}

// ---- Floating button (the extension's FAB, on the desktop) ----

const FAB_LABEL: &str = "fab";
const FAB_SIZE: f64 = 64.0;
const FAB_MENU_SIZE: (f64, f64) = (230.0, 64.0 + 4.0 * 52.0);

/// Top-left of the collapsed button in screen points.
static FAB_ORIGIN: Mutex<Option<(f64, f64)>> = Mutex::new(None);
static FAB_HIDDEN: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Clone)]
struct FabLayout {
    up: bool,
    left: bool,
}

fn fab_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window(FAB_LABEL)
}

fn fab_origin(app: &AppHandle) -> (f64, f64) {
    if let Some(origin) = *FAB_ORIGIN.lock().unwrap_or_else(|e| e.into_inner()) {
        return origin;
    }
    // First launch: bottom-right corner of the main screen, like the extension's default.
    let monitor = fab_window(app).and_then(|w| w.primary_monitor().ok().flatten());
    match monitor {
        Some(m) => {
            let scale = m.scale_factor();
            let size = m.size().to_logical::<f64>(scale);
            let pos = m.position().to_logical::<f64>(scale);
            (
                pos.x + size.width - FAB_SIZE - 28.0,
                pos.y + size.height - FAB_SIZE - 90.0,
            )
        }
        None => (1200.0, 700.0),
    }
}

fn show_fab(app: &AppHandle) {
    if FAB_HIDDEN.load(Ordering::SeqCst) || PAUSED.load(Ordering::SeqCst) {
        return;
    }
    let Some(fab) = fab_window(app) else { return };
    let (x, y) = fab_origin(app);
    let _ = fab.set_size(LogicalSize::new(FAB_SIZE, FAB_SIZE));
    let _ = fab.set_position(LogicalPosition::new(x, y));
    let _ = fab.show();
    let _ = app.emit_to(FAB_LABEL, "fab-collapse", ());
}

fn hide_fab_window(app: &AppHandle) {
    if let Some(fab) = fab_window(app) {
        let _ = fab.hide();
    }
}

/// Remembers where the user dragged the (collapsed) button.
fn store_fab_origin(app: &AppHandle) {
    let Some(fab) = fab_window(app) else { return };
    let (Ok(pos), Ok(scale)) = (fab.outer_position(), fab.scale_factor()) else {
        return;
    };
    let size = fab.outer_size().map(|s| s.to_logical::<f64>(scale));
    if size.map(|s| s.width > FAB_SIZE + 1.0).unwrap_or(false) {
        return; // expanded: the origin is unchanged
    }
    let p = pos.to_logical::<f64>(scale);
    *FAB_ORIGIN.lock().unwrap_or_else(|e| e.into_inner()) = Some((p.x, p.y));
}

/// Grows the button's window into a menu toward the inside of the screen (or shrinks it back),
/// keeping the button itself where it is. Returns which way the menu opens.
#[tauri::command]
fn fab_set_expanded(app: AppHandle, expanded: bool) -> FabLayout {
    let Some(fab) = fab_window(&app) else {
        return FabLayout {
            up: true,
            left: true,
        };
    };
    if expanded {
        store_fab_origin(&app);
    }
    let (x, y) = fab_origin(&app);
    let (mid_x, mid_y) = fab
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let scale = m.scale_factor();
            let size = m.size().to_logical::<f64>(scale);
            let pos = m.position().to_logical::<f64>(scale);
            (pos.x + size.width / 2.0, pos.y + size.height / 2.0)
        })
        .unwrap_or((x, y));
    let layout = FabLayout {
        up: y > mid_y,
        left: x > mid_x,
    };
    if expanded {
        let (w, h) = FAB_MENU_SIZE;
        let left = if layout.left { x + FAB_SIZE - w } else { x };
        let top = if layout.up { y + FAB_SIZE - h } else { y };
        let _ = fab.set_size(LogicalSize::new(w, h));
        let _ = fab.set_position(LogicalPosition::new(left, top));
    } else {
        let _ = fab.set_size(LogicalSize::new(FAB_SIZE, FAB_SIZE));
        let _ = fab.set_position(LogicalPosition::new(x, y));
    }
    layout
}

/// The button was dragged: remember its new place.
#[tauri::command]
fn fab_moved(app: AppHandle) {
    store_fab_origin(&app);
}

/// Floating menu → "Open panel": the panel opens next to the button.
#[tauri::command]
fn open_panel_from_fab(app: AppHandle) {
    let (fx, fy) = fab_origin(&app);
    if let Some(panel) = app.get_webview_window(PANEL_LABEL) {
        if !PANEL_PINNED.load(Ordering::SeqCst) {
            let scale = panel.scale_factor().unwrap_or(1.0);
            let size = panel
                .outer_size()
                .map(|s| s.to_logical::<f64>(scale))
                .map(|s| (s.width, s.height))
                .unwrap_or((400.0, 640.0));
            let mid_x = panel
                .current_monitor()
                .ok()
                .flatten()
                .map(|m| {
                    let s = m.scale_factor();
                    m.position().to_logical::<f64>(s).x + m.size().to_logical::<f64>(s).width / 2.0
                })
                .unwrap_or(fx);
            let x = if fx > mid_x {
                fx - size.0 - 8.0
            } else {
                fx + FAB_SIZE + 8.0
            };
            let y = (fy + FAB_SIZE - size.1).max(30.0);
            let _ = panel.set_position(LogicalPosition::new(x, y));
        }
    }
    show_panel(&app);
}

/// Floating menu → "Hide": until it is shown again from the menu bar.
#[tauri::command]
fn hide_fab(app: AppHandle) {
    FAB_HIDDEN.store(true, Ordering::SeqCst);
    hide_fab_window(&app);
    update_fab_menu_item(&app);
}

struct FabMenuItem(MenuItem<Wry>);

fn update_fab_menu_item(app: &AppHandle) {
    if let Some(item) = app.try_state::<FabMenuItem>() {
        let hidden = FAB_HIDDEN.load(Ordering::SeqCst);
        let _ = item.0.set_text(if hidden {
            "顯示浮動按鈕"
        } else {
            "隱藏浮動按鈕"
        });
    }
}

fn toggle_panel(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window(PANEL_LABEL) {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.hide();
        } else {
            show_panel(app);
        }
    }
}

fn report_error(app: &AppHandle, message: impl Into<String>) {
    show_panel(app);
    let _ = app.emit("capture-error", message.into());
}

const SCREEN_HINT: &str = "需要「螢幕錄製」權限:系統設定 → 隱私權與安全性 → 螢幕與系統錄音,開啟後完全結束並重開 App(開發時是你用的終端機)。";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CapturePayload {
    image_data: String,
    /// Browser tab URL, `aureen-app://<App>` for other apps, empty when unknown.
    url: String,
    page_title: String,
}

/// Where a capture comes from: the frontmost app (or, when that is Aureen's own panel,
/// the app the user was in before opening it).
fn current_source() -> (String, String) {
    let own = std::process::id() as i32;
    let pid = match mac::frontmost_pid() {
        Some(pid) if pid != own => pid,
        _ => LAST_EXTERNAL_PID.load(Ordering::SeqCst),
    };
    source_of_pid(pid)
}

fn source_of_pid(pid: i32) -> (String, String) {
    if pid <= 0 {
        return (String::new(), String::new());
    }
    mac::app_name_of(pid)
        .map(|name| mac::source_of(&name))
        .unwrap_or_default()
}

fn start_capture_flow(app: AppHandle) {
    // The picker blocks until the user finishes, so keep it off the event loop thread.
    std::thread::spawn(move || {
        hide_panel_window(&app);
        if !ensure_screen_access() {
            report_error(&app, SCREEN_HINT);
            return;
        }
        let (url, page_title) = current_source();
        hide_fab_window(&app);
        let result = capture_region();
        show_fab(&app);
        match result {
            Ok(Some(image_data)) => {
                show_panel(&app);
                let _ = app.emit(
                    "capture-ready",
                    CapturePayload {
                        image_data,
                        url,
                        page_title,
                    },
                );
            }
            Ok(None) => {}
            Err(message) => report_error(&app, message),
        }
    });
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct HighlightPayload {
    text: String,
    url: String,
    page_title: String,
    color: Option<String>,
    focus_note: bool,
}

/// ⌘⇧1: saves the text selected in any app as a highlight (the desktop "highlight" action).
fn start_selection_flow(app: AppHandle) {
    std::thread::spawn(move || {
        give_focus_back(&app);
        match mac::grab_selection() {
            Ok(sel) => {
                show_panel(&app);
                let _ = app.emit(
                    "highlight-ready",
                    HighlightPayload {
                        text: sel.text,
                        url: sel.url,
                        page_title: sel.page_title,
                        color: None,
                        focus_note: false,
                    },
                );
            }
            Err(message) => report_error(&app, message),
        }
    });
}

// ---- Selection toolbar (the extension's floating highlight toolbar, for any app) ----

/// Text and source app of the selection the toolbar is showing for.
static PENDING_SELECTION: Mutex<Option<(String, String)>> = Mutex::new(None);
/// Toolbar frame in screen points while it is visible.
static TOOLBAR_RECT: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn show_toolbar(app: &AppHandle, text: String, source_app: String, x: f64, y: f64) {
    let Some(toolbar) = app.get_webview_window(TOOLBAR_LABEL) else {
        return;
    };
    let (w, h) = TOOLBAR_SIZE;
    let left = (x - w / 2.0).max(4.0);
    // Above the release point, or below it when that would leave the screen.
    let top = if y - h - 14.0 >= 28.0 {
        y - h - 14.0
    } else {
        y + 18.0
    };
    *PENDING_SELECTION.lock().unwrap_or_else(|e| e.into_inner()) = Some((text, source_app));
    *TOOLBAR_RECT.lock().unwrap_or_else(|e| e.into_inner()) = Some((left, top, w, h));
    let _ = toolbar.set_position(LogicalPosition::new(left, top));
    let _ = toolbar.show();
    let _ = app.emit_to(TOOLBAR_LABEL, "toolbar-show", ());
}

fn hide_toolbar(app: &AppHandle) {
    *TOOLBAR_RECT.lock().unwrap_or_else(|e| e.into_inner()) = None;
    if let Some(toolbar) = app.get_webview_window(TOOLBAR_LABEL) {
        let _ = toolbar.hide();
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
/// A press outside the toolbar dismisses it, like clicking elsewhere on a web page.
fn dismiss_toolbar_if_outside(app: &AppHandle, x: f64, y: f64) {
    let rect = *TOOLBAR_RECT.lock().unwrap_or_else(|e| e.into_inner());
    if let Some((left, top, w, h)) = rect {
        if x < left || x > left + w || y < top || y > top + h {
            hide_toolbar(app);
        }
    }
}

/// Toolbar button: open the highlight form for the pending selection (color, or note first).
#[tauri::command]
fn toolbar_pick(app: AppHandle, color: String, focus_note: bool) {
    let pending = PENDING_SELECTION
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    hide_toolbar(&app);
    let Some((text, source_app)) = pending else {
        return;
    };
    std::thread::spawn(move || {
        let (url, page_title) = mac::source_of(&source_app);
        show_panel(&app);
        let _ = app.emit(
            "highlight-ready",
            HighlightPayload {
                text,
                url,
                page_title,
                color: Some(color),
                focus_note,
            },
        );
    });
}

// ---- Pause / resume ----

static PAUSED: AtomicBool = AtomicBool::new(false);

struct PauseMenuItem(MenuItem<Wry>);

fn set_paused_state(app: &AppHandle, paused: bool) {
    PAUSED.store(paused, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    selection_watch::ENABLED.store(!paused, Ordering::SeqCst);
    if paused {
        let _ = app.global_shortcut().unregister_all();
        hide_toolbar(app);
        hide_fab_window(app);
    } else {
        register_shortcuts(app);
        show_fab(app);
    }
    if let Some(item) = app.try_state::<PauseMenuItem>() {
        let _ = item.0.set_text(if paused {
            "啟用 Aureen"
        } else {
            "暫停 Aureen"
        });
    }
    if let Some(tray) = app.tray_by_id("aureen") {
        let _ = tray.set_tooltip(Some(if paused {
            "Aureen(已暫停)"
        } else {
            "Aureen"
        }));
        let _ = tray.set_title(if paused { Some("Ⅱ") } else { None });
    }
    let _ = app.emit("paused-changed", paused);
}

#[tauri::command]
fn set_paused(app: AppHandle, paused: bool) {
    set_paused_state(&app, paused);
}

#[tauri::command]
fn is_paused() -> bool {
    PAUSED.load(Ordering::SeqCst)
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ---- Panel position ----

/// Set once the user drags the panel away: it then stays where they put it and no longer
/// closes when it loses focus, until "Dock panel under the icon" is chosen.
static PANEL_PINNED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn pin_panel() {
    PANEL_PINNED.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn dock_panel(app: AppHandle) {
    PANEL_PINNED.store(false, Ordering::SeqCst);
    hide_panel_window(&app);
}

// ---- Full-page capture (the extension's "Capture to here / Whole page / Cancel" bar) ----

const PHASE_IDLE: u8 = 0;
const PHASE_CHOOSING: u8 = 1;
const PHASE_RUNNING: u8 = 2;

static FULL_PAGE_PHASE: AtomicU8 = AtomicU8::new(PHASE_IDLE);
static FULL_PAGE_STOP: AtomicBool = AtomicBool::new(false);
static FULL_PAGE_CANCEL: AtomicBool = AtomicBool::new(false);
static FULL_PAGE_TARGET: Mutex<Option<mac::Target>> = Mutex::new(None);

#[derive(Serialize, Clone)]
struct FullBarState {
    phase: &'static str,
    count: usize,
}

fn escape_shortcut() -> Shortcut {
    Shortcut::new(None, Code::Escape)
}

fn show_fullbar(app: &AppHandle, rect: (i64, i64, i64, i64)) {
    let Some(bar) = app.get_webview_window(FULLBAR_LABEL) else {
        return;
    };
    let (x, y, w, _) = rect;
    let (bw, bh) = FULLBAR_SIZE;
    let left = (x as f64 + w as f64 / 2.0 - bw / 2.0).max(4.0);
    // Above the window when there is room, otherwise over its top edge (frames are taken of
    // the window alone, so the bar never shows up in them).
    let top = if y as f64 - bh - 8.0 >= 28.0 {
        y as f64 - bh - 8.0
    } else {
        y as f64 + 8.0
    };
    let _ = bar.set_position(LogicalPosition::new(left, top));
    let _ = bar.show();
}

fn set_fullbar_state(app: &AppHandle, phase: &'static str, count: usize) {
    let _ = app.emit_to(
        FULLBAR_LABEL,
        "fullbar-state",
        FullBarState { phase, count },
    );
}

fn finish_full_page(app: &AppHandle) {
    let _ = app.global_shortcut().unregister(escape_shortcut());
    if let Some(bar) = app.get_webview_window(FULLBAR_LABEL) {
        let _ = bar.hide();
    }
    *FULL_PAGE_TARGET.lock().unwrap_or_else(|e| e.into_inner()) = None;
    FULL_PAGE_PHASE.store(PHASE_IDLE, Ordering::SeqCst);
}

/// ⌘⇧9: shows the bar; the user scrolls to where the capture should end and picks
/// "Capture to here", or "Whole page". Pressing ⌘⇧9 again means "Capture to here".
fn start_full_page_flow(app: AppHandle) {
    match FULL_PAGE_PHASE.load(Ordering::SeqCst) {
        PHASE_CHOOSING => return full_page_choice(app, "here".into()),
        PHASE_RUNNING => return full_page_choice(app, "stop".into()),
        _ => {}
    }
    FULL_PAGE_PHASE.store(PHASE_CHOOSING, Ordering::SeqCst);
    std::thread::spawn(move || {
        give_focus_back(&app);
        if !ensure_screen_access() {
            FULL_PAGE_PHASE.store(PHASE_IDLE, Ordering::SeqCst);
            report_error(&app, SCREEN_HINT);
            return;
        }
        let target = match mac::front_target() {
            Ok(t) => t,
            Err(message) => {
                FULL_PAGE_PHASE.store(PHASE_IDLE, Ordering::SeqCst);
                report_error(&app, message);
                return;
            }
        };
        let rect = target.rect;
        *FULL_PAGE_TARGET.lock().unwrap_or_else(|e| e.into_inner()) = Some(target);
        let _ = app.global_shortcut().register(escape_shortcut());
        show_fullbar(&app, rect);
        set_fullbar_state(&app, "choose", 0);
    });
}

/// Bar buttons: "here" | "whole" | "cancel" while choosing, "stop" | "cancel" while capturing.
#[tauri::command]
fn full_page_choice(app: AppHandle, choice: String) {
    let phase = FULL_PAGE_PHASE.load(Ordering::SeqCst);
    eprintln!("[Aureen full page] bar choice: {choice} (phase {phase})");
    match (phase, choice.as_str()) {
        (PHASE_RUNNING, "stop") | (PHASE_RUNNING, "here") => {
            FULL_PAGE_STOP.store(true, Ordering::SeqCst)
        }
        (PHASE_RUNNING, "cancel") => {
            FULL_PAGE_CANCEL.store(true, Ordering::SeqCst);
            FULL_PAGE_STOP.store(true, Ordering::SeqCst);
        }
        (PHASE_CHOOSING, "cancel") => finish_full_page(&app),
        (PHASE_CHOOSING, "here") | (PHASE_CHOOSING, "whole") => {
            let to_here = choice == "here";
            FULL_PAGE_PHASE.store(PHASE_RUNNING, Ordering::SeqCst);
            FULL_PAGE_STOP.store(false, Ordering::SeqCst);
            FULL_PAGE_CANCEL.store(false, Ordering::SeqCst);
            std::thread::spawn(move || run_full_page(app, to_here));
        }
        _ => {}
    }
}

fn run_full_page(app: AppHandle, to_here: bool) {
    let target = FULL_PAGE_TARGET
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    let Some(target) = target else {
        finish_full_page(&app);
        return;
    };
    set_fullbar_state(&app, "running", 0);

    let (url, page_title) = source_of_pid(target.pid);
    let result = mac::capture_scrolling(&target, to_here, &FULL_PAGE_STOP, |n| {
        set_fullbar_state(&app, "running", n);
    });
    let cancelled = FULL_PAGE_CANCEL.load(Ordering::SeqCst);
    finish_full_page(&app);
    if cancelled {
        return;
    }
    match result.and_then(|frames| stitch::to_jpeg_data_url(&frames)) {
        Ok(data_url) => {
            show_panel(&app);
            let _ = app.emit(
                "fullpage-ready",
                CapturePayload {
                    image_data: data_url,
                    url,
                    page_title,
                },
            );
        }
        Err(message) => report_error(&app, message),
    }
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&input[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Saves an export (PDF / JSON / Markdown) into ~/Downloads and reveals it in Finder.
/// The file bytes arrive as the raw request body; the name comes in the `x-filename` header.
#[tauri::command]
fn save_download(request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw file bytes".into());
    };
    let name = request
        .headers()
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode)
        .unwrap_or_else(|| "aureen-export".into());
    let name: String = name
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | ':' | '\0') {
                '-'
            } else {
                c
            }
        })
        .collect();

    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = std::path::PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (name.clone(), String::new()),
    };
    let mut path = dir.join(&name);
    let mut n = 1;
    while path.exists() {
        path = dir.join(format!("{stem} ({n}){ext}"));
        n += 1;
    }
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    let _ = Command::new("/usr/bin/open").arg("-R").arg(&path).spawn();
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn start_capture(app: AppHandle) {
    start_capture_flow(app);
}

#[tauri::command]
fn start_selection(app: AppHandle) {
    start_selection_flow(app);
}

#[tauri::command]
fn start_full_page(app: AppHandle) {
    start_full_page_flow(app);
}

#[tauri::command]
fn hide_panel(app: AppHandle) {
    hide_panel_window(&app);
}

/// Opens a web link from the panel in the default browser.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("only http(s) links can be opened".into());
    }
    Command::new("/usr/bin/open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn selection_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit1)
}

fn region_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit2)
}

fn full_page_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit9)
}

fn register_shortcuts<M: Manager<Wry>>(manager: &M) {
    for shortcut in [
        selection_shortcut(),
        region_shortcut(),
        full_page_shortcut(),
    ] {
        if let Err(e) = manager.global_shortcut().register(shortcut) {
            eprintln!("Aureen: could not register shortcut {shortcut:?}: {e}");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, pressed, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    if *pressed == selection_shortcut() {
                        start_selection_flow(app.clone());
                    } else if *pressed == region_shortcut() {
                        start_capture_flow(app.clone());
                    } else if *pressed == full_page_shortcut() {
                        start_full_page_flow(app.clone());
                    } else if *pressed == escape_shortcut() {
                        // Esc: cancel while choosing, stop ("capture to here") while scrolling.
                        let choice = if FULL_PAGE_PHASE.load(Ordering::SeqCst) == PHASE_RUNNING {
                            "stop"
                        } else {
                            "cancel"
                        };
                        full_page_choice(app.clone(), choice.into());
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            fab_set_expanded,
            fab_moved,
            open_panel_from_fab,
            hide_fab,
            toolbar_pick,
            full_page_choice,
            set_paused,
            is_paused,
            quit_app,
            pin_panel,
            dock_panel,
            start_capture,
            start_selection,
            start_full_page,
            hide_panel,
            open_url,
            save_download
        ])
        .setup(move |app| {
            // Menu bar only: no Dock icon, no app switcher entry.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            register_shortcuts(app);

            // Keep track of the app the user is in, so actions started from Aureen's own
            // windows (panel, floating button) can hand focus back to it.
            #[cfg(target_os = "macos")]
            std::thread::spawn(|| {
                let own = std::process::id() as i32;
                loop {
                    if let Some(pid) = selection_watch::frontmost_pid() {
                        if pid != own {
                            LAST_EXTERNAL_PID.store(pid, Ordering::SeqCst);
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            });

            show_fab(app.handle());

            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                selection_watch::spawn(move |event| match event {
                    selection_watch::SelectionEvent::Selected {
                        text,
                        app: source,
                        x,
                        y,
                    } => {
                        // In a browser running the Aureen extension, its own toolbar shows up
                        // on the page; a second one from the app would be a duplicate.
                        if !ext_detect::browser_has_extension(&source) {
                            show_toolbar(&handle, text, source, x, y)
                        }
                    }
                    selection_watch::SelectionEvent::MouseDown { x, y } => {
                        dismiss_toolbar_if_outside(&handle, x, y)
                    }
                });
            }

            let selection_item =
                MenuItem::with_id(app, "selection", "儲存選取文字  ⌘⇧1", true, None::<&str>)?;
            let capture_item =
                MenuItem::with_id(app, "capture", "截取區域  ⌘⇧2", true, None::<&str>)?;
            let full_page_item =
                MenuItem::with_id(app, "full_page", "整頁截圖  ⌘⇧9", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let pause_item = MenuItem::with_id(app, "pause", "暫停 Aureen", true, None::<&str>)?;
            let fab_item =
                MenuItem::with_id(app, "toggle_fab", "隱藏浮動按鈕", true, None::<&str>)?;
            app.manage(FabMenuItem(fab_item.clone()));
            let dock_item =
                MenuItem::with_id(app, "dock_panel", "面板回到圖示下方", true, None::<&str>)?;
            app.manage(PauseMenuItem(pause_item.clone()));
            let quit_item = MenuItem::with_id(app, "quit", "結束 Aureen", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &selection_item,
                    &capture_item,
                    &full_page_item,
                    &separator,
                    &pause_item,
                    &fab_item,
                    &dock_item,
                    &quit_item,
                ],
            )?;

            TrayIconBuilder::with_id("aureen")
                .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .tooltip("Aureen")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "selection" => start_selection_flow(app.clone()),
                    "capture" => start_capture_flow(app.clone()),
                    "full_page" => start_full_page_flow(app.clone()),
                    "pause" => set_paused_state(app, !PAUSED.load(Ordering::SeqCst)),
                    "toggle_fab" => {
                        let hidden = !FAB_HIDDEN.load(Ordering::SeqCst);
                        FAB_HIDDEN.store(hidden, Ordering::SeqCst);
                        if hidden {
                            hide_fab_window(app);
                        } else {
                            show_fab(app);
                        }
                        update_fab_menu_item(app);
                    }
                    "dock_panel" => {
                        PANEL_PINNED.store(false, Ordering::SeqCst);
                        hide_panel_window(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let opening = !app
                            .get_webview_window(PANEL_LABEL)
                            .and_then(|p| p.is_visible().ok())
                            .unwrap_or(false);
                        if opening {
                            remember_frontmost_app();
                        }
                        let scale = app
                            .get_webview_window(PANEL_LABEL)
                            .and_then(|w| w.scale_factor().ok())
                            .unwrap_or(1.0);
                        let pos = rect.position.to_physical::<f64>(scale);
                        let size = rect.size.to_physical::<f64>(scale);
                        if !PANEL_PINNED.load(Ordering::SeqCst) {
                            place_panel_under(app, pos, (size.width, size.height));
                        }
                        toggle_panel(app);
                    }
                })
                .build(app)?;

            // Close the popover when it loses focus, like a native menu bar panel.
            if let Some(panel) = app.get_webview_window(PANEL_LABEL) {
                let handle = panel.clone();
                panel.on_window_event(move |event| {
                    if let WindowEvent::Focused(false) = event {
                        if PANEL_PINNED.load(Ordering::SeqCst) {
                            return;
                        }
                        let _ = handle.hide();
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Aureen");
}
