# 小行星護盾教學、護盾素材與 HUD 2.0.7

2026-10-13：依擁有者「完成改動後核准直接推送r2，並請將改動commit並push到遠端」的預先授權，完成三項修正、驗證固定候選後直接發布 R2。current 已切換至 `asteroid-shield@2.0.7`；正式 API、固定版本 session、全部 12 個公開檔案與桌機 Hub／手機 Hub／手機獨立 PWA 三個真實流程均通過。精確 bytes 與證據見[正式收據](releases/asteroid-shield-2.0.7.json)及[驗收摘要](migrations/asteroid-shield-hud-2.0.7/production/summary.json)。

## 改動與參考

- 威脅與能量石群組原本被 flex 版面推到飛船後方；聚光燈雖涵蓋群組矩形，畫面卻看不到物件。現在四種物件固定在上方，依視窗縮放、保留圖片比例，說明面板不遮住目標。
- 護盾原始 PNG 的右邊界有 72 個非透明像素，圖形本身被截斷。教學與 Pixi gameplay 改用[完整透明護盾](../apps/rehabtrainerhub/games/asteroid-shield/textures/shield-complete.png)，左右曲線及底部都在透明畫布內。
- 左上角新增綠色生命條、`目前耐久 / 最大耐久` 與 `分:秒` 剩餘時間。HUD 直接接收 game loop 的耐久與訓練時間：傷害減少、能量石回復，倒數和既有完成條件使用同一個 elapsedMs；每次開始重新初始化，結束移除，指標輸入可穿過 HUD。

生命條參照原始 [asteroid-attack 的 healthbar.py](https://github.com/eduardosamman/asteroid-attack/blob/e3af0dc6f0494cdebf54ba0b8e4e10ae1916d524/healthbar.py)：左上位置、綠色填滿、白色外框及傷害／回復上限。參考版本固定為 `e3af0dc6f0494cdebf54ba0b8e4e10ae1916d524`，來源與用途存於[參考證據](migrations/asteroid-shield-hud-2.0.7/reference/source.json)。本遊戲採自身原有 10 點耐久與設定的訓練時長；計時器是這個訓練流程的剩餘時間。

四軌音樂沿用 2.0.6：主旋律／合聲方波、打擊白噪音、bass 三角波提高八度，48 秒循環。

## 測試先行

先加入可執行測試，再修改產品程式碼：

| 情境 | 修改前的失敗 | 修正後 |
| --- | --- | --- |
| 真正 game loop 的耐久與倒數 | 沒有進度通知，得到 undefined | 10 → 7 → 9，30 → 29 → 0；12 項小行星測試通過 |
| 手機教學 | 目標圖片被飛船遮住 | 四張圖片載入、位於飛船上方、聚光燈涵蓋且面板不遮擋；縮放後仍通過 |
| 護盾素材 | 右邊界 72 個非透明像素 | 公開資產經 CORS 解碼，左右邊界皆透明 |
| 752×485 小視窗 | 第一版修正的說明面板仍遮住圖片 | 調整物件外框尺寸並使用 contain，完整訓練通過 |

失敗／通過紀錄保存在 [tests](migrations/asteroid-shield-hud-2.0.7/tests/)。瀏覽器測試使用既有嚴格沙盒／CSP、私有通道與本機 SQLite；沒有新增 CI matrix 或放寬權限。

通過七項 gate：`test:naming`、`test:pwa`、`test:game-architecture`（143 項）、`test:hub-functions`、`test:gamerunner`、`test:entrypoints`、`test:cloudflare-deploy`。遊戲 Vite build、精確摘要 dry-run 及 Hub build（35 項任務、已遷移 bundle 排除）均通過。runner 初次執行遇到沙盒拒絕 esbuild，使用子程序所需權限重跑後 47 項通過。

最終固定候選驗證小視窗桌機 Hub、820×1180 平板 Hub 與手機 PWA；英文手機在最後一次教學尺寸調整前通過。發布後再次驗證真正的正式桌機 Hub、手機 Hub 與手機 PWA，包含設定／Enter／往返、三步教學／縮放、HUD 倒數、全螢幕、滑鼠／觸控、動畫、音樂、成果與保存重試。僅寫本機 SQLite，沒有建立正式帳號或訓練紀錄。

正式畫面：[手機教學](migrations/asteroid-shield-hud-2.0.7/production/hub-mobile/tutorial.png)、[手機 HUD 與完整護盾](migrations/asteroid-shield-hud-2.0.7/production/hub-mobile/gameplay.png)、[桌機](migrations/asteroid-shield-hud-2.0.7/production/hub-desktop/gameplay.png)、[獨立 PWA](migrations/asteroid-shield-hud-2.0.7/production/pwa-mobile/gameplay.png)。

## 發布與回退

- 版本：`asteroid-shield@2.0.7`。
- contentSha256：`63dee846c20307797421d9f5bae473c4c5b38de4c22e0e833d211d49fef0f011`。
- 12 個檔案，1,768,348 bytes；逐檔上傳／回讀後發布 manifest，再切換 current，正式公開 bytes、MIME、CSP 與 SHA-256 均核對。
- 回退版：`2.0.6`，摘要 `226381bdf6a0537fc7fe7331f29ae6d8cd6291e8c7181215adfdb12580be0902`；發布前已核對 approved manifest 與全部實際 bytes，沒有執行回退。
- 回退指令：`node scripts/publish-official-game.mjs asteroid-shield --activate-version 2.0.6`。
- 本次 R2 發布沒有手動部署平台；commit／push 後由既有 workflow 驗證並依範圍處理部署。已安裝的版本化 PWA 保留原版，從[穩定入口](https://trainerhub-user-games.pages.dev/games/asteroid-shield/)進入新版。

Brave 手機／平板為模擬；實體觸控、實體音訊輸出與 Safari／iOS 尚未驗收。

## 護盾素材產生

使用內建 imagegen，以既有 `textures/shield.png` 作為編輯目標、透明背景，生成完整邊緣。產物僅縮小為 480×300、PNG 壓縮後保存至遊戲自有 `textures/shield-complete.png`；沒有改動其他素材。

實際提示詞：

> Use case: precise-object-edit. Edit target: provided blue sci-fi forcefield dome game sprite. Repair the cutoff right rim only: reconstruct the missing right curve so the entire dome is horizontally symmetric, with BOTH left and right edges and the entire base fully contained inside the canvas, and transparent empty padding on ALL four sides (at least 5% of canvas width/height). Retain the reference's blue translucent energy surface, thin bright electric blue curved rim, faint hexagonal texture, dark blue interior, front-facing dome silhouette and flat bottom. No scene, no spaceship, no floor, no text, no shadow outside the shield, no checkerboard baked into pixels. Game sprite on genuine alpha transparency. The silhouette should occupy about 85% of canvas width and 80% of height. Keep the lower surface dark blue translucent, no opaque white fill. Output a compact sprite at roughly 512x320 if possible. Return the generated image and its local saved file path.
