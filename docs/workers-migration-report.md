# Cloudflare Workers 搬遷執行報告

日期：2026-10-19。依 [搬遷計畫](workers-migration-plan.md) 把 Hub 與 runner 從 Cloudflare Pages 搬到 Workers `trainerhub`、`trainerhubgames`。擁有者於同日要求直接遷移，略過隔離測試站（C05）。切換與正式驗證結果見第 5 節。

## 1. 擁有者決定

| 節點 | 擁有者答覆（2026-10-19） | 範圍與處理 |
| --- | --- | --- |
| C01 審核排程 | 依建議維持獨立 | 帳號中沒有部署 `rehab-game-review-issues`（唯讀查詢 Workers 只有 `bible-api`），目前沒有排程可整併。不搬 GitHub App 憑證。 |
| C02 網域 | Hub 維持 `trainerhub.cc`；runner 用 `trainerhubgames.rainbowh9490.workers.dev` | Hub 用 Workers Routes（zone `5851e45310addcd4587d15f8356340e5`）接手 `trainerhub.cc/*` 與 `motor`／`vision`／`brain`／`mouth` 子網域。四個子網域目前沒有 DNS 紀錄，route 要在補上 proxied 記錄後才會收到流量，和 Pages 時期相同。擁有者曾提出 `games.trainerhub.cc`：與 Hub 同站，runner 上的程式可覆寫沒有 `__Host-` 前綴的登入 cookie，違反隔離規範，未採用。`trainerhubgames.workers.dev` 不是 workers.dev 可用的格式；縮短帳號子網域會改到 `bible-api` 的網址，擁有者選擇維持 `rainbowh9490`。舊 `trainerhub-user-games.pages.dev` 保留到 C12，已安裝的 PWA 繼續使用。 |
| C03 權限 | `CLOUDFLARE_API_TOKEN` 已補 Workers Scripts Edit 與 Workers Routes Edit | Routes 使用 `zone_id`，CI token 不需要 Zone Read。本機以擁有者的 wrangler 登入做唯讀查詢（workers.dev 子網域、zone、既有 routes 與 scripts），token 沒有輸出。第一次 CI 部署時 token 無法存取 `trainerhubgames`，需改設 Workers `Admin`（第 5 節）。 |
| C04 搬遷前保護 | 未要求匯出 | 沿用同一個 D1／R2，不匯出正式資料；切換前記錄 D1 Time Travel bookmark（第 5 節）。 |
| C05 候選部署 | 直接遷移 | 不建立測試站，以本機 workerd 檢查、runner 先行上線與切換後正式檢查代替。 |
| C06 正式切換 | 直接遷移；已設定 `CLOUDFLARE_DEPLOY_TARGET=workers` | push 到 `main` 由 workflow 部署。出錯時刪除 `trainerhub` 的 routes，流量回到仍綁著網域的 Pages。 |
| Builder | 不再製作 RehabBuilder，`BUILDER_CLIENT_SECRET` 可刪除 | 移除 Hub 的 Builder 連結、交接 API 與文案（第 2 節）。 |
| C07 至 C13 | 未開始 | 排程交接、pCloud 備份、舊環境退役與資料還原另行確認。 |

Pages 專案 `rehabtrainerhub` 另外設定、CI 沒有同步的變數：擁有者確認只有 `BUILDER_CLIENT_SECRET`。它只供 `/api/builder/*` 與 `builder.trainerhub.cc` 交接使用，該網域沒有 DNS 紀錄；新程式已移除這組 API，不需要設到 Worker。

## 2. 變更

| 檔案 | 內容 |
| --- | --- |
| `apps/rehabtrainerhub/wrangler.workers.jsonc` | Worker `trainerhub`。D1／KV／四個 R2 binding 與 `wrangler.toml` 相同 ID；五條 routes；`run_worker_first: true`、`404-page`；`workers_dev`、`preview_urls` 關閉。 |
| `apps/usergamerunner/wrangler.workers.jsonc` | Worker `trainerhubgames`。只綁 `rehab-game-releases`；`workers_dev: true`；`run_worker_first` 對應 `public/_routes.json`；`single-page-application`。 |
| `apps/usergamerunner/package.json`、`packages/ui/src/officialGameReleases.json`、`functions/api/games.js` | runner origin 改為 `https://trainerhubgames.rainbowh9490.workers.dev`（十款 R2 遊戲的可信 origin 與 Hub 預設值）。 |
| `apps/*/worker/index.js`、`workers/shared/pagesAssetCompat.js` | Worker 入口載入 `wrangler pages functions build` 編譯的原 Functions；相容層只包住 `ASSETS`，補回 Pages 對靜態檔的預設標頭、308 轉址與 404 `no-store`。 |
| `scripts/workers-apps.mjs`、`build-workers.mjs`、`deploy-cloudflare-workers.mjs` | 設定比對、Functions 編譯、部署（D1 migrations → runner → Hub，Hub secrets 以 `--secrets-file` 隨同一版本上傳）。缺少 Hub routes、runner origin 與 registry 不一致或 runner 綁到私人資源時拒絕部署。 |
| `.github/workflows/deploy-cloudflare-pages.yml` | 變數為 `workers` 時跳過 Pages 步驟、執行 Workers 步驟；Workers 步驟只在 `main` 執行，手動從其他分支觸發不會覆蓋正式站。 |
| `scripts/pages-apps.mjs`、`sync-cloudflare-pages-domains.mjs` | Pages 回退流程遇到 workers.dev origin 時不嘗試綁成 Pages 自訂網域。 |
| `scripts/check-r2-game-browser.mjs` | runner origin 改由 `apps/usergamerunner/package.json` 讀取。 |
| RehabBuilder 移除 | 刪除 `functions/api/builder/*` 與 `_lib/builderAuth.js`、帳號選單的「活動編輯器」連結、投稿頁的 `builder_ticket` 接收流程與開發者文件中的 Builder 文案。原生 HTML 套件投稿保留，原本 Builder 測試中的「原生套件投稿 → 審核 → 保存成績」流程移到 `functions/api/game-submissions.native.test.mjs`。D1 表 `builder_auth_codes` 保留不刪（只存 5 分鐘有效的授權碼，刪表需另一個 migration）。 |

Pages 的 `wrangler.toml` 與部署腳本保留為回退路徑。

## 3. Pages 與 Workers 的行為差異

基準取自 2026-10-19 以 `curl` 讀取的正式站公開回應。「直接轉換」指照官方指南把 `pages_build_output_dir` 換成 `assets.directory`、入口改用編譯後 Functions，其餘不設定。

| 項目 | Pages 正式站 | 直接轉換的 Worker | 處理 |
| --- | --- | --- | --- |
| Hub middleware 順序 | 每個請求先執行 `_middleware.js`（自動路由 `/*`） | 有檔案就直接回靜態檔：已遷移遊戲舊檔回 200、退役網域不轉址 | `run_worker_first: true` |
| Runner `/games/*` | `_routes.json` 讓 handler 先處理 | 輸出目錄裡的檔案可略過核准、雜湊與撤回檢查 | `run_worker_first` 對應 `_routes.json`，測試強制一致 |
| 靜態檔預設標頭 | 自動加 `Access-Control-Allow-Origin: *`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin` | 不加 | 相容層在缺少時補上；`_headers` 的值優先 |
| 尾斜線轉址 | 308 | 307 | 經 Worker 的路徑改回 308 |
| Hub 不存在的頁面 | `404.html`，`Cache-Control: no-store` | 空白 404 | `not_found_handling: 404-page`，相容層設 `no-store` |
| Runner 不存在的路徑 | 回 `index.html`（200） | 404 | `single-page-application` |
| `_routes.json` | Pages 自用，不公開 | 會變成可下載檔案 | `.assetsignore` |

評估後未處理的差異：非 HTML 靜態檔的瀏覽器快取由 `max-age=14400` 變成 `max-age=0, must-revalidate`，只增加重新驗證次數；runner 直接由 assets 提供的 `/`、`/robots.txt` 沒有 Pages 預設的 CORS 標頭，這些路徑沒有跨來源讀取需求。

## 4. 本機驗證

- 本機 HTTP（wrangler 4.151.1、workerd）：直接轉換版 16/27，失敗的 11 項就是第 3 節前七列；候選設定 27/27。
- RED → GREEN：`check-cloudflare-workers.test.mjs` 的 C02 測試先因缺少 routes 與 runner 仍是 pages.dev 失敗，改設定後通過；workflow 測試先因 Workers 步驟沒有限定 `main` 失敗，加上條件後通過；`check-builder-retired.test.mjs` 先因 Builder 連結、API 與狀態命名存在失敗（3/3），移除後通過。
- 七項 CI gate、`build:hub`、`build:gamerunner` 通過；修改的 JS 通過 `node --check`。
- 本機 Hub 輸出因資料夾同步工具改名部分檔案，HTTP 檢查使用修正檔名後的副本（`HUB_OUTPUT_ROOT`）；Linux CI 不受影響。

## 5. 切換與正式驗證

- 切換前 D1 Time Travel bookmark：`0000058c-00000000-00005109-7431c002868d16dd5414672c7c3dd5e4`。還原指令為 `npx wrangler d1 time-travel restore rehab_db --bookmark=<bookmark>`，執行前須另行確認。
- Runner：以擁有者的 wrangler 登入執行 `node scripts/deploy-cloudflare-workers.mjs --only=gamehost`，`trainerhubgames` 版本 `f6f8d944-a7db-4b5d-b68c-3281bf92b9e7`，binding 只有 `GAME_RELEASE_BUCKET` 與 `ASSETS`。與舊 Pages runner 比對 76 個請求：十款遊戲的 current 轉址相同（asteroid-shield 2.0.11、gesture-battler 2.0.6、drawing-defense 2.0.8、motor-cortex-rehab 2.0.4、oculomotor-training 2.1.3、moving-card 2.0.4、gabor-patching 2.0.3、reading-training 2.0.2、hart-chart 2.0.2、driving-rehab 2.1.0），manifest、service worker、package、`game.json`、404 與 POST 也相同。其餘差異是每次請求不同的 CSP nonce、第 3 節已評估的項目（`/` 與 `/robots.txt` 沒有 CORS 標頭、`/index.html` 轉址為 307、HTML 的 `Content-Type` 沒有 charset，頁面本身有 meta charset），以及 hand-tracking JS 的 MIME 由 `application/javascript` 變成 `text/javascript`，瀏覽器兩者都當 JavaScript 執行。
- Workflow run [39208075790](https://github.com/ian030590/RehabTrainerHub/actions/runs/39208075790)（commit `25620d7c`）：七項 gate 與 build 通過，Pages 步驟依變數跳過，D1 沒有待套用的 migration。部署 runner 時 Cloudflare API 回 `No access to the specified service`，重試三次後停止，Hub 沒有部署。`trainerhub.cc` 仍由 Pages 提供（`POST /api/builder/exchange` 仍回 401，`/api/games` 仍指向舊 runner），Worker `trainerhub` 尚未建立。
- 原因：CI token 對已存在的 `trainerhubgames` 沒有權限，可能是 Workers 權限只限定特定 Worker 或沒有 Workers 權限；wrangler 登入沒有讀取 API token 設定的權限，無法直接確認。另依 [Cloudflare Workers 權限說明](https://developers.cloudflare.com/workers/authorization/workers/)，建立新 Worker 需要產品層級的 `Admin`，Workers Scripts Edit 對應的 `Editor` 只能部署已存在的 Worker，所以第一次建立 `trainerhub` 也需要 `Admin`。
- 擁有者調整 token 後重跑失敗的 job，再補 Hub 版本 ID、正式網址比對與瀏覽器流程結果。

## 6. 回退

1. Workers & Pages → `trainerhub` → Settings → Domains & Routes，刪除五條 routes（或 `npx wrangler delete trainerhub`）。Pages 的自訂網域與 DNS 沒有動，流量立即回到最後一次 Pages 部署；那一版 Hub 指向舊 runner `trainerhub-user-games.pages.dev`，兩者仍可一起運作。
2. 刪除 repo variable `CLOUDFLARE_DEPLOY_TARGET`，之後的 push 改回部署 Pages。若要從新 commit 部署 Pages，先 revert C02 的 origin 變更，讓 Hub 指回舊 runner。
3. D1／R2 沒有改變結構或內容，回退不需要還原資料。

## 7. 後續

- Pages 專案的 `BUILDER_CLIENT_SECRET` 可以刪除；舊 Pages 部署的 Builder API 因為沒有對應服務，刪除後也沒有使用者受影響。
- C12 前保留兩個 Pages 專案；之後若要移除 Pages 自訂網域，需先在 DNS 為 `trainerhub.cc` 留一筆 proxied 記錄，routes 才能繼續生效。
- 舊 runner 的 Pages 專案 `trainerhub-user-games` 綁著自訂網域 `games.trainerhub.cc`，目前可以連線。這違反 runner 不得使用 `trainerhub.cc` 子網域的規範，Hub 也從未使用這個網址；建議擁有者在該 Pages 專案移除這個自訂網域與對應 DNS 記錄。
- 兩個 Worker 都建立後，CI token 的 Workers 權限可以改成只對 `trainerhub`、`trainerhubgames` 的 `Editor`；之後若要新增 Worker，再暫時改回 `Admin`。
