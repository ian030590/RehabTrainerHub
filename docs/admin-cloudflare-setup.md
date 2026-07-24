# 治療師後台與 Cloudflare 上線指南

本文件涵蓋 `/admin`、D1、KV、R2、Turnstile、Web Analytics，以及 AI 模型 CDN 的正式環境設定。程式可在未設定 Cloudflare 額外服務時建置；需要的綁定或金鑰未就緒時，受影響功能會明確失敗或採用既定 CDN fallback，不會默默降低驗證強度。

## 架構與權限

```text
Trainer -> /api/records -> D1 training_records
                              |
Therapist -> /admin -> assigned patient query -> JSON / CSV + audit

Therapist -> article editor -> D1 education_articles
                                  |
                                  +-> ARTICLE_CACHE (published pages)
                                           |
Patient -> /qa -> /api/articles -----------+

Article cover / AI assets -> R2 -> assets.trainerhub.cc -> Cloudflare CDN
```

- `app_users.role` 可為 `patient`、`therapist` 或 `admin`。
- `admin` 可以查看所有病患；`therapist` 只能查看 `therapist_patient_assignments` 指派的病患。
- 後台 API 以 Hub 的 HttpOnly session cookie 為預設認證，並在每次請求向 D1 查詢目前角色。Production 不應啟用 `ADMIN_ALLOW_BEARER`。
- 訓練紀錄標示為「客戶端回報」，不可當成經醫療人員驗證的量測。API 會限制大小、結構、頻率並保留伺服器接收時間。
- CSV 匯出會做欄位公式中和、分批 keyset 查詢、筆數上限與稽核記錄。
- 後台首頁最多預載 500 位病患供快速選擇；仍可直接輸入完整 patient ID 查詢其資料。

## 1. D1 migration 與 Pages bindings

先套用 migration，再部署依賴新 schema 的版本：

```bash
npx --yes wrangler@4 d1 migrations apply rehab_db \
  --config apps/rehabtrainerhub/wrangler.toml --remote
```

Hub Pages Functions 使用：

```text
REHAB_DB       D1
ARTICLE_CACHE  KV
ASSET_BUCKET   R2
```

`apps/rehabtrainerhub/wrangler.toml` 已宣告三個 binding；部署腳本會傳入 Wrangler 的 experimental provisioning / auto-create 旗標。首次正式部署後，仍應在 Cloudflare Dashboard 的 Pages 專案中確認三個 binding 都已存在且指向預期資源。

Cloudflare API token 至少需涵蓋本流程使用的 Pages、D1、KV 與 R2 編輯權限，並設定正確的 `CLOUDFLARE_ACCOUNT_ID`。請將 token 放在 GitHub environment secret，不要寫入 repository。

若 Wrangler 顯示 `The database ... could not be found [code: 7404]`，通常代表目前登入的 Cloudflare account 或 `CLOUDFLARE_ACCOUNT_ID` 不是擁有該 D1 database 的帳號。先修正 account/token，再重跑 migration 或角色設定。

## 2. 指派管理員、治療師與病患

先查詢使用者：

```bash
npx --yes wrangler@4 d1 execute rehab_db \
  --config apps/rehabtrainerhub/wrangler.toml --remote \
  --command "SELECT id, display_name, email, role FROM app_users ORDER BY created_at DESC"
```

設定角色：

```bash
npx --yes wrangler@4 d1 execute rehab_db \
  --config apps/rehabtrainerhub/wrangler.toml --remote \
  --command "UPDATE app_users SET role='admin', updated_at=datetime('now') WHERE id='ADMIN_USER_ID'"

npx --yes wrangler@4 d1 execute rehab_db \
  --config apps/rehabtrainerhub/wrangler.toml --remote \
  --command "UPDATE app_users SET role='therapist', updated_at=datetime('now') WHERE id='THERAPIST_USER_ID'"
```

建立治療師與病患關聯：

```bash
npx --yes wrangler@4 d1 execute rehab_db \
  --config apps/rehabtrainerhub/wrangler.toml --remote \
  --command "INSERT INTO therapist_patient_assignments (therapist_id, patient_id, assigned_by_user_id, assigned_at, updated_at) VALUES ('THERAPIST_USER_ID', 'PATIENT_USER_ID', 'ADMIN_USER_ID', datetime('now'), datetime('now')) ON CONFLICT(therapist_id, patient_id) DO UPDATE SET assigned_by_user_id=excluded.assigned_by_user_id, updated_at=excluded.updated_at"
```

解除指派：

```bash
npx --yes wrangler@4 d1 execute rehab_db \
  --config apps/rehabtrainerhub/wrangler.toml --remote \
  --command "DELETE FROM therapist_patient_assignments WHERE therapist_id='THERAPIST_USER_ID' AND patient_id='PATIENT_USER_ID'"
```

角色與指派應由可信任的管理流程執行，不要做成公開的前端自助功能。

## 3. Turnstile

建立 Managed widget，將以下正式 hostname 加入允許清單：

```text
trainerhub.cc
motor.trainerhub.cc
vision.trainerhub.cc
brain.trainerhub.cc
mouth.trainerhub.cc
```

GitHub `cloudflare-pages` environment 設定：

| 類型 | 名稱 | 說明 |
| --- | --- | --- |
| Secret | `TURNSTILE_SECRET_KEY` | Pages Functions 呼叫 Siteverify 的 secret |
| Variable | `TURNSTILE_SITE_KEY` | 前端 widget site key |
| Variable | `TURNSTILE_REQUIRED` | 設為 `1` 才強制保護註冊、密碼登入與 OAuth 啟動 |
| Variable | `TURNSTILE_RECORDS_REQUIRED` | 設為 `1` 才強制保護訓練紀錄上傳 |

兩個 required flag 都是明確開關，預設為 `0`。正式環境請先同時設定 site key 與 secret，再把需要的旗標改成 `1`；缺少任一 key 時部署環境同步會拒絕啟用 required 模式。

Server 端會檢查 Siteverify 結果、預期 action 與 hostname。訓練紀錄使用 explicit execution：只在要上傳時取得一次性 token，不會在遊戲過程持續執行 challenge。

## 4. R2、CORS 與 AI 資產 CDN

1. 建立 R2 bucket，並讓 Hub 的 `ASSET_BUCKET` binding 指向該 bucket。
2. 綁定正式 custom domain，例如 `assets.trainerhub.cc`。正式環境不要以 `r2.dev` 當長期資產網址。
3. 套用 CORS：

```bash
npx --yes wrangler@4 r2 bucket cors set R2_BUCKET_NAME \
  --file scripts/r2-cors.json
```

4. 先驗證本機來源與遠端模型的固定 size / SHA-256，再上傳：

```bash
node scripts/sync-r2-ai-assets.mjs --bucket=R2_BUCKET_NAME --dry-run
node scripts/sync-r2-ai-assets.mjs --bucket=R2_BUCKET_NAME
node scripts/verify-r2-ai-assets.mjs --base-url=https://assets.trainerhub.cc
```

Manifest 內每個物件都有 versioned key、精確大小及 SHA-256。同步程式只接受符合 manifest 的 bytes；上游檔案一旦改變會停止上傳，必須更新 digest 並改用新的 versioned key，避免既有一年快取讀到不同內容。

上傳 metadata：

```text
Cache-Control: public, max-age=31536000, immutable
```

驗證器會對所有 manifest 物件送出 `HEAD`，並預設檢查四個 trainer origin 的 CORS、HTTPS，以及至少一年且帶有 `immutable` 的快取標頭。若正式 origin 不同，可用逗號指定：

```bash
node scripts/verify-r2-ai-assets.mjs \
  --base-url=https://assets.trainerhub.cc \
  --origin=https://motor.example.com,https://vision.example.com
```

GitHub variables：

```text
AI_ASSET_BASE_URL=https://assets.trainerhub.cc
ASSET_PUBLIC_BASE_URL=https://assets.trainerhub.cc
```

- `AI_ASSET_BASE_URL`：MediaPipe WASM、`.task` 模型、WebGazer，以及大型遊戲圖片 / 3D 模型的主要來源。
- `ASSET_PUBLIC_BASE_URL`：後台文章封面上傳後可公開存取的 base URL。
- MediaPipe 載入失敗時會退回固定版本的官方 / jsDelivr 資源。
- VisionTrainer 會先載入 R2 WebGazer，再由本地 loader 退回 app 內的 `/webgazer.js`。
- 星空背景與 3D 車輛會優先使用 R2，失敗時保留 Pages 內的本地副本。

只有 `main` production build 會注入 R2 AI base；未綁定 production custom domain 的 preview build 會使用 fallback，避免產生無法存取的 hash-preview 資產網址。

## 5. KV 文章快取

公開文章列表與文章內容會先讀 `ARTICLE_CACHE`；cache miss 才查 D1。新增、修改、刪除文章時會失效相關 key。KV 不作為權限或唯一資料來源，D1 仍是權威資料庫。

若 KV 暫時不可用，公開文章 API 仍可直接讀 D1；寫入流程不會因 cache 清除失敗而回報文章資料寫入失敗。

## 6. Cloudflare Web Analytics

建立 Web Analytics site token，設定 GitHub variable：

```text
CF_WEB_ANALYTICS_TOKEN=<site token>
```

Hub 與四個 trainer 只有在 token 存在時才注入 RUM beacon。不要把 user ID、email、訓練 payload 或醫療資訊放入 analytics 參數。上線後依 hostname、browser 與 device type 觀察 Core Web Vitals。

## 7. 低效能裝置提示

四個 trainer 共用進場檢測：取樣約 45–60 個 animation frames，並參考 `hardwareConcurrency` 與可用時的 `deviceMemory`。低效能裝置只顯示可關閉提示，不會直接阻擋復健流程。

未來若要自動降低 MediaPipe 偵測幀率、renderer 解析度或 WebGL 效果，應在各訓練模組內依 renderer 特性實作，不要把長生命週期的遊戲狀態放進共用 UI package。

## 8. Preview 與正式驗收

Pages hash preview 可能因同源 HttpOnly cookie、OAuth callback hostname 與 Turnstile hostname 清單而不適合完整驗證管理員登入。請在受控的 staging custom domain 或正式 canonical domain 驗收：

- therapist 只能看到被指派病患；
- admin 可以看到所有病患；
- JSON / CSV 篩選與下載；
- 草稿、發布、取消發布、編輯與刪除文章；
- 問答中心只顯示已發布 Card，點開後才載入完整內容；
- 封面上傳、舊封面清理與 R2 公開網址；
- Turnstile 的成功、過期及錯誤流程。

## 9. 驗證指令

```bash
npm run test:hub-functions
npm run test:entrypoints
npm --workspace @rehab-trainer/motortrainer run test:asteroid-shield-fullscreen
npm run build:hub
npm run build:motor
npm run build:vision
npm run build:brain
npm run build:mouth
npm run test:cloudflare-deploy
npm run test:changed-trainer-smoke
```

正式發布前最後確認：

- migration 已套用；
- D1 / KV / R2 bindings 正確；
- 第一位管理員與治療師角色、病患指派已建立；
- Turnstile keys 與 explicit required flags 正確；
- R2 custom domain、CORS、manifest 上傳與遠端 verifier 全部通過；
- Web Analytics token 已設定；
- GitHub environment secrets / variables 完整；
- canonical domain 的登入、後台、文章與資料下載 smoke test 通過。
