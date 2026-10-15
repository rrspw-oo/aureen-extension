//! Notices text selections in any app, like the extension's selection toolbar does on web pages.
//! A listen-only event tap reports mouse drags / double-clicks; on release the selected text is
//! read through the Accessibility API (or ⌘C in browsers that don't expose it).

use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::runloop::CFRunLoop;
use core_foundation::string::{CFString, CFStringRef};
use core_graphics::event::{
    CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
    CallbackResult, EventField,
};
use std::collections::HashSet;
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Mutex};
use std::thread::sleep;
use std::time::Duration;

type AXUIElementRef = *const c_void;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateSystemWide() -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> i32;
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: CFTypeRef,
    ) -> i32;
    fn AXUIElementGetPid(element: AXUIElementRef, pid: *mut i32) -> i32;
}

/// Turned off while Aureen is paused.
pub static ENABLED: AtomicBool = AtomicBool::new(true);

pub enum SelectionEvent {
    /// Text was selected; `x`/`y` is where the mouse was released (screen points).
    Selected {
        text: String,
        app: String,
        x: f64,
        y: f64,
    },
    /// A mouse press somewhere (used to dismiss the toolbar).
    MouseDown { x: f64, y: f64 },
}

enum Raw {
    Down(f64, f64),
    Dragged,
    Up(f64, f64, i64),
}

unsafe fn copy_attr(element: CFTypeRef, name: &str) -> Option<CFType> {
    let attribute = CFString::new(name);
    let mut value: CFTypeRef = std::ptr::null();
    let err = AXUIElementCopyAttributeValue(element, attribute.as_concrete_TypeRef(), &mut value);
    if err != 0 || value.is_null() {
        return None;
    }
    Some(CFType::wrap_under_create_rule(value))
}

fn string_attr(element: &CFType, name: &str) -> Option<String> {
    unsafe { copy_attr(element.as_CFTypeRef(), name) }
        .and_then(|v| v.downcast::<CFString>())
        .map(|s| s.to_string())
}

static MANUAL_AX_PIDS: Mutex<Option<HashSet<i32>>> = Mutex::new(None);

/// Chrome and Electron apps only build their accessibility tree when asked to.
fn enable_manual_accessibility(app: &CFType, pid: i32) {
    let mut guard = MANUAL_AX_PIDS.lock().unwrap_or_else(|e| e.into_inner());
    let seen = guard.get_or_insert_with(HashSet::new);
    if !seen.insert(pid) {
        return;
    }
    let attribute = CFString::new("AXManualAccessibility");
    unsafe {
        AXUIElementSetAttributeValue(
            app.as_CFTypeRef(),
            attribute.as_concrete_TypeRef(),
            CFBoolean::true_value().as_CFTypeRef(),
        );
    }
}

/// The focused app's name and its selected text (empty when it exposes none).
fn focused_selection() -> Option<(String, String)> {
    unsafe {
        let system = CFType::wrap_under_create_rule(AXUIElementCreateSystemWide() as CFTypeRef);
        let app = copy_attr(system.as_CFTypeRef(), "AXFocusedApplication")?;
        let mut pid = 0;
        AXUIElementGetPid(app.as_CFTypeRef(), &mut pid);
        if pid == std::process::id() as i32 {
            return None; // selections inside Aureen itself
        }
        enable_manual_accessibility(&app, pid);
        let name = string_attr(&app, "AXTitle").unwrap_or_default();
        let text = copy_attr(app.as_CFTypeRef(), "AXFocusedUIElement")
            .and_then(|focused| string_attr(&focused, "AXSelectedText"))
            .unwrap_or_default();
        Some((name, text))
    }
}

/// Starts watching in background threads; `handler` runs on the worker thread.
pub fn spawn(handler: impl Fn(SelectionEvent) + Send + 'static) {
    let (tx, rx) = mpsc::channel::<Raw>();

    std::thread::spawn(move || loop {
        // Fails until the Accessibility permission is granted; keep retrying quietly.
        let tx = tx.clone();
        let result = CGEventTap::with_enabled(
            CGEventTapLocation::Session,
            CGEventTapPlacement::TailAppendEventTap,
            CGEventTapOptions::ListenOnly,
            vec![
                CGEventType::LeftMouseDown,
                CGEventType::LeftMouseUp,
                CGEventType::LeftMouseDragged,
            ],
            move |_proxy, kind, event| {
                let p = event.location();
                let _ = match kind {
                    CGEventType::LeftMouseDown => tx.send(Raw::Down(p.x, p.y)),
                    CGEventType::LeftMouseDragged => tx.send(Raw::Dragged),
                    CGEventType::LeftMouseUp => tx.send(Raw::Up(
                        p.x,
                        p.y,
                        event.get_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE),
                    )),
                    _ => Ok(()),
                };
                CallbackResult::Keep
            },
            CFRunLoop::run_current,
        );
        if result.is_err() {
            sleep(Duration::from_secs(5));
        }
    });

    std::thread::spawn(move || {
        let mut down = (0.0_f64, 0.0_f64);
        let mut dragged = false;
        while let Ok(raw) = rx.recv() {
            match raw {
                Raw::Down(x, y) => {
                    down = (x, y);
                    dragged = false;
                    handler(SelectionEvent::MouseDown { x, y });
                }
                Raw::Dragged => dragged = true,
                Raw::Up(x, y, clicks) => {
                    if !ENABLED.load(Ordering::SeqCst) {
                        continue;
                    }
                    let moved = ((x - down.0).powi(2) + (y - down.1).powi(2)).sqrt() > 6.0;
                    if !((dragged && moved) || clicks >= 2) {
                        continue;
                    }
                    sleep(Duration::from_millis(60));
                    let Some((app, mut text)) = focused_selection() else {
                        continue;
                    };
                    if text.trim().is_empty() && dragged && crate::mac::is_browser(&app) {
                        text = crate::mac::copy_selection_text()
                            .ok()
                            .flatten()
                            .unwrap_or_default();
                    }
                    let text = text.trim().to_string();
                    if !text.is_empty() {
                        handler(SelectionEvent::Selected { text, app, x, y });
                    }
                }
            }
        }
    });
}
