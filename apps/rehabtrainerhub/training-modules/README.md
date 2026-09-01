# Hub 訓練模組

此目錄保留既有 Motor、Vision、Brain、Mouth 遊戲實作，作為移轉期間的程式碼來源。
對外部署單位已改為 `games/<game-id>/`：每款遊戲都有自己的根目錄、
`settings.json`、PWA scope 與 `/games/<game-id>/` 網址。
Hub 大廳透過 `catalog.ts` 裝載遊戲資料與對應設定檔。

官方遊戲統一遵循單向組合：

`Hub catalog -> games/<game-id>/settings.json -> Hub config overlay -> /games/<game-id>/ iframe`

`training-runtimes/*` 僅是尚未拆除的建置相容 adapter；建置後不會發布
`/runtimes/*`，而是輸出 26 個獨立遊戲目錄。新遊戲不得加入 trainer runtime；
應直接建立 `games/<game-id>/` 並提供根目錄 `settings.json`。

所有可玩的 catalog 模組必須依序提供：

1. 訓練卡片
2. Hub 依 `settings.json` 產生的統一 Training config
3. 規則
4. 遊戲 iframe
5. 成績結算

`motor/`、`vision/`、`brain/`、`mouth/` 保有各自的 renderer、game loop、
input 與媒體 lifecycle。目錄內少量 `i18n/`、`components/`、`utils/` 檔案是
建置相容 adapter，讓模組使用對應語系、設定與紀錄儲存；它們不是公開 runtime，
也不得包含遊戲流程或 renderer 狀態。

重型依賴必須留在模組的動態 import 後方。卡片 hover、focus 或 pointer down
可以預載程式碼，但 Pixi、jsPsych、Three、MediaPipe、TensorFlow 與實際媒體
stream 只能在對應流程階段初始化。

修改本目錄後至少執行：

```sh
npm run test:entrypoints
npm run test:training-flow
npm run build:hub
```
