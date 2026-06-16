use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct FrontmostApp {
    name: String,
    bundle_id: String,
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn get_frontmost_app() -> Option<FrontmostApp> {
    use objc2_app_kit::NSWorkspace;
    unsafe {
        let ws = NSWorkspace::sharedWorkspace();
        let app = ws.frontmostApplication()?;
        Some(FrontmostApp {
            name: app.localizedName().map(|s| s.to_string()).unwrap_or_default(),
            bundle_id: app
                .bundleIdentifier()
                .map(|s| s.to_string())
                .unwrap_or_default(),
        })
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn get_frontmost_app() -> Option<FrontmostApp> {
    None
}

// 진화 연출용: 창 프레임(위치+크기)을 NSWindow.setFrame 한 번으로 원자적으로 바꿔 사방 pad 만큼 키운다.
// Tauri 의 set_size/set_position 은 별개의 Cocoa 호출이라 size→position 사이에 한 프레임이 끼어
// 펫이 큰 창의 좌상단에 잠깐 보였다가 중앙으로 튀었다. setFrame 단일 호출은 한 디스플레이 사이클에 합쳐져 튐이 없다.
// 반환값은 원래 NSWindow 프레임 (x, y, w, h, Cocoa 좌표) — JS 는 불투명하게 보관했다가 evolve_restore 로 되돌린다.
#[cfg(target_os = "macos")]
#[tauri::command]
fn evolve_grow(window: tauri::WebviewWindow, pad: f64) -> Result<(f64, f64, f64, f64), String> {
    use objc2_app_kit::NSWindow;
    use objc2_foundation::{NSPoint, NSRect, NSSize};

    let ptr = window.ns_window().map_err(|e| e.to_string())? as usize;
    let (tx, rx) = std::sync::mpsc::channel();
    window
        .run_on_main_thread(move || {
            let ns: &NSWindow = unsafe { &*(ptr as *const NSWindow) };
            let f = ns.frame();
            // 사방 대칭 확장 → 중심 고정(좌표계 방향과 무관). Cocoa 좌표라 그대로 되돌릴 수 있다.
            let grown = NSRect::new(
                NSPoint::new(f.origin.x - pad, f.origin.y - pad),
                NSSize::new(f.size.width + pad * 2.0, f.size.height + pad * 2.0),
            );
            unsafe { ns.setFrame_display_animate(grown, true, false) };
            let _ = tx.send((f.origin.x, f.origin.y, f.size.width, f.size.height));
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn evolve_restore(window: tauri::WebviewWindow, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    use objc2_app_kit::NSWindow;
    use objc2_foundation::{NSPoint, NSRect, NSSize};

    let ptr = window.ns_window().map_err(|e| e.to_string())? as usize;
    window
        .run_on_main_thread(move || {
            let ns: &NSWindow = unsafe { &*(ptr as *const NSWindow) };
            let frame = NSRect::new(NSPoint::new(x, y), NSSize::new(w, h));
            unsafe { ns.setFrame_display_animate(frame, true, false) };
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn evolve_grow(window: tauri::WebviewWindow, pad: f64) -> Result<(f64, f64, f64, f64), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let size = window.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let (ox, oy, ow, oh) = (pos.x, pos.y, size.width, size.height);
    let win = window.clone();
    window
        .run_on_main_thread(move || {
            let _ = win.set_size(tauri::LogicalSize::new(ow + pad * 2.0, oh + pad * 2.0));
            let _ = win.set_position(tauri::LogicalPosition::new(ox - pad, oy - pad));
        })
        .map_err(|e| e.to_string())?;
    Ok((ox, oy, ow, oh))
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn evolve_restore(window: tauri::WebviewWindow, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    let win = window.clone();
    window
        .run_on_main_thread(move || {
            let _ = win.set_size(tauri::LogicalSize::new(w, h));
            let _ = win.set_position(tauri::LogicalPosition::new(x, y));
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_frontmost_app, evolve_grow, evolve_restore])
        .setup(|app| {
            // 맥 그림자 제거
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(false);
                }
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
