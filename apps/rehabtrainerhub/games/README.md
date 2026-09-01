# 官方遊戲目錄

每款官方遊戲以 `games/<game-id>/` 為自己的來源根目錄，且必須在根目錄提供
`settings.json`。Hub 只讀取這份宣告，使用共用的 Tailwind CSS／shadcn UI
元件產生設定畫面；玩家送出後，Hub 才建立 `/games/<game-id>/` iframe 並以
`rehab-trainer.game-settings/v1` postMessage 傳入經驗證的設定值。

目前由既有 trainer 程式碼移轉而來的遊戲仍透過四個 build-time adapter 組裝，
但部署輸出、PWA scope、settings 與遊戲網址都已是逐遊戲獨立，且不再發布
`/runtimes/*`。新遊戲不得新增 trainer runtime 或在 Hub 複製設定表單。

新增官方遊戲時：

1. 建立 `games/<game-id>/settings.json`。
2. 將遊戲加入 `training-modules/catalog.ts`。
3. 讓遊戲接收 `rehab-trainer.game-settings/v1`，且只接受 Hub parent／origin。
4. 執行 `npm run test:entrypoints`、`npm run test:pwa` 與 `npm run build:hub`。

第三方開發者的 ZIP 契約與隔離執行規範請見 `docs/developer-game-packages.md`。
