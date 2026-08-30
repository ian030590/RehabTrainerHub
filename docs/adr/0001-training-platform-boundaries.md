# ADR 0001：訓練模組、上傳遊戲與離線資產邊界

狀態：Accepted

日期：2026-08-28

## 決策

1. 官方訓練採 module-owned jsPsych run。每局由 official host 建立新的 iframe realm；engine、renderer、model、media stream、timer 與 listener 都由該模組建立並在 `dispose()` 釋放。Hart Chart 與駕駛注意力模擬保留既有 lifecycle，列為本輪轉換例外。
2. 上傳遊戲分成兩層：預設的 declarative/受限 SDK tier 與經隔離掃描、人工審查的 arbitrary HTML tier。任意 JavaScript 不宣稱能以 regex、CSP 或 iframe 絕對保證零外傳或零病毒；確認的 malware、ZIP bomb、path traversal 與加密壓縮檔一律 hard block，不提供人工繞過。
3. Production runtime 只使用平台控制的版本化、SHA-256 資產（R2/Pages）；不使用 jsDelivr、unpkg 或 Google model URL 作 fallback。CDN 僅是平台傳輸層，不能代替版本與完整性來源。
4. Hub PWA 只 precache shell；單一官方遊戲透過 authenticated immutable offline manifest 明確下載 dependency closure。PWA 安裝與遊戲離線包是兩個狀態；第三方 runner 維持獨立 origin/cache scope。
5. pnpm 11.24.0 是唯一套件管理器。一般本機磁碟使用 pnpm 標準 `nodeLinker: isolated`、`packageImportMethod: auto` 與 workspace symlink，讓每個 package 的依賴宣告保持可驗證且不依賴 hoist。

## 後果

- 共享的是 immutable bytes 與 dependency-free contract，不共享 jsPsych、Pixi、Three、MediaPipe、TensorFlow、WebGazer 或 media state。
- 首次 PWA 安裝的下載量較小，但使用者必須明確下載要離線的遊戲，且需要可用容量與完整性檢查。
- arbitrary HTML 仍需持續更新 parser、signature、動態 smoke 與人工審查工具；scanner report 不能被視為絕對安全證明。
- 本機與 CI 統一使用 `pnpm install --frozen-lockfile`；Node 與 pnpm 版本由 `.node-version` 和 root `packageManager` pin。
