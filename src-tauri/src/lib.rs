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

// 진화 연출용: 창을 사방 pad 만큼 키운다. set_size/set_position 은 웹뷰(WKWebView)까지 함께
// 리사이즈하므로 내용이 새 크기에 맞춰 중앙 재정렬된다(raw NSWindow.setFrame 은 창만 키우고 웹뷰는
// 옛 크기로 좌상단에 남아 내용이 통째로 좌상단으로 쏠림). 두 단계 사이의 한 프레임 튐은 프런트의 숨김-마스크로 가린다.
// 반환값은 원래 (x, y, w, h) — 끝나면 evolve_restore 로 되돌린다.
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
