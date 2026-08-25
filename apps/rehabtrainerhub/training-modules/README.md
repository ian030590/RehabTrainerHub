# Hub 訓練模組

此目錄是 Motor、Vision、Brain、Mouth 實際訓練 runtime 的唯一來源。
`training-runtimes/*` 透過 `@rehab-trainer/hub-modules/*` 編譯這些程式碼；
Hub 大廳透過 `catalog.ts` 與 `moduleFlowManifest.ts` 裝載相同模組資料。

所有可玩的 catalog 模組必須依序提供：

1. 訓練卡片
2. Trainer config（需要媒體輸入時在此要求攝影機或麥克風權限）
3. 規則
4. 訓練 runtime
5. 成績結算

`motor/`、`vision/`、`brain/`、`mouth/` 保有各自的 renderer、game loop、
input 與媒體 lifecycle。目錄內少量 `i18n/`、`components/`、`utils/` 檔案是
Hub runtime adapter，讓模組使用對應語系、設定與紀錄儲存；它們不是第二份 runtime。

重型依賴必須留在模組的動態 import 後方。卡片 hover、focus 或 pointer down
可以預載程式碼，但 Pixi、jsPsych、Three、MediaPipe、TensorFlow 與實際媒體
stream 只能在對應流程階段初始化。

修改本目錄後至少執行：

```sh
npm run test:entrypoints
npm run test:training-flow
npm run build:hub
```
