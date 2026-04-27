use std::sync::Mutex;

/// ダブルクリック起動時に OS から渡された .ptcl パスを保持する
struct StartupFile(Mutex<Option<String>>);

/// フロントエンドが起動直後に呼び出して起動ファイルパスを取得するコマンド。
/// 一度取得したら None になる（再起動しない限り再取得不可）。
#[tauri::command]
fn get_startup_file(state: tauri::State<StartupFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

/// fs プラグインのスコープを回避してファイルを直接読む（CLI 引数パス用）。
#[tauri::command]
fn read_startup_ptcl(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// DevTools のトグル（デバッグビルドのみ動作）
#[tauri::command]
fn toggle_devtools(#[allow(unused_variables)] window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    {
        use tauri::Manager as _;
        let _ = &window; // suppress unused warning
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Windows / macOS / Linux: OS がファイルパスをコマンドライン引数で渡す
    let ptcl_path = std::env::args()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".ptcl"));

    tauri::Builder::default()
        // ---- プラグイン登録 ----
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // ---- 起動時ファイルをアプリ状態として保持 ----
        .manage(StartupFile(Mutex::new(ptcl_path)))
        // ---- フロントエンドから呼び出せるコマンド ----
        .invoke_handler(tauri::generate_handler![
            get_startup_file,
            read_startup_ptcl,
            toggle_devtools
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                // デバッグビルドのみ: ログプラグインを有効化
                _app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                // デバッグビルドのみ: DevTools を起動時に自動で開く
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
