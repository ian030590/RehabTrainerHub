# 舌頭動作訓練 R2 搬遷審查單

狀態：**R2 套件 `2.0.0` 已完成，等待擁有者核准精確 version／contentSha256 後發布**。`tongue-catch` 寫成 R2 自包含套件（自有設定、聚光燈教學、校正、成果與 i18n），相機、臉部模型與舌頭分類器改由容器的舌頭代理執行。平台支援在 `0497235c`（尚未推送）。這是最後一款舊流程官方遊戲，搬遷後所有官方遊戲都在 R2。

範圍：擁有者要求「有球必應跟舌頭動作訓練還沒有變成R2」，並回答「核准三種代理（建議）」「容器在遊戲後方顯示（建議）」，另要求「順帶發現的問題，請一併處理」。

## 對照

| 項目 | 舊流程 | R2 套件 |
| --- | --- | --- |
| 名稱 | 舌頭動作訓練／Tongue Movement Training | 不變；英文說明的 practise 改為美式拼法 practice |
| 分類 | mouth／oral | 不變 |
| 設定 | `settings.json` 經 Hub `GameSettingsForm`（靈敏度、時間、邊緣目標比例） | 遊戲自有原生 dialog；三個欄位的預設值與範圍不變（`scripts/fixtures/tongue-catch-legacy.json`），另補回原遊戲面板的伸長速度、蘋果掉落速度與產生間隔 |
| 相機與模型 | 遊戲在同源 iframe 內開相機、跑 MediaPipe Face Landmarker 與 TensorFlow KNN 分類器 | 容器經使用者同意後執行 runner 的 `/input/tongue-tracking-1.0.0/`；校正樣本只留在容器記憶體；遊戲只收到嘴巴位置、方向（休息／左／右）、信心值與每個方向的樣本數 |
| 相機畫面 | 遊戲內的 `<video>`，不透明度 78% | 容器把影像放在透明遊戲 iframe 後方：遊玩時佔滿畫面，遊戲背景以 22% 疊在上面，看起來與舊版相同；校正時只在左側（手機為上方）相機區 |
| 執行 | `TongueCatchGame.tsx` 內的 Pixi ticker 與 `UpdateTongueGame` | `logic/tongueCatch.ts` 純函式、`logic/calibration.ts` 校正、`scene.ts` 繪製；jsPsych lifecycle `mouth:tongue-catch` 包住校正與遊玩 |
| 成果 | Hub `JsonTrainingOverlay` 與舊 `score.json` | 遊戲自有成果頁；summary 前五欄與 rounds 三欄名稱沿用舊 `score.json` |

## 沿用的規則

- 校正：依序擷取放鬆、向左、向右，每個動作至少 1.9 秒且至少 10 個樣本；重新擷取同一個動作會先清掉該動作的樣本。
- 偵測：每 72 ms 一次。臉部模型一張臉、三個門檻 0.5；取嘴唇下方 32×24 鏡像灰階影像，標準化後交給 KNN（k = 3）。
- 舌頭：信心值低於辨識門檻（預設 65%）算放鬆。伸出時每秒伸長 240 px（可調），放鬆時以 1.7 倍速縮回，換邊從 0 開始，最長到畫面邊緣；嘴巴位置每 50 ms 移近 45%；單一畫面最多計 50 ms；找不到臉時舌頭縮回。
- 蘋果：每 2.2 秒一顆（可調），40% 落在左右邊緣帶（畫面寬 10–28%、72–90%），其餘在 27–73%；大小 95–120 px，左右搖擺 5–9 px；舌頭長度超過 20 px 且碰到蘋果算接住，掉出畫面下緣算漏接。隨機數的抽取順序不變。
- 維持：辨識為左或右且持續 0.12 秒以上才計入平均維持；時間到時還在進行的維持也計入。

## 行為差異

這些差異都有測試覆蓋，發布前請擁有者確認。

- **設定**：遊戲自有 dialog，開啟時焦點在第一個滑桿，Enter 確認、Escape 返回。2026-09-09 設定改由 Hub 表單呈現後，伸長速度、蘋果掉落速度與產生間隔只剩預設值；這次補回，範圍與原遊戲面板相同。
- **「動作靈敏度」改名「辨識門檻」**：這個數字是信心值的下限，數字越大越難算成伸出舌頭，和「靈敏度」字面意思相反。欄位名稱、預設值與範圍不變，說明寫明常被誤判時調高、常偵測不到時調低。
- **開啟相機與全螢幕**：確認畫面的第一個按鈕是「開啟相機」，在視窗模式下由容器詢問同意，權限提示不會被全螢幕擋住。開好後按鈕變成「開始校正」，再按一次才進入全螢幕並開始校正。舊版先進全螢幕再開相機。拒絕同意、相機中斷或模型載入失敗都會回到設定並顯示原因。
- **全螢幕**：由容器對自己的外框進入全螢幕，相機影像才看得到；遊戲本身的 `document.fullscreenElement` 維持 null。
- **聚光燈教學**：確認設定後依序照亮三個校正步驟、嘴巴與舌頭、蘋果、上方列。
- **校正畫面**：版面與舊版相同（相機在左、說明卡在右；手機上相機在上）。找不到臉時，說明卡顯示「請將臉部與嘴巴移回鏡頭中央」。
- **上方列**：新增剩餘時間、接住、漏接、臉部偵測狀態與停止按鈕。舊版遊玩時沒有計時，也沒有停止按鈕，只能按 Escape。校正時不顯示上方列（和舊版一樣只有相機區與說明卡，取消按鈕在說明卡上），避免在手機上蓋住相機影像的上半部。
- **改變視窗大小**：舊版會清掉畫面上的蘋果並把舌頭放回中央；現在蘋果依畫面寬度比例定位，縮放後繼續落下。
- **成果頁**：主要數值為接住、漏接與平均維持；另列接住比例（只算接住與落地的蘋果，時間到時還在落下的不算）、當次設定與實際活動時間，以及逐顆蘋果的圖表與明細（水平位置以畫面中央為 0%）。舊版顯示使用者名稱與日期；遊戲不再接觸身分，日期由 Hub 紀錄提供。
- **保存欄位**：summary 的 duration、caught、missed、holdSeconds、threshold 與舊 `score.json` 相同，另加 catchRate；rounds 為 object、caught、position；config 依序為 sensitivityPercent、durationSec、edgeChancePercent、growthRate、appleSpeed、spawnIntervalSec。
- **延遲**：辨識在容器內執行，結果經私有 port 才到遊戲，比舊版多約一個畫面更新的延遲。
- **背景音樂**：原遊戲沒有，不加。

## 順帶修正

- **舊版的畫面樣式已遺失**：2026-09-08 的 `3a078e24`（independent games）刪除 mouth runtime 的 `index.css` 後，repo 內已沒有舌頭遊戲的相機、舞台、校正卡片與成果樣式，舊版這些畫面沒有排版。R2 版的 `game.css` 依該檔的顏色與版面重建，顏色都改成 token。
- **設定 scaffold 會把 `settings.json` 放回 R2 遊戲**：`scripts/scaffold-official-game-settings.mjs` 對清單中每款遊戲寫入 `settings.json`；所有遊戲搬到 R2 後，執行它會在 50 款 R2 遊戲裡產生舊設定檔。現在跳過 registry 內的遊戲（目前寫入 0 個），`check-game-directory-architecture.test.mjs` 有對應測試。
- **只剩空殼的舊流程測試**：`check-game-architecture-browser.test.mjs` 的兩個 Brave 測試（Hub 舊設定表單、舊成果與上傳）只操作舊流程遊戲；現在沒有任何遊戲走這條路，兩個測試已移除。`check-game-directory-architecture`、middleware、records 與本機 Workers 檢查改用 registry 外的代號或已搬遷的入口。Hub 的舊流程程式（`TrainingOverlay` 的 JSON 分支、`JsonTrainingOverlay`、`OfficialGameShell`）目前沒有使用者，這次不刪除。
- **開發者指南仍描述舊的內建遊戲做法**：`/developer` 的內建遊戲卡片、AI 提示詞產生器，以及 settings.json／score.json 兩節，都說內建遊戲要有這兩個檔案並向 `OfficialGameShell` 註冊。現在改為說明自包含套件：自有設定、聚光燈教學與成果，`public/game.json`，私有 MessageChannel，擁有者核准精確版本後發布 R2；兩個 JSON 檔只屬於第三方原生投稿。`check-game-directory-architecture.test.mjs` 檢查指南不再出現舊說法。

## 測試與驗證

- `scripts/check-tongue-catch-game.test.mjs`（由 `check-self-contained-game.test.mjs` 引入，14 項）：設定與舊值一致、範圍驗證、舌頭伸縮與嘴巴跟隨、維持時間、蘋果產生／搖擺／接住／漏接、嘴巴座標換算、校正、成果欄位、感測器訊息只接受精確格式、bridge 的擷取／預覽／全螢幕訊息、離開時的清理順序、兩次點擊的開始流程、蘋果圖片不經 fetch 載入、套件自包含、聚光燈目標。
- 共用測試同步加入舌頭動作訓練：UI、成果、設定記憶、音效、antislop、研究契約、目錄架構、middleware 410、training flow（相機改為代理權限，已沒有遊戲自己開相機）。
- `scripts/tongue-catch-browser.mjs` 為 Brave 實際操作流程，從 `check-r2-game-browser.mjs --game tongue-catch` 執行：
  - 遊戲 iframe 自己呼叫相機會被拒絕。
  - 六個滑桿、範圍、Enter 確認、教學返回保留設定、四個聚光燈（說明框不得蓋住目標）、確認畫面。
  - 容器同意：先拒絕（回到設定並顯示原因，相機沒有啟動），再允許。
  - 相機畫面為 TensorFlow 測試用的人像；左右動作時在嘴巴旁畫一個紅色記號，讓實際的臉部模型與分類器學到三種不同的嘴部影像。檢查遊戲只收到嘴巴位置與方向、容器影像的位置（全畫面、校正時的相機區）、模型與 WASM 從 runner 載入。
  - 三個動作校正後，保持「向右」：分類器辨識為向右，舌頭伸到右側接住蘋果；檢查成果頁、保存失敗後重試、資料庫中的 config、summary 與每顆蘋果。
  - 結束、停止與相機中斷都離開全螢幕、停止相機並隱藏影像。
- 瀏覽器檢查抓到並已修正：
  - 遊戲開始後時間停在 30 秒、沒有蘋果。Pixi 的 SVG 載入器會先用 `fetch` 讀檔，runner 的套件 CSP 是 `connect-src 'none'`，舞台因此沒有建立。蘋果圖片改由 `Image` 元素載入、畫到 256 px canvas 再做成 texture。
  - 校正時遊戲底色沒有完全隱藏，相機影像上仍蓋著一層（CSS 選擇器權重不足）。
  - 手機校正截圖中，上方列（30 秒、0、0、停止）蓋住相機影像的上半部；現在校正時不顯示上方列，Brave 流程檢查校正畫面沒有上方列。

### Brave 結果（2026-10-24，最終建置）

圖片串流與 TensorFlow 測試人像，`/api/*` 只寫本機 SQLite。11 個流程全部通過：

| 流程 | 結果 |
| --- | --- |
| `--lobby`（桌機訪客） | 通過，接住 19、漏接 8 |
| `--lobby --mobile` | 通過，接住 21、漏接 6 |
| `--lobby --tablet`（820×1180） | 通過，接住 16、漏接 11 |
| `--lobby --signed-in --english` | 通過，接住 23、漏接 4 |
| `--lobby --session-failure` | 通過，接住 18、漏接 10 |
| `--standalone` | 通過，接住 19、漏接 8 |
| `--standalone --mobile --english` | 通過，接住 26、漏接 2 |
| `--lobby --settings-memory` | 通過，六個設定在 Hub 重開後保留 |
| `--lobby --stop` | 通過，不保存並關閉相機 |
| `--lobby --sensor-disconnect` | 通過，不保存並關閉相機 |
| `--lobby --revoke` | 通過，撤回後移除遊戲，沒有保存成果 |

接住數依蘋果隨機位置而不同：測試保持向右，落在嘴巴左側的蘋果接不到。真人、實體相機與 Safari／iOS 未驗收。

## 發布候選

6 個檔案（`index.html`、`game.json`、`preview.webp`、JS、CSS、蘋果 SVG）。兩次重新建置的 digest 相同。下方的發布指令會先重新建置，digest 與下表一致才上傳並切換 current。

| gameId | version | contentSha256 | bytes |
| --- | --- | --- | --- |
| `tongue-catch` | `2.0.0` | `690f776372713c4d1bd993692f36f5107a6a2f7fa817357462b003c111d89061` | 1139117 |

順序（擁有者執行）：

1. 推送平台提交 `0497235c`（Hub／runner 的姿勢、麥克風與舌頭代理），等部署完成：`git push origin 0497235c:main`。
2. 核准下表的 version／contentSha256 後發布：`node .tmp/brain-tools/publish-approved.mjs .tmp/brain-tools/oral-candidates.txt`（同一份清單另含有球必應 `2.0.0`，兩款依序發布，不會同時執行）。
3. 正式 runner 驗證通過後，推送本次登記（`officialGameReleases.json` 與 catalog）：`git push origin main`。
