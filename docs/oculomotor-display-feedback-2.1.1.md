# 眼動練習尺寸校正、偵測提示、雙語與成果版面

狀態（2026-10-17）：`oculomotor-training@2.1.1` 已依擁有者「核准新的版本並git push到遠端」完成精確摘要核准、R2 發布及 current 切換，正式 API／逐檔 bytes／六個 Hub 與 PWA 瀏覽器流程通過。沒有部署 Hub／runner，也沒有新增正式帳號或訓練紀錄；[正式收據](releases/oculomotor-training-2.1.1.json)。Git 交付分支為 `fix/oculomotor-2.1.1`，不合併或推送 `main`，避免觸發含未核准 Gabor 登記的完整 Pages 部署。

核准並實際發布 11 檔，`contentSha256: 53c908e960adf358286c58d0b14d61ef62aebe441e7224373ed894337924ada3`。發布前後摘要一致，完整逐檔清單與擁有者核准見 [candidate.json](migrations/oculomotor-display-feedback-2.1.1/candidate.json)；`2.1.0` 的 11 檔已核對並保留回退。

## 五項需求

1. **尺寸校正與變形**：依使用者補充要求，保留原 `stimulusPixels` 的獨立換算：寬為 `直徑公分 × 螢幕 CSS 像素寬 / 寬公分`，高為 `直徑公分 × 螢幕 CSS 像素高 / 高公分`，不強制畫圓。物理寬高比例與實際像素比例一致時為圓形；只把寬或高填錯，會呈橢圓。若寬、高同時填成相同倍數，比例仍相同，形狀不變但大小錯誤。例如 1920×1080、48×27 cm 為圓；高度改填 54 cm 時，高度縮半，呈 2:1 橢圓；同時改為 96×54 cm 時仍為圓，兩軸尺寸都縮半。先前未發布的強制同一直徑候選已撤銷，舊摘要 `1bab9e70…f344f82` 不再是當版候選。
2. **校正前提示**：畫面中央顯示即時「尚未偵測到／已偵測到眼動追蹤訊號」；模型就緒才可開始校正，訊號失去會禁用按鈕，點擊時再確認一次。使用既有私有 `faceDetected` 輸入及其過期檢查，沒有加入相機影像或擴大權限。此狀態代表 WebGazer 模型已能提供追蹤訊號，不能當作瞳孔定位精度的獨立驗證。
3. **中英雙語與排版**：沿用 Hub／PWA 選定語言，補齊五點驗證指示、通過／誤差過大／資料不足、重校正、返回／繼續、各點結果、開始前錯誤、遊戲無障礙提示及 TFF 方向／狀態。驗證卡片可垂直捲動，統計與按鈕會換列。參考樣式先載入，遊戲自有樣式後載入，避免覆寫置中、顏色與尺寸。獨立 PWA 成績頁預留安裝控制空間，標題與說明不再被遮擋。科學 CSV 的既有欄名與機器值保持原契約。
4. **主要成果**：最上方呈現原 `accuracy_rate`（在標時間／有效計分時間）與 `tff_mean_ms`，另顯示在標／有效秒數與 TFF 偵測數／總目標數。跳視逐目標 TFF／方向／偵測狀態在其他分析前；完整 12 項數值與既有圖表保留，預設選取 Accuracy。設定及 metadata 移到全部統計下方。TFF 只適用跳視；缺測不補零，真正的 0 ms 保留為零。
5. **私人 R2 CSV**：2026-10-17 10:45（台灣）以唯讀物件清單核對 `oculomotor-data`，當時有一個 `.csv` 物件，22,084 bytes，`Content-Type: text/csv; charset=utf-8`；物件 metadata 為 `officialGameVersion=2.1.0`、`eye_tracking_source=webgazer`、`gazeSampleCount=238`。沒有讀取其座標內容或輸出物件路徑／Subject ID。安全摘要見 [storage.json](migrations/oculomotor-display-feedback-2.1.1/storage.json)。

R2 保存流程為遊戲私有 port → Hub `/api/oculomotor-data` → 私人 bucket `put`，先保存 CSV，成功後才能保存同一工作階段的成績摘要。CSV 為 UTF-8 BOM、逗號分隔、CRLF，含 15 欄：

```text
sample_index,trial_time_ms,device_timestamp_us,delta_t_ms,instant_hz,gaze_valid,gaze_x_px,gaze_y_px,stimulus_x_px,stimulus_y_px,distance_error_px,distance_error_deg,is_within_threshold,phase,direction
```

完整 25 欄原參考分析 CSV（另含來源時間對齊、影格、計分權重、速度、注視及 TFF）由瀏覽器下載；私人 R2 仍使用上述 15 欄契約。獨立 PWA 只下載、不上傳至 Hub／R2；未啟用眼動或沒有樣本也不建立逐筆 CSV。既有物件中繼資料能證明正式站已存在 CSV 保存，但不等於逐列驗證其內容。自動核准審查拒絕了讀取私人 CSV 內容的動作，理由是這會接觸個人原始座標，因此改用物件清單中繼資料及既有 API／瀏覽器測試確認格式與流程。

## 3:2 筆電的實際重現與修正

3:2 並非不支援的比例，但像素資料來源若回報別的比例，就會讓正確物理設定變形。本機 Brave 在實際可見區 1440×960（3:2）時，Hub 的 `screen` 回報 1680×1050，隔離遊戲回報 1280×800，兩者皆為 16:10；`innerWidth/innerHeight` 則仍正確為 1440×960。不能直接將這個現象判定為使用者筆電的唯一原因，尚待其實際尺寸、解析度與外接螢幕資訊比對。Brave 官方亦有[螢幕解析度防指紋測試](https://dev-pages.brave.software/fingerprinting/farbling.html)，而 [`Screen.width` 規格說明](https://developer.mozilla.org/en-US/docs/Web/API/Screen/width) 的單位是 CSS 像素，並非直接採用面板原生解析度。

修改架構適配層的 `currentScreenPixels`：原生全螢幕時使用實際顯示區的 `innerWidth/innerHeight`；視窗模式維持整個 `screen` 的尺寸，不把小 iframe 當成整台螢幕。原 `stimulusPixels`、視角換算、Accuracy／TFF／移動時間仍各自使用同一份像素資料與原公式。校正的 viewport signature 同步使用這份資料，避免回報的 `screen` 不變時，跨比例螢幕切換仍誤認為校正有效。相機就緒按「開始校正」時，重新取得已穩定的全螢幕尺寸，避免初始化時尚未完成的 fullscreen resize 使它誤降為無眼動；若已退出全螢幕，或校正途中尺寸改變，原失效檢查仍生效。

在 1440×960、48×32 cm 的 3:2 模擬設定下，實際 DOM 為約 31.41×31.41 px；同一顯示區沿用 48×27 cm（16:9）時為約 31.41×37.23 px，保留變形。單元測試另驗 100%／125%／150%／200% 等比例縮放下的圓形與大小一致性。這些是虛擬量測及瀏覽器驗證，不是使用者筆電或實體尺量驗收。非原生全螢幕仍依賴瀏覽器的 `screen` 回報，若該值遭遮蔽，無法保證實體換算精度。

## TDD 與回歸

測試先失敗，再修改產品碼：

- 依使用者補充要求，新增「比例正確為圓、單軸填錯會變形」與「兩軸同倍率填錯仍圓但大小錯誤」測試；先前強制圓形版本在第一項失敗，且原碼摘要不符。還原原公式後兩項與完整 22 段原碼摘要通過。中文／英文即時狀態原先缺少 DOM 與文案；校正點擊沒有重新檢查已失去的訊號。
- 3:2 顯示區的測試先重現 `screen` 回報 16:10 而失敗；單元測試亦先重現期望 1440 卻得到 1280 的校正尺寸。改用原生全螢幕實際顯示區後通過，錯誤物理比例仍維持橢圓；非全螢幕小視窗仍使用整台螢幕資料。
- 相機回歸另重現全螢幕尺寸在 setup 後才穩定，準備開始校正卻被誤判為幾何改變並降為無眼動；測試先得到 `off` 而非 `webgazer`。開始校正前重新取得尺寸後通過，另驗退出全螢幕／校正途中變動仍拒絕沿用。
- 中文五點驗證仍顯示英文；中文設定錯誤回報 `Invalid activity mode.`。
- 主成果仍是時間／完成數／Accuracy，metadata 排在統計前，TFF 方向暴露機器值。
- PWA 成果沒有獨立入口的頂部預留空間；修正後以實際安裝控制與標題座標驗證。
- Brave 實際檢查另重現參考 CSS 在遊戲 CSS 之後載入而覆寫版面，以及 600px 高度時提示偏上 32px，均已修正。曾在 Hub 重建刪除輸出期間啟動的三個流程因缺少 `out/index.html` 失敗；建置完成後重跑通過。

`scripts/fixtures/ocutrain-reference.json` 的原 22 段摘要沒有改寫，全部 22 段逐字比對，包含還原的 `stimulusPixels`。另以不同螢幕比例、1／60／600 角分、單軸錯誤與等比例錯誤行為測試覆蓋。有效閾值、Accuracy、TFF 與四種原刺激迴圈保持原計算。

通過：

- `npm run test:naming`
- `npm run test:pwa`（18 項）
- `npm run test:game-architecture`（197 項，包含眼動對齊 26 項）
- `npm run test:hub-functions`（121 項，包含真實 CSV 建立、私人讀取、重試、版本及身份隔離）
- `npm run test:gamerunner`（49 項）
- `npm run test:entrypoints`
- `npm run test:cloudflare-deploy`（4 項）
- 眼動 Vite build、`npm run build:hub` 及發布 dry-run。Hub 本機候選因既存 Gabor registry 為 33 款舊 bundle，**不得部署此完整工作樹**；正式 Gabor 狀態不由本次修改。

本機 Brave（實際原版模型、已核對圖片串流；只寫本機 SQLite／測試 R2）：

| 入口 | 尺寸／語言 | 活動 | 驗證 |
| --- | --- | --- | --- |
| Hub | 桌機／中文 | 跳視，眼動開啟 | 置中與即時狀態、18 次校正點擊、雙語驗證、圓形、Accuracy／TFF、CSV 及摘要分別失敗後重試 |
| Hub | 手機／中文 | 凝視，眼動開啟 | 文字不重疊、圓形、成果、保存重試 |
| Hub | 平板／英文登入 | 追視，眼動開啟 | 英文驗證與版面、圓形、帳號保存及身份隔離 |
| Hub | 平板／中文 | 凝視，眼動關閉 | 缺測與不適用、無相機、沒有 CSV |
| Hub | 平板／中文、故意填錯高度 | 凝視，眼動關閉 | `--incorrect-screen-height` 將高度填為兩倍，實際刺激寬高比約 2:1，確認變形保留 |
| Hub | 3:2 桌機／中文 | 中央辨識，眼動關閉 | `--screen-3-2`，正確 48×32 cm 呈圓形，即使 `screen` 回報其他比例 |
| Hub | 3:2 桌機／中文、沿用 16:9 尺寸 | 中央辨識，眼動關閉 | `--screen-3-2 --measurements-16-9`，48×27 cm 呈橢圓 |
| 獨立 PWA | 手機／中文 | 中央辨識，眼動開啟 | 數字圓形、驗證、成果標題不被安裝控制遮擋、25 欄 CSV 下載、模型與引擎離線快取、不上傳 |

瀏覽器使用與模擬螢幕比例相符的虛擬物理尺寸作為正確設定 fixture，另以錯誤高度流程驗證變形；桌機明確指定 1280×720（16:9）的整屏測試，3:2 指定 1440×960。原本以含瀏覽器工具列差異的視窗可見區作為整屏量測 fixture，會在進入全螢幕後產生錯誤的比例預期，因此改為明確的模擬顯示尺寸。不把虛擬尺寸當作實體尺量驗收。截圖與本機驗證摘要位於 [evidence.json](migrations/oculomotor-display-feedback-2.1.1/evidence.json) 同目錄。

## 發布與限制

本次只發布眼動遊戲，不部署 Hub／runner 或修改可信代理版本。已核對當版 11 個正式公開檔案的長度與 SHA-256、current／歷史摘要、正式目錄、無快取穩定 PWA 入口、固定版本工作階段及原 sandbox／相機政策；沒有記錄工作階段 token／測試 Subject ID，也沒有寫入正式訓練紀錄。`2.1.0` 的 11 個回退公開檔案全部核對，保留 `node scripts/publish-official-game.mjs oculomotor-training --activate-version 2.1.0`，未執行回退。

正式瀏覽器六流程為：16:9 桌機 Hub 跳視、3:2 Hub 追視與眼動、3:2 Hub 故意沿用 16:9 尺寸的變形、手機 Hub 凝視（相機拒絕／session 失敗與重試）、英文登入平板 Hub 追視、手機獨立 PWA 中央辨識。正式 Hub／R2 資產直接讀公開站，保存 API 只攔截至本機 SQLite／測試 R2；獨立 PWA 驗 CSV 下載與實際離線模型／引擎。逐流程與截圖見 [validation-summary.json](migrations/oculomotor-display-feedback-2.1.1/validation-summary.json)。

發布前另發現既有平台差異：GitHub `main` 的 `9ae05614c752b5174fabf1c4573780e7c3c9bb36` 已成功自動部署（[workflow](https://github.com/ian030590/RehabTrainerHub/actions/runs/38974377389)），帶入尚未核准的 Gabor registry。正式目錄仍只有六個可讀 R2 發布，但 Gabor 舊 `settings.json` 已為 410、新 R2 候選仍未發布。此狀態在本次眼動發布前後相同，Hub deployment `4bdef687-cef7-4b92-a8cf-fa801f4ca6a2` 與 runner `2af33d05-6648-4aef-b806-cbacef7e4266` 皆未變更；不能再將 `2.1.0` 發布當時的「六 registry／34 舊 bundle／Gabor 舊入口正常」當成目前平台狀態。本次不發布 Gabor、不部署或回退平台，將眼動提交推到專用分支執行 CI，後續 Gabor 平台修復須另行處理。

尚未驗真人／實體相機、實體螢幕尺量、實體觸控及 Safari／iOS；圖片串流與 Brave 尺寸模擬不能代替硬體驗收。沒有讀取私人 CSV 的逐筆內容。
