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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_frontmost_app])
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
