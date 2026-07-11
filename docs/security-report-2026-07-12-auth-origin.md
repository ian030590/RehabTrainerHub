# 資安漏洞報告：localhost Origin 預設信任造成訓練紀錄外洩

日期：2026-07-12

## 摘要

白箱測試發現，production 環境的 auth CORS 預設白名單包含 `http://localhost:3010`、`http://localhost:5173`、`http://localhost:5174`、`http://localhost:5175` 與對應的 `127.0.0.1` origin。若個案已登入 Rehab Trainer Hub，任何在個案電腦 localhost 指定 port 上執行的網頁，都可以用瀏覽器自動帶上的 hub cookie 呼叫 `/api/auth/session`，取得 bearer token，接著讀取 `/api/records` 訓練紀錄。

## 影響

- 影響資料：登入使用者的遠端訓練紀錄，包含訓練 app、模組、難度、日期、個案名稱與成績明細。
- 影響端點：`/api/auth/session`、`/api/records`，以及其他依賴 shared auth CORS 規則的 auth endpoint。
- 攻擊條件：受害者已登入；攻擊者能讓受害者瀏覽器載入 localhost 白名單 port 上的惡意頁面或被植入的本機服務頁面。
- 嚴重度：高。這會把 HttpOnly cookie 兌換成 JavaScript 可讀 bearer token，進而讀取個案訓練資訊。

## 驗證結果

測試使用本地 function handler 與假的 D1 database，不連線到 production。

攻擊前行為：

1. 未帶 bearer token 呼叫 `/api/records`：`401 Unauthorized`。
2. 帶偽造 bearer token 呼叫 `/api/records`：`401 Unauthorized`。
3. 帶受害者 cookie 且 `Origin: http://localhost:5173` 呼叫 production host `/api/auth/session`：`200 OK`，回應含 session token。
4. 使用該 token 呼叫 `/api/records`：`200 OK`，回應含訓練紀錄。

## 根因

`apps/rehabtrainerhub/functions/_lib/auth.js` 的 `DEFAULT_ALLOWED_ORIGINS` 同時包含 production Pages domains 與 localhost dev origins。這讓 production 預設信任 localhost origin。`/api/auth/session` 又會把 HttpOnly cookie 對應的 session token 回傳給允許的 origin，因此 localhost 網頁可取得 bearer token。

此外，原本部分 endpoint 僅在 CORS headers 層面不回傳 `Access-Control-Allow-Origin`，但沒有在 handler 開頭拒絕不允許的 `Origin`。這不應作為敏感 auth/token endpoint 的唯一防線。

## 修補

已完成：

- production 預設白名單只保留正式 Pages origins。
- localhost origins 只在以下情況加入白名單：
  - request host 本身是 localhost/127.0.0.1/[::1]，供本機 hub 開發使用。
  - 明確設定 `AUTH_ALLOW_LOCAL_ORIGINS=1`。
- 新增 shared `rejectDisallowedOrigin(request, env)`，在 auth 與 records endpoint handler 開頭直接回 `403`。
- OAuth `returnTo` 檢查改用相同的 request-aware origin 規則。
- 新增 `apps/rehabtrainerhub/functions/_lib/auth.origin.test.mjs`，覆蓋 production localhost 擋下、production trainer 允許、本機 hub localhost 允許、records endpoint 擋下等情境。

## 修補後驗證

建議驗證命令：

```bash
node apps/rehabtrainerhub/functions/_lib/auth.origin.test.mjs
node --check apps/rehabtrainerhub/functions/_lib/auth.js
node --check apps/rehabtrainerhub/functions/api/records.js
npm run build:hub
```

預期結果：

- production host 搭配 `Origin: http://localhost:5173` 呼叫 `/api/auth/session`：`403`。
- production host 搭配正式 trainer origin：正常回應。
- 本機 hub host 搭配 localhost trainer origin：正常回應，避免破壞開發流程。
