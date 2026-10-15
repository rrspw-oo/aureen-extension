mod mac;
#[cfg(target_os = "macos")]
mod selection_watch;
mod stitch;

use base64::Engine;
use serde::Serialize;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, Manager, PhysicalPosition, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const PANEL_LABEL: &str = "panel";
const TOOLBAR_LABEL: &str = "toolbar";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const TOOLBAR_SIZE: (f64, f64) = (300.0, 56.0);

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
    // The app may have been hidden to hand focus back to the user's window.
    #[cfg(target_os = "macos")]
    let _ = app.show();
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

/// Hides Aureen so the window the user was working in is frontmost again,
/// and waits for the shortcut's modifier keys to be released.
fn give_focus_back(app: &AppHandle) {
    hide_panel_window(app);
    #[cfg(target_os = "macos")]
    let _ = app.hide();
    std::thread::sleep(std::time::Duration::from_millis(450));
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

fn start_capture_flow(app: AppHandle) {
    // The picker blocks until the user finishes, so keep it off the event loop thread.
    std::thread::spawn(move || {
        hide_panel_window(&app);
        if !ensure_screen_access() {
            report_error(&app, SCREEN_HINT);
            return;
        }
        match capture_region() {
            Ok(Some(data_url)) => {
                show_panel(&app);
                let _ = app.emit("capture-ready", data_url);
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
    } else {
        register_shortcuts(app);
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

static FULL_PAGE_RUNNING: AtomicBool = AtomicBool::new(false);
static FULL_PAGE_STOP: AtomicBool = AtomicBool::new(false);

fn escape_shortcut() -> Shortcut {
    Shortcut::new(None, Code::Escape)
}

/// ⌘⇧9: scrolls the frontmost window and stitches a full-page capture.
/// Esc (or ⌘⇧9 again) stops at the part currently on screen, like "capture to here".
fn start_full_page_flow(app: AppHandle) {
    if FULL_PAGE_RUNNING.swap(true, Ordering::SeqCst) {
        FULL_PAGE_STOP.store(true, Ordering::SeqCst);
        return;
    }
    FULL_PAGE_STOP.store(false, Ordering::SeqCst);

    std::thread::spawn(move || {
        give_focus_back(&app);
        if !ensure_screen_access() {
            FULL_PAGE_RUNNING.store(false, Ordering::SeqCst);
            report_error(&app, SCREEN_HINT);
            return;
        }
        let _ = app.global_shortcut().register(escape_shortcut());
        let tray = app.tray_by_id("aureen");
        let result = mac::capture_scrolling(&FULL_PAGE_STOP, |n| {
            if let Some(tray) = &tray {
                let _ = tray.set_title(Some(format!("{n}")));
            }
        });
        let _ = app.global_shortcut().unregister(escape_shortcut());
        if let Some(tray) = &tray {
            let _ = tray.set_title(None::<&str>);
        }
        FULL_PAGE_RUNNING.store(false, Ordering::SeqCst);

        match result.and_then(|frames| stitch::to_jpeg_data_url(&frames)) {
            Ok(data_url) => {
                show_panel(&app);
                let _ = app.emit("fullpage-ready", data_url);
            }
            Err(message) => report_error(&app, message),
        }
    });
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
                        FULL_PAGE_STOP.store(true, Ordering::SeqCst);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            toolbar_pick,
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

            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                selection_watch::spawn(move |event| match event {
                    selection_watch::SelectionEvent::Selected {
                        text,
                        app: source,
                        x,
                        y,
                    } => show_toolbar(&handle, text, source, x, y),
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
