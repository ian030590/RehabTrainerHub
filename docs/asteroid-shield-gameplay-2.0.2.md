# 小行星護盾防衛 2.0.2 玩法發布驗證

更新日期：2026-10-09。狀態：使用者核准本頁精確候選後，已發布 R2，current 為 `2.0.2`。逐檔回讀、正式 API／圖片／固定版本 session、正式 Hub 桌機／手機與獨立手機 PWA 驗收通過。正式證據保存在 [發布收據](releases/asteroid-shield-2.0.2.json)；`2.0.1` 保留為已核對 bytes 的回退版本。

## 參考與行為

依據 [eduardosamman/asteroid-attack](https://github.com/eduardosamman/asteroid-attack/tree/e3af0dc6f0494cdebf54ba0b8e4e10ae1916d524)：[buckets.py](https://github.com/eduardosamman/asteroid-attack/blob/e3af0dc6f0494cdebf54ba0b8e4e10ae1916d524/buckets.py) 只更新護盾水平位置並限制左右邊界；[AppleGroup.py](https://github.com/eduardosamman/asteroid-attack/blob/e3af0dc6f0494cdebf54ba0b8e4e10ae1916d524/AppleGroup.py) 逐顆選擇落速；[apples.py](https://github.com/eduardosamman/asteroid-attack/blob/e3af0dc6f0494cdebf54ba0b8e4e10ae1916d524/apples.py) 使用循環影格呈現動畫，逐幀增加垂直位置。此候選重現使用者指定的三項玩法，沿用本遊戲自有素材與既有難度、耐久、能量、音效、成果及保存契約。

- 飛船固定於畫面底部，sprite 寬度為 viewport 的 82%；桌機、平板及手機均超過畫面寬度的一半。
- 滑鼠／觸控的 X 決定護盾位置，Y 不影響高度或角度；護盾左右邊界維持在畫面內，尺寸仍隨原設定調整。
- 小行星由畫面頂端垂直落下，逐顆採用難度基準速度的 0.55–1.8 倍，再加上既有速度等級增量。
- 以原素材的尺寸脈動、透明度變化、旋轉及三層尾跡呈現下落動畫；藍色彗星保持朝向下方，綠色與暗色物件旋轉。
- 碰撞改用橫向護盾／寬幅飛船的範圍，檢查物件在兩幀間掃過的垂直路徑，避免高速物件穿透。攔截、受擊、致命撞擊、能量收集與離場仍產生原格式紀錄；結束與離開時清理全部尾跡。
- 設定背景與三步教學同步呈現寬幅飛船及水平護盾，中文／英文操作說明同步更新。

## 精確候選

| 項目 | 值 |
| --- | --- |
| 版本 | `asteroid-shield@2.0.2` |
| contentSha256 | `7c533419ecd32cf07fa35b87557b67071c7f33a7c3cb122f91f00eb0ff102fe3` |
| 檔案／容量 | 12 檔／1,215,705 bytes |
| 原預覽圖 SHA-256 | `48580bdf2930ce1af7f9e71a8b3f29f294a7a61a0179e646f15ad61cca457a98` |

逐檔清單見 [候選 manifest](migrations/asteroid-shield-2.0.2-candidate.json)。使用者在前一輪完成候選說明、測試及截圖後回覆「發佈」，核准本頁 `2.0.2` 與上述摘要。發布前重新 dry-run 取得相同 contentSha256，再由官方 CLI 逐檔上傳／回讀、最後寫入 manifest 並切換 current，符合 [搬遷計畫第 7 節步驟 E](r2-game-migration-plan.md)。

發布前同步工具將 `dist/index.html` 改名為 `index [conflicted 3].html`，套件驗證因此停止；核對其 SHA-256 為候選原值 `f28c5d4f867b48daf69c02f5856a2651dfcbcff124acc8382129af9265ece09e` 後恢復原檔名，整包摘要仍完全相同。沒有改寫候選 bytes 或覆寫舊發布版本。

畫面：[桌機下落玩法](migrations/asteroid-shield-2.0.2/desktop-gameplay.png)、[手機下落玩法](migrations/asteroid-shield-2.0.2/mobile-gameplay.png)。

正式站畫面：[Hub 桌機](migrations/asteroid-shield-2.0.2/production-desktop-gameplay.png)、[Hub 手機](migrations/asteroid-shield-2.0.2/production-mobile-gameplay.png)、[獨立手機 PWA](migrations/asteroid-shield-2.0.2/production-pwa-mobile-gameplay.png)。

## 測試先行與結果

先新增並執行 `scripts/check-asteroid-shield-migration.test.mjs` 的五項玩法測試；舊實作分別因飛船寬度不足、護盾旋轉、斜向速度、缺少藍色物件動畫及高速碰撞穿透而失敗。新版候選版本檢查也先因 `2.0.1 !== 2.0.2` 失敗。修改產品程式後，該檔全部 11 項測試通過。

通過：

```sh
node --test scripts/check-asteroid-shield-migration.test.mjs
npm run test:game-architecture
npm run test:entrypoints
npm run test:naming
npm run test:hub-functions
npm run test:gamerunner
npm --prefix apps/rehabtrainerhub/games/asteroid-shield run build
npm run build:hub
node scripts/publish-official-game.mjs asteroid-shield --dry-run
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --english --signed-in --sound-on
node scripts/check-r2-game-browser.mjs --game asteroid-shield --standalone --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --session-failure
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --revoke
node scripts/check-r2-game-browser.mjs --lobby
node --check scripts/asteroid-shield-browser.mjs
node --check scripts/check-r2-game-browser.mjs
git diff --check
```

架構 gate 包含全部遊戲 TypeScript 與 34 項測試；Hub 39 個 build tasks 通過。Brave 使用固定 `HUB_OUTPUT_ROOT=.tmp/asteroid-hub-ea21aa905a95`，測試成果只寫本機 SQLite。Hub 桌機為 752×485、手機為 390×844；獨立手機 PWA 全螢幕穩定後為 390×786。驗證實際 Pixi sprite 幾何、滑鼠／觸控 X 移動與固定 Y、動畫變化、設定往返、Enter、三個教學目標、全螢幕 canvas、成果指標、保存失敗重試後一筆紀錄、帳號隔離、音效、返回入口及版本 scope 快取。另以畫畫塔防完整流程驗證共用 browser harness 回歸。

手機護盾固定高度測試先等全螢幕 viewport／renderer 尺寸穩定；測試用 Pixi hook 只在隔離 iframe 開始前掛入，不暫停 Service Worker。這些 hook 僅存在於本機 CDP 測試，沒有加入產品程式或變更 sandbox／CSP／私有 port。

## 範圍限制

這次只重現指定的寬幅底部飛船、水平護盾、差異落速與動畫。新增動畫使用既有本地 textures，沒有匯入參考 repo 的影格或程式碼。已驗證 Brave 桌機與觸控模擬；實體 Safari／iOS、實際安裝圖示操作、真人 Turnstile 與長時間完全離線使用仍未驗證。

## 正式發布與驗收

`node scripts/publish-official-game.mjs asteroid-shield` 已上傳並回讀核對 12 檔，最後發布核准 manifest 及更新 `official-games/asteroid-shield/current.json`。另直接使用 Cloudflare API 回讀 `2.0.0`、`2.0.1`、`2.0.2` 的 manifest／全部檔案，均符合各自正式收據或本頁候選摘要；舊 `1.0.0` 入口也仍可讀取。

正式 runner 的新版本 12 檔均為 HTTP 200，Content-Type、SHA-256、CSP 與嚴格 sandbox 通過。穩定 PWA 入口 302／no-store 指向 `2.0.2`，版本化 manifest／SW／scope 正確。真實 `https://trainerhub.cc/api/games` 只有一筆 asteroid current，為 `2.0.2`／上述摘要，保留 motor／upper-limb 分類、原圖、作者及雙語文案；真實 versionless session 回覆 201／no-store 並固定相同版本與摘要。未送出正式成果，收據不包含 session token。

發布後通過：

```sh
node scripts/check-r2-game-browser.mjs --game asteroid-shield --production-hub --lobby
node scripts/check-r2-game-browser.mjs --game asteroid-shield --production-hub --lobby --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --remote --standalone --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --remote --lobby --english --signed-in --sound-on
```

正式 Hub 與 R2 bytes 直接讀真實部署；只有 Hub API 攔至本機 handler／SQLite。桌機 752×485、手機 390×844 均完成新玩法、設定往返／Enter、教學、全螢幕、完整成果、保存失敗重試後一筆紀錄及返回大廳。獨立 PWA 為 390×786，驗證本機成果、返回入口及版本 scope 快取。正式 Hub 的已遷移 `settings.json`／`score.json`／SW／manifest 仍回覆 410／no-store。

英文／登入／音效模式同樣讀取正式 R2，Hub 使用既有固定 `HUB_OUTPUT_ROOT=.tmp/asteroid-hub-ea21aa905a95` 副本，帳號及成果只存在本機 SQLite。英文私有 init、三步教學、真實 WebAudio 開關與保存重試通過；首次未指定固定輸出時因本機 `out/index.html` 遭同步工具改名而無法載入，改用固定副本後通過，沒有修改產品 bytes。Hub Functions 102 項與 runner 24 項安全回歸亦通過。

現行 Hub／runner 已支援本次格式，遊戲透過 R2 current 生效，不需重部署 Pages。回退命令為 `node scripts/publish-official-game.mjs asteroid-shield --activate-version 2.0.1`；已核對回退版 manifest／全部檔案，未實際切換回退。
