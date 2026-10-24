# 官方遊戲目錄

每款官方遊戲以 `games/<game-id>/` 為自己的 workspace，建置成自包含的 R2 遊戲，由 runner 隔離站提供。
遊戲自己呈現設定、教學與成績；Hub 不複製遊戲的設定或規則，只負責啟動、交還上次確認的設定，並透過私有 MessageChannel 收下成果、保存紀錄。
遊戲不得有 `settings.json`／`score.json`，也不得引入 `packages/ui`、`@rehab-trainer/*` 或其他遊戲的程式。
完整規範見 `AGENTS.md` 與 `docs/r2-game-migration-plan.md`。

新增官方遊戲時：

1. 自己建立 `games/<game-id>/` 的 `package.json`、`vite.config.ts` 與 `main.tsx`，以 `public/game.json`
   宣告目錄文案、分類與預覽圖，再執行 `npm install --package-lock-only --ignore-scripts` 更新 lockfile。
   不要靠 `npm run sync:games` 產生 workspace：它的範本依賴 `@rehab-trainer/ui`，不適用 R2 遊戲。
2. 把遊戲加入 `catalog.ts`，並在 `packages/ui/src/officialGameReleases.json` 登記 gameId。
   遊戲資料夾、`catalog.ts` 與登記表不一致時，`npm run test:game-architecture` 會失敗；登記後逐遊戲檢查會自動包含這款遊戲。
3. 新增 `scripts/check-<game-id>-game.test.mjs`，並從已在 CI 執行的測試引入它（例如 `scripts/check-self-contained-game.test.mjs`）。
   沒有被 CI 執行到的測試檔會讓 gate 失敗。
4. 把遊戲加入共用的 `check-r2-game-ui`、`check-r2-game-results`、`check-r2-settings-memory` 測試，
   或在該檔的豁免清單寫明這款遊戲尚未涵蓋。研究契約、音訊與訓練流程測試也會指出要補上的項目。
5. 執行 `npm run test:game-architecture`、`npm run test:entrypoints` 與
   `npm --prefix apps/rehabtrainerhub/games/<game-id> run build`。
6. 擁有者核准精確的 version／contentSha256 後才發布 R2，發布完成再 push 登記變更（見 `AGENTS.md`）。

第三方開發者的 ZIP 契約與隔離執行規範請見 `docs/developer-game-packages.md`。
