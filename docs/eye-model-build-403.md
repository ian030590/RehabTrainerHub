# 眼動模型冷建置 403 修正（2026-11-10）

GitHub Actions [42835838828](https://github.com/ian030590/RehabTrainerHub/actions/runs/42835838828) 的 Hub 建置成功，runner 在 `BuildEyeTracking` 下載模型時收到 HTTP 403，因此未進入部署步驟。這不是 Hub UI 編譯或眼動演算法失敗。

## 原因與範圍

原建置讀取忽略版控的 `.tmp/eye-tracking-model/`；只有沒有有效快取時才透過 TFHub 下載。本機 `test:pwa` 雖然也建置 runner，但一直使用有效快取，因此沒有驗證 CI 的冷建置情境。

此主機重新下載四個來源時皆得到 HTTP 200，並與既有快取、固定 manifest 的大小及 SHA-256 完全相符；這不代表 CI 的 403 沒有發生。TFHub 目前經 Kaggle 與限時簽名下載網址取得檔案，不能要求每次乾淨建置都依賴同一個即時外部回應。

修正將既有四份檔案（共 **3,514,613 bytes**）隨倉庫提供，manifest 增加 `source`，保留原始 `sourceUrl`、大小與雜湊。建置只讀本機來源，逐檔核對大小與 SHA-256；損毀或遺失仍使建置失敗，不回退到舊快取或外部下載。兩個眼動輸入版本的模型內容不變。

模型的 JSON／BIN 設為 Git `-text`，避免跨平台換行轉換。來源、固定摘要與官方模型頁見 [模型 README](../apps/usergamerunner/runtime/eye-tracking-model/README.md)，Apache 2.0 全文併入 runner 既有 third-party notices。沒有修改 WebGazer、校正、推論、capability、沙盒、遊戲版本或 R2 登記；手部與其他感測器建置保持原流程。

## TDD

新增 `apps/usergamerunner/tests/eyeTrackingBuild.test.mjs`，自動由 `test:gamerunner` → `test:ci` 執行。測試執行實際模型建置程式與真實檔案／SHA 校驗，僅替換 Vite 打包步驟；外部下載固定回應 403。

修正前 **5 fail／1 pass**，修正後 **6／6 通過**：

1. 沒有快取且上游 403 時，仍產出兩個輸入版本的完整固定模型。
2. 舊快取損毀不能取代隨倉庫提供的模型。
3. 等長但 SHA 不符的本機來源，即使存在有效舊快取也必須失敗。
4. SHA 正確但宣告大小錯誤仍失敗。
5. 遺失來源不能靜默使用舊快取或外部回應。
6. 實際四份來源的大小、凍結 SHA、歷史來源與 Git bytes 設定正確。

本機原始證據位於 `.tmp/eye-model-build-fix/`：`red.txt`、`green.txt`、`source-verification.json`；不將限時簽名網址或暫存建置輸出納入版控。

## 驗證

`npm run test:gamerunner`：84／84 通過，包含新增六項測試。

`npm run build:cloudflare:only`：Hub 與 runner 均通過；兩個輸入版本共八份輸出模型逐檔核對大小與 SHA-256，全部符合固定 manifest。

完整修正驗收執行 `npm run build:cloudflare:only`、推送前七項 gate 與本機瀏覽器 gate；另逐檔核對建置後兩個眼動輸入版本的模型摘要。推送後以 GitHub Actions 的實際冷建置結果確認交付，不能只以本機有效快取的成功紀錄判定完成。
