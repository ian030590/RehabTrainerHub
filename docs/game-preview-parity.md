# Hub 遊戲預覽實拍與駕駛解析度（2026-10-31）

本機候選已完成，正式站尚未更新。本次沒有發布 R2、切換 current、建立正式紀錄、Git commit／push 或部署平台。

## 核對與修改

正式公開 `/api/games` 回傳 51 款官方遊戲；51 張正式公開預覽圖的 bytes 均與修改前的工作樹原圖一致。問題主要是原圖採用簡化示意或過早的遊玩畫面。

51 款都已經由本機 Hub 搜尋、啟動、設定、教學／校正進入實際遊玩畫面，再由 Brave 擷取 1280×720 PNG，僅等比例縮為 640×360 WebP。沒有另畫遊戲介面。棋盤先實際走幾步；動態刺激在繪製後暫停瀏覽器虛擬時鐘，以免截圖時已變成空白間隔。舌頭遊戲完成原有相機校正後，改送空白相機影像擷取遊戲內容，避免把驗證用的測試肖像發布為預覽。攝影機畫面本來就隨使用者改變。

Hub 的卡片圖片由 `object-fit: cover` 改為 `contain`，完整顯示操作列與邊緣目標。已發布版本仍由 API 指定的版本化 `previewUrl` 提供，沒有改變版本綁定或沙盒。

- [修改前總覽](migrations/game-previews-2026-10-31/before.webp)
- [實際遊玩截圖總覽](migrations/game-previews-2026-10-31/after.webp)
- [逐款截圖證據與圖片摘要](game-preview-captures.json)
- [精確候選套件與逐檔 SHA-256](game-preview-candidates.json)

原始 PNG 保留在本機 `.tmp/game-preview-captures/<gameId>/<phase>.png`，未納入 Git。已逐款驗證 WebP 確實是該 PNG 的等比例轉檔，並核對兩者摘要。CI 檢查 51 款涵蓋率、圖片尺寸與摘要；舊遷移測試的原圖鎖定已改為本次實拍摘要，其他演算法、設定、通訊與安全檢查保留。

## 駕駛畫面

`driving-rehab@2.1.2` 保留既有 2D 像素風格，提高場景與三面後視鏡共用的像素預算。Full HD（1920×1080、DPR 1）實際畫布如下：

| 畫質 | 原畫布 | 新畫布 |
| --- | --- | --- |
| 低 | 320×180 | 480×270 |
| 中 | 384×216 | 640×360 |
| 高 | 480×270 | 960×540 |

高畫質的像素總量為原先四倍。1280×720 可原尺寸繪製；手機與平板保持比例。玩法、路線、車流、計分、十個 summary 欄位與 capabilities 不變。提高解析度增加繪圖量，低／中／高選項與設定保存均保留。

## TDD 與回歸

先失敗再修正的證據：

1. 解析度測試要求 Full HD 低畫質 480×270，舊程式實際為 320×180；修正後三種畫質及不同方向、DPR 的比例檢查通過。
2. 卡片完整圖片測試要求 `contain`，舊 CSS 為 `cover`；修正後通過，並由桌機／手機瀏覽器量測確認。
3. 截圖 helper 起初不存在；加入後驗證設定／教學不得成為預覽、PNG 轉檔與正常截圖流程。短暫刺激測試再先證明缺少時鐘暫停，修正後通過。
4. 51 款截圖證據起初缺少；完成逐款擷取後，涵蓋率與所有圖片摘要通過。
5. 新版本及圖片使舊的版本／原圖期望值失敗，已更新為本次精確候選，保留原有行為檢查。

本機 gate：

| 指令 | 結果 |
| --- | --- |
| `npm run test:naming` | 通過，含命名掃描 |
| `npm run test:pwa` | 通過 |
| `npm run test:game-architecture` | 1217／1217 通過，含全部遊戲 TypeScript |
| `npm run test:hub-functions` | 308／308 通過 |
| `npm run test:gamerunner` | 78／78 通過 |
| `npm run test:entrypoints` | 通過，含導航、設定、訓練流程與 i18n |
| `npm run test:cloudflare-deploy` | 43／43 通過 |
| 51 款遊戲建置 | 全部通過 |
| `npm run build:hub` | 通過，含輸出架構與 SEO 檢查 |
| 官方發布套件建構器 | 51 款全部通過，capabilities 與正式公開目錄一致 |
| `node scripts/publish-official-game.mjs driving-rehab --dry-run` | 八檔／1,299,280 bytes，摘要與下表一致 |

實際點擊驗證：

| 操作 | 已驗證結果 |
| --- | --- |
| 51 款 Hub 搜尋與開始 | 找到指定卡片，載入該候選版本的圖片與私有 session，進入遊戲自有設定／教學及實際遊玩畫面 |
| Hub 圖片 | 桌機與手機 computed style 為 `contain`，圖片完整顯示 |
| 駕駛桌機 Full HD 完整流程 | 鍵盤啟用、設定、三步教學、全螢幕、960×540 畫布、三面後視鏡、加速、完成、成果指標切換、保存失敗重試與返回大廳通過 |
| 駕駛手機 Hub | 390×844 畫布、觸控方向盤／踏板、切換視角、後視鏡避開 HUD、停止及還原大廳捲動通過 |
| 駕駛手機獨立 PWA 低畫質 | 195×422 畫布、觸控、視角切換、停止與全螢幕清理通過 |
| 駕駛設定保存／重新載入 | 保留難度、畫質、操作方式及紅閃設定，重新搜尋並開啟後恢復確認設定 |
| 駕駛成果保存 | 本機 D1 僅保留摘要，逐回合資料以不可變私人 R2 mock CSV 保存並核對回合數及反應時間 |

51 款擷取在目標畫面即停止，不代表這次重跑了全部 51 款的完整成績／保存流程。瀏覽器為 Windows 無視窗 Brave；手機為模擬觸控。相機使用已存在的圖片串流與原模型，未實測真人、實體攝影機、方向盤、Safari／iOS 或長時間離線。

測試過程另修正驗證工具：大廳已分頁，舊流程一直等待不在第一頁的測試卡片；現在等 hydration 完成，透過真正文字輸入搜尋指定遊戲，重新載入後也等新的目錄請求。駕駛的保存 fixture 同步為現行「D1 摘要＋私人 R2 逐回合 CSV」契約，沒有放寬產品端檢查。

## 精確候選清單

共 51 款、274 檔、41,848,226 bytes。除駕駛解析度外，其餘遊戲套件只更新版本與預覽圖。所有版本尚未發布。

| 遊戲 | 正式版本 → 候選版本 | contentSha256 | 實拍圖 |
| --- | --- | --- | --- |
| 反向眼跳抑制（Antisaccade） (antisaccade) | 2.0.0 → 2.0.1 | `872f205d5d245a7e1ca266ddeb8140100454d24b9d7585cdfdb72520bfa0c73a` | [預覽](../apps/rehabtrainerhub/games/antisaccade/public/preview.webp) |
| 小行星護盾防衛 (asteroid-shield) | 2.0.11 → 2.0.12 | `5f9a2ef41a12e3c4f00f3ede21343d9c120e5782ccb27a32dc846114e8574ca6` | [預覽](../apps/rehabtrainerhub/games/asteroid-shield/public/preview.webp) |
| 注意力網絡練習（ANT） (attention-network-task) | 2.0.1 → 2.0.2 | `7215baad4bb7dfa474bbed22fb1ebd889f7fc8afca34940f2853dc9b31df5960` | [預覽](../apps/rehabtrainerhub/games/attention-network-task/public/preview.webp) |
| 注意力眨眼 (attentional-blink) | 1.0.1 → 1.0.2 | `c8c5245c74474b41af89e12b24d5a29c81f9e25c4da8b4d0953e401191bcf29b` | [預覽](../apps/rehabtrainerhub/games/attentional-blink/public/preview.webp) |
| 卡片規則分類 (card-sorting) | 1.0.1 → 1.0.2 | `9c64660b271a73a1e15db4ba97caffc18589bf500a75ee340e4d18e2cb9c1d58` | [預覽](../apps/rehabtrainerhub/games/card-sorting/public/preview.webp) |
| 四子棋 (connect4) | 2.0.0 → 2.0.1 | `98c7ed0b5683ba59bcf117c22526a61f5b53beabbb00fd1c18ec3b814b9a2108` | [預覽](../apps/rehabtrainerhub/games/connect4/public/preview.webp) |
| 連續表現作業（CPT） (continuous-performance) | 1.0.1 → 1.0.2 | `ab2479e8cd105dd052212ba6587120c42afac10b5df5844f5c2bc080c707fd93` | [預覽](../apps/rehabtrainerhub/games/continuous-performance/public/preview.webp) |
| 數字廣度記憶（Digit Span） (digit-span) | 2.0.1 → 2.0.2 | `150ecb6539e4cd0ce0061296eba19efe11430f4765c7ad70c99b966f8d0fdf58` | [預覽](../apps/rehabtrainerhub/games/digit-span/public/preview.webp) |
| 分配注意力 (divided-attention) | 1.0.1 → 1.0.2 | `5daa444f9f2923657f987c40b8d70bcc6d33598a5133b25687ed4859af7a358c` | [預覽](../apps/rehabtrainerhub/games/divided-attention/public/preview.webp) |
| 點格成盒 (dots-and-boxes) | 2.0.0 → 2.0.1 | `2382a729dcbb6ec302c8826116f64dd35c4873f5e694fa2e217d632ce98dc63f` | [預覽](../apps/rehabtrainerhub/games/dots-and-boxes/public/preview.webp) |
| 畫畫塔防 (drawing-defense) | 2.0.8 → 2.0.9 | `b5f5b09055014462bfe288e3df2f6c81e12d79c70618e38e6a253568921ed3ef` | [預覽](../apps/rehabtrainerhub/games/drawing-defense/public/preview.webp) |
| 駕駛注意力模擬練習 (driving-rehab) | 2.1.1 → 2.1.2 | `b7ea1e97dc76174c993e8b3a22d4bd4cda7df7409616e7ddea73707906b881e8` | [預覽](../apps/rehabtrainerhub/games/driving-rehab/public/preview.webp) |
| 有球必應 (every-ball-response) | 2.0.0 → 2.0.1 | `235d76152812b09617763819f32d0696bfb1325e1f9d80658cfa234d59cd6b3e` | [預覽](../apps/rehabtrainerhub/games/every-ball-response/public/preview.webp) |
| 側翼干擾選擇（Flanker） (flanker) | 2.0.1 → 2.0.2 | `ac6e39bd0772796b7f108271f6d9d3c278a39396ced498eefd2ea9d3487a54d7` | [預覽](../apps/rehabtrainerhub/games/flanker/public/preview.webp) |
| 蓋伯斑塊練習 (gabor-patching) | 2.0.3 → 2.0.4 | `bdaf7851c7bcee033027b3a6a042510a2b83091a8cb74344de4414e2a1ea5f4d` | [預覽](../apps/rehabtrainerhub/games/gabor-patching/public/preview.webp) |
| 手勢指令對戰 (gesture-battler) | 2.0.6 → 2.0.7 | `3fc39c45214f3b5f0d188476139905a18b2b95c6f922d97698a31b144bf6105f` | [預覽](../apps/rehabtrainerhub/games/gesture-battler/public/preview.webp) |
| 通行與抑制反應（Go/No-go） (go-nogo) | 2.0.1 → 2.0.2 | `04c9312cf439df9cdf2f931f692ce738fd02eb37ea4a7cb80fd61e4950b7f170` | [預覽](../apps/rehabtrainerhub/games/go-nogo/public/preview.webp) |
| 哈特圖訓練 (hart-chart) | 2.0.4 → 2.0.5 | `e8ed81d90b4898499bd7a46b41bf11a76f4468419b6767f3837ada880f835688` | [預覽](../apps/rehabtrainerhub/games/hart-chart/public/preview.webp) |
| Hex 連線棋 (hex) | 2.0.0 → 2.0.1 | `2d96810cad5289ca48fb3b401f63237fd228fd8e940b0484c9fe33da54b26390` | [預覽](../apps/rehabtrainerhub/games/hex/public/preview.webp) |
| 六角舒爾特方格 (hex-schulte) | 1.0.1 → 1.0.2 | `a5c60d1ab3f6df10877de8d3a761a42c24dc4a1a878828e88e00c2bb38b9a813` | [預覽](../apps/rehabtrainerhub/games/hex-schulte/public/preview.webp) |
| 類別記憶追蹤（Keep Track） (keep-track) | 2.0.0 → 2.0.1 | `2243052ea3cb893094e2185ac6ef8bae21894bb9d5365a99ba9608aa094dd3be` | [預覽](../apps/rehabtrainerhub/games/keep-track/public/preview.webp) |
| 字母記憶更新（Letter Memory） (letter-memory) | 2.0.0 → 2.0.1 | `f2767d2f3234830d9e013adaa14a6215b0e7db0aa7afb8f78b5ecd629efafdd0` | [預覽](../apps/rehabtrainerhub/games/letter-memory/public/preview.webp) |
| 熄燈解題 (lights-out) | 2.0.0 → 2.0.1 | `f75eaadce9efd7c17a0e773fa122cf9a03fb52c8850229f9859c2a0748547d51` | [預覽](../apps/rehabtrainerhub/games/lights-out/public/preview.webp) |
| 迷宮 (maze) | 2.0.0 → 2.0.1 | `d4c194037eb56af6109d5c45b12b43fe1730ea1f4c3b112e0fbfdafad74f72ca` | [預覽](../apps/rehabtrainerhub/games/maze/public/preview.webp) |
| 記憶配對 (memory-match) | 2.0.0 → 2.0.1 | `3ce521f693cea64b5e76cd811c231782f0be3792ba3e97ad6a596776729ace03` | [預覽](../apps/rehabtrainerhub/games/memory-match/public/preview.webp) |
| 踩地雷 (minesweeper) | 2.0.0 → 2.0.1 | `b930f20d9edb39f11c787fd0492aa0df9f7d8f1cfeafd9fe52d2c34224f5edb9` | [預覽](../apps/rehabtrainerhub/games/minesweeper/public/preview.webp) |
| 手部目標追蹤練習 (motor-cortex-rehab) | 2.0.4 → 2.0.5 | `f1bda3ca4077aae9861b4bfcd0d640829c1553a4533a88240f2d7b2ec5ce6439` | [預覽](../apps/rehabtrainerhub/games/motor-cortex-rehab/public/preview.webp) |
| 移動卡片訓練 (moving-card) | 2.0.4 → 2.0.5 | `6815422821c154c665c4a3d49758a005504f63f31eb029ba37c00adc34517a87` | [預覽](../apps/rehabtrainerhub/games/moving-card/public/preview.webp) |
| 工作記憶更新（N-back） (n-back) | 2.0.1 → 2.0.2 | `4d4c4e2021aa6038091a83de76137e2c8cef302ebe75bf674a4eb6a7c0567bf6` | [預覽](../apps/rehabtrainerhub/games/n-back/public/preview.webp) |
| 數字字母切換（Number-Letter） (number-letter) | 2.0.1 → 2.0.2 | `515904d440646e757e8935235214064881d5bd5bf07ee14d1fead439f6ec29ff` | [預覽](../apps/rehabtrainerhub/games/number-letter/public/preview.webp) |
| 眼動練習 (oculomotor-training) | 2.1.3 → 2.1.4 | `b2314202c9d7aa1bf48e658b4fc77dafe223e8e6e57e543d363de07b5445e64c` | [預覽](../apps/rehabtrainerhub/games/oculomotor-training/public/preview.webp) |
| 圖形記憶 (pattern-memory) | 1.0.1 → 1.0.2 | `b9a9377416aeceaa7e83e659093623f6564f3edf94de29e18fa0d39bd2235e24` | [預覽](../apps/rehabtrainerhub/games/pattern-memory/public/preview.webp) |
| 心算加減切換（Plus-Minus） (plus-minus) | 2.0.0 → 2.0.1 | `2ee4627176ffd0efa9c7340b1d1dba236871510cefa325a54fe72bde20b52fea` | [預覽](../apps/rehabtrainerhub/games/plus-minus/public/preview.webp) |
| 反應時間 (reaction-time) | 2.0.1 → 2.0.2 | `02d1c37da66d634f898494b4e6623d61e5bdf42da21c86126a96695b8486aa75` | [預覽](../apps/rehabtrainerhub/games/reaction-time/public/preview.webp) |
| 閱讀訓練（RSVP） (reading-training) | 2.0.2 → 2.0.3 | `57a43b226ee7cf8d90b850200b294d3a8cccb3f023041f7169dd1920acfdf4d5` | [預覽](../apps/rehabtrainerhub/games/reading-training/public/preview.webp) |
| 持續注意反應（SART） (sart) | 1.0.1 → 1.0.2 | `3a450bb427daa5f94ce35a7091d20f016a0dd71ca8e3aa69e59c6cb7cbd8bda9` | [預覽](../apps/rehabtrainerhub/games/sart/public/preview.webp) |
| 舒爾特方格 (schulte-grid) | 1.0.1 → 1.0.2 | `0d457b5c18a5a297be7cfc4101bc208bb3d46a77fc5a8b1908c9f4a2053df3ed` | [預覽](../apps/rehabtrainerhub/games/schulte-grid/public/preview.webp) |
| 海鷗飛行 (seagull-flight) | 1.0.0 → 1.0.1 | `5bb97277503f9126cbd070c78853c4b14afe37c18c9366395d8a9c08d5550b56` | [預覽](../apps/rehabtrainerhub/games/seagull-flight/public/preview.webp) |
| 順序記憶 (simon-says) | 2.0.0 → 2.0.1 | `3977f6728de1844d6c1fb5488de12d33e5489e56804b0a3d923bd92a02aba963` | [預覽](../apps/rehabtrainerhub/games/simon-says/public/preview.webp) |
| Simon 作業 (simon-task) | 1.0.1 → 1.0.2 | `80312ee74ff356a2030329dccf4b7a7bbf2ba39faec077b6f249d2d27ea7c79a` | [預覽](../apps/rehabtrainerhub/games/simon-task/public/preview.webp) |
| 滑塊拼圖 (sliding-puzzle) | 2.0.0 → 2.0.1 | `ecfc2814403642050c17d4309376e94089619804905e75aef73619f6e7e0408a` | [預覽](../apps/rehabtrainerhub/games/sliding-puzzle/public/preview.webp) |
| 空間廣度記憶（Spatial Span） (spatial-span) | 2.0.1 → 2.0.2 | `977f2d08b65ce6ea546e869c3da742104d27b352ae60dd0c6f602f96a8c9a9b0` | [預覽](../apps/rehabtrainerhub/games/spatial-span/public/preview.webp) |
| 煞車抑制反應（Stop-Signal） (stop-signal) | 2.0.1 → 2.0.2 | `dfd5eadc5f6f7f0fde451eb18d19bfa1090f364ff73556a9ec092b3fc6d749fe` | [預覽](../apps/rehabtrainerhub/games/stop-signal/public/preview.webp) |
| 色彩干擾抑制（Stroop） (stroop) | 2.0.1 → 2.0.2 | `34dfcc62e652daeb8e5a8e6ccb33070439e1067e9d06bad0e0c84fc50b9b130a` | [預覽](../apps/rehabtrainerhub/games/stroop/public/preview.webp) |
| 數獨 (sudoku) | 2.0.0 → 2.0.1 | `2b52175e87d98c6394b70a599cc4a3920a42289f5502c3b02c5bd4c1808685d7` | [預覽](../apps/rehabtrainerhub/games/sudoku/public/preview.webp) |
| 圈圈叉叉 (tic-tac-toe) | 2.0.0 → 2.0.1 | `5b375264537a4b6a733014e51e356953f7c041d2f9b69e4a2738727b7f7b6b17` | [預覽](../apps/rehabtrainerhub/games/tic-tac-toe/public/preview.webp) |
| 時間感知 (time-perception) | 1.0.1 → 1.0.2 | `94052ec65a3bc05454427826e7269ce63cc26f74067a04700a666b5386c6fa4d` | [預覽](../apps/rehabtrainerhub/games/time-perception/public/preview.webp) |
| 舌頭動作訓練 (tongue-catch) | 2.0.0 → 2.0.1 | `9a502560949a407c6fc432138c5ba82e66d2a7871ad7c8f6542d15a970765a59` | [預覽](../apps/rehabtrainerhub/games/tongue-catch/public/preview.webp) |
| 倫敦塔規劃（Tower of London） (tower-of-london) | 2.0.1 → 2.0.2 | `6c0a4af8eb746a73c7dba1e4615e4dc97d0ac046862a5f387b8dac0bc38f9e1d` | [預覽](../apps/rehabtrainerhub/games/tower-of-london/public/preview.webp) |
| 周邊視野訓練 (ufov) | 2.0.0 → 2.0.1 | `3eb4b584bdd752f8ea5e4f6001b0b1f4bf992d680ae98ade5142c2dbc2ce86b0` | [預覽](../apps/rehabtrainerhub/games/ufov/public/preview.webp) |
| 目標點擊 (whack-a-mole) | 2.0.0 → 2.0.1 | `2675e67edbec052982d093355249955487931f00cb96af79112fd782a4dd0a29` | [預覽](../apps/rehabtrainerhub/games/whack-a-mole/public/preview.webp) |

## 發布邊界與擁有者命令

依 [AGENTS.md](../AGENTS.md)，R2 發布須核准精確 version／contentSha256，且「自動模式不讓代理發布，由擁有者親自執行發布指令」。本次只準備候選；`packages/ui/src/officialGameReleases.json` 與正式 current 未修改。

擁有者核准上表全部精確組合後，才在倉庫根目錄親自執行下列 PowerShell 命令。它先重新核對全部 51 款內容，再逐款呼叫既有官方 publisher；任一不符或失敗即停止。執行期間不要改動或重建 `dist/`。

```powershell
@'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { BuildOfficialGameRelease } from './scripts/publish-official-game.mjs';

const { games } = JSON.parse(await readFile('docs/game-preview-candidates.json', 'utf8'));
for (const expected of games) {
  const { manifest } = await BuildOfficialGameRelease(expected.gameId);
  assert.equal(manifest.version, expected.version, expected.gameId);
  assert.equal(manifest.contentSha256, expected.contentSha256, expected.gameId);
}
for (const game of games) {
  const result = spawnSync(process.execPath, ['scripts/publish-official-game.mjs', game.gameId],
    { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(game.gameId + ': publication stopped');
}
'@ | node --input-type=module
```

發布後須逐款驗證正式 current、session 與公開 bytes，再更新正式收據。Hub 的完整顯圖樣式另須推送 `main` 並部署後才生效；不需要新 runner 或 registry 變更。這些正式發布、驗收、推送與部署尚未執行。候選 JSON 的 `previous` 保留本次正式目錄的版本／摘要供回退核對，沒有實際回退。

