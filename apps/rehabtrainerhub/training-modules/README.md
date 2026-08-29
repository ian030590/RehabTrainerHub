# Hub 訓練模組

此目錄是 Motor、Vision、Brain、Mouth 實際訓練 runtime 的唯一來源。
`training-runtimes/*` 透過 `@rehab-trainer/hub-modules/*` 編譯這些程式碼；
Hub 大廳透過 `catalog.ts` 與 `moduleFlowManifest.ts` 裝載相同模組資料。

四個 trainer 統一遵循單向組合：

`Hub catalog -> training-runtimes/<trainer> shell -> training-modules/<trainer>`

`training-runtimes/*/src/App.tsx` 只負責 route、layout、語系與顯示設定，並以
dynamic import 載入對應 trainer module。頁面、config、rules、game loop、renderer、
input 與 results 實作不得放在 runtime shell 的 `src/pages/`。

所有可玩的 catalog 模組必須依序提供：

1. 訓練卡片
2. Trainer config（需要媒體輸入時在此要求攝影機或麥克風權限）
3. 規則
4. 訓練 runtime
5. 成績結算

`motor/`、`vision/`、`brain/`、`mouth/` 保有各自的 renderer、game loop、
input 與媒體 lifecycle。目錄內少量 `i18n/`、`components/`、`utils/` 檔案是
runtime shell adapter，讓模組使用對應語系、設定與紀錄儲存；它們不是第二份 runtime，
也不得包含遊戲流程或 renderer 狀態。

重型依賴必須留在模組的動態 import 後方。卡片 hover、focus 或 pointer down
只能預載圖片與無副作用的 setup metadata；Pixi、jsPsych、Three、MediaPipe、
TensorFlow 與實際媒體 stream 只能在 rules-visible 之後、由 module-owned
`loadEngine()`/`startRun()` 初始化。返回設定或離開時必須 abort 並釋放整個 run。

新模組的最小目錄契約為：

```text
<domain>/<slug>/
  manifest.ts       # 只含 metadata、capability、PWA 與資產 hash
  config.ts         # defaults + unknown-field stripping + validation
  ConfigPanel.tsx   # 不得 import engine/heavy dependency
  RulesPanel.tsx    # 規則與 preload progress，不建立 renderer/media
  loadEngine.ts     # rules-visible 後才 dynamic import engine
  engine/
    plugin.ts       # module-owned jsPsych plugin/timeline
    renderer.ts     # renderer、input、model、stream 的同局生命週期
    results.ts      # bounded aggregate metrics
```

Manifest 必須能由 `@rehab-trainer/training-contracts` 驗證，並加入 generated
registry；不得在 Hub route、四個 category runtime 或另一模組複製 ID、defaults
或 capability。Hart chart 與駕駛注意力模擬練習是明確 exempt，不可作為新模組範本。

修改本目錄後至少執行：

```sh
pnpm run test:entrypoints
pnpm run test:training-flow
pnpm run build:hub
```
