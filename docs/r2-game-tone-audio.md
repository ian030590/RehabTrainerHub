# R2 遊戲 Tone.js 音訊

2026-10-12：六款已遷移遊戲使用各自擁有的 `tone@15.1.22`、音訊程式、譜面與設定。擁有者核准六組精確 version／contentSha256 後，已發布 R2 並切換 current，完成正式 API、全部 43 檔公開 bytes、安全標頭與 18 個正式 Hub／獨立 PWA 完整流程。驗收與回退見 [正式驗證摘要](migrations/r2-game-tone-audio/production/summary.json)及下方各正式收據。

| 遊戲 | 已驗證回退版本 | 2026-10-12 發布版本 |
| --- | --- | --- |
| 畫畫塔防 `drawing-defense` | 2.0.5 | 2.0.6 |
| 小行星護盾 `asteroid-shield` | 2.0.4 | 2.0.5 |
| 手勢對戰 `gesture-battler` | 2.0.3 | 2.0.4 |
| 手部目標追蹤 `motor-cortex-rehab` | 2.0.1 | 2.0.2 |
| 移動卡片 `moving-card` | 2.0.1 | 2.0.2 |
| 眼動練習 `oculomotor-training` | 2.0.0 | 2.0.1 |

## 加入自己作的曲子

1. 從作曲軟體匯出 `.mid`，或使用 [Tonejs/Midi](https://github.com/Tonejs/Midi) 匯出 `Midi.toJSON()`。倉庫提供同一套轉檔器，例如：

   ```powershell
   node scripts/convert-game-midi.mjs path/to/theme.mid apps/rehabtrainerhub/games/asteroid-shield/music/theme.json
   ```

2. 修改該遊戲自己的 `music.ts`，匯入曲子與各軌音色：

   ```ts
   import theme from './music/theme.json';
   import type { MidiMusicOptions, MidiScore } from './runtime/soundManager';

   export const backgroundMusic: MidiScore | null = theme;
   export const backgroundMusicOptions: MidiMusicOptions = {
     loop: true,
     waveforms: ['square', 'triangle', 'sawtooth', 'white-noise'],
     // 可選：以秒指定完整小節長度，必須包含所有音符。
     loopEnd: 16,
   };
   ```

   `waveforms` 依 JSON 的 tracks 順序指定；未指定的旋律軌使用 square、percussion 軌使用 white-noise。也可使用 sine。沒有曲子時保留 `backgroundMusic = null`。若曲長超過 16 秒，範例中的 `loopEnd` 應修改或省略。

3. 建置該遊戲。譜面會編入本地 bundle，遊戲在 gameplay 開始後自動播放，完成／返回設定時停止。原有音效開關同時控制歌曲與提示音。手勢及手部練習沒有新增表單參數；眼動原 25 項設定與無提示音行為保留。

   ```powershell
   npm --prefix apps/rehabtrainerhub/games/asteroid-shield run build
   node scripts/publish-official-game.mjs asteroid-shield --dry-run
   ```

   新曲子同樣屬不可變發布 bytes，需新的 package version 與精確摘要核准後才能公開。

## 播放介面與限制

每款 `runtime/soundManager.ts` 提供 `PrepareAudioFeedback`、`SetSoundEnabled`、原提示音函式，以及 `PlayMidiMusic(score, options)`、`StopMidiMusic()`、`DisposeAudioFeedback()`。`PlayMidiMusic` 回傳 Promise<boolean>，聲音關閉、空譜或音訊不可用時回傳 false；非法譜面拒絕 Promise。設定音樂的流程已接入各款 gameplay，不需要修改引擎。

音符的 `midi` 為 0–127 整數；`time`、`duration` 為秒，`velocity` 為 0–1。Tonejs/Midi 已處理 MIDI tempo map，所以變速曲不需要另一個 BPM 轉換。支援和弦及多軌，最多 16 軌／20,000 音符／一小時，每個旋律軌最多 16 個同時發聲，超過此同時發聲配額的音符由 Tone 略過。NoiseSynth 為單音打擊軌；不同鼓音可拆成不同軌。此介面播放音符，暫不解讀 CC、延音踏板、pitch bend 或 GM 樂器音色。

所有聲音即時合成。Tone.js class entry 與 `setContext` 避免預設 import 建立額外 context；context 使用 timeout 時鐘，無 Worker、CDN、runtime fetch、WAV／MP3 或錄音取樣。每款遊戲自己打包 Tone.js，不建立平台共用音訊套件；jsPsych context 保留自己的生命週期。

## TDD 紀錄

- 第一次執行 `node --test scripts/check-r2-game-audio.test.mjs`：原五款缺少 `PlayMidiMusic`／Tone 相容入口，眼動沒有 soundManager，全部失敗。
- 加入 gameplay 設定入口測試後：因原元件沒有歌曲啟動／停止生命週期而失敗。
- 加入 Tone class entry 測試後：普通 `tone` import 會提前建立預設 context 的問題被測試攔下；改用 class entry、遊戲自有 context 與 `setContext`。
- 加入 MIDI 轉檔與退出測試後：缺少轉檔腳本及退出等待全螢幕前的音訊清理而失敗；實作後音訊與全螢幕的 43 項測試通過。

## 本機驗證結果

- `npm run test:game-architecture`：全部遊戲 TypeScript 與 139 項測試通過；新音訊測試由 self-contained 引入，CI 仍維持既有七項 matrix／命令。
- `npm run test:entrypoints`、`npm run test:naming` 與 `git diff --check` 通過。
- 六款單獨 Vite build 與 `publish-official-game.mjs <gameId> --dry-run` 均通過；此 dry-run 不連線 R2，沒有公開或切換 current。
- `npm run build:hub` 在固定 source 副本通過 35 個工作，含 output 隔離與 SEO 輸出 gate；六款仍排除於 Hub 的 bundle／JSON 產物。
- `node scripts/check-r2-game-audio-browser.mjs`：六款自己的 soundManager 均在真實 runner `HandleRequest` 提供的 CSP、opaque `sandbox="allow-scripts"` 中，以真正 Tone.js 播放 MIDI JSON 和弦／白噪音，Analyser 確認非零音訊；循環、靜音／禁止後續音符、再次播放與 context 清理通過。設定階段不建立 AudioContext，Worker 嘗試為 0、CSP 違規為 0。
- 固定副本的 `check-r2-game-browser.mjs --game asteroid-shield --lobby --sound-on` 通過：設定／參數邊界／Enter、三目標教學、原生全螢幕、真實 30 秒 gameplay、數值結果、保存失敗重試、單一本機 SQL row、返回大廳與捲動還原。
- 固定副本的 `check-r2-game-browser.mjs --game moving-card --standalone --sound-on` 通過：原設定／校正、三目標教學、真實 pointer trials、實際 Tone 音效、結果及獨立 PWA 保存生命週期。

工作區的同步程序把 `OculomotorTrainingGame.tsx` 與多個 build 產物改名成 `[conflicted ...]`，導致初次 TypeScript／Hub build／dry-run 找不到原檔。元件先核對衝突副本 bytes，再恢復原名；相同副本移除。後續建置與完整流程在系統暫存的固定 source／依賴副本執行，不把同步造成的產物缺失當成產品失敗。該副本位置記於本機 `.tmp/r2-audio-hub-snapshot.txt`；本機驗證輸出為 `.tmp/r2-audio-*.txt`。

上述是初次本機修改的驗證範圍；當時尚未公開 R2，完整訓練回歸先跑小行星與移動卡片。後續發布準備已補齊另外四款；正式站驗收見下節。所有訓練資料仍只寫本機，Safari／iOS 與實體相機／音訊輸出尚待驗收。

## 六款發布準備（2026-10-12）

擁有者於本對話要求「發佈新版」。七項本機 gate 已全部通過；補跑畫畫塔防大廳、手機手勢完整校正／對戰、手部 45 秒追蹤，以及眼動原模型／圖片串流、校正、pursuit 與私人 CSV／摘要保存重試，均通過。加上先前小行星／移動卡片流程，六款均有當版完整訓練回歸。原工作區 runner 的 `eyeTrackingEntry.js` 被同步程序改名，曾造成 FaceMesh 等待失敗；固定 runner build 後重驗通過。相機仍為已核對圖片串流，沒有真人／實體相機驗收。

Wrangler 已刷新既有 OAuth；正式 `/api/games` 六款均僅一筆 current，正式 R2 current／approved manifest 與正式收據相符。六個回退版本的所有公開 package files 都已重新核對 HTTP 200、bytes 與 SHA-256；候選原始碼與固定 build 副本一致，逐檔清單與 contentSha256 未改變。

精確候選／檔案清單／容量／回退資訊見 [發布審核資料](r2-game-tone-audio-release-review.json)。準備完成後先呈現六組完整 version／contentSha256；擁有者在本對話回覆「核准六款」，才執行下述正式發布。

## 正式發布與驗收（2026-10-12）

既有 Publisher 的 `PublishRelease` 依序發布六款，逐檔上傳與回讀 SHA-256，最後才發布 approved manifest 並切換／回讀 current／歷史。發布資料來自已核對原始碼的固定 build 副本；不重建或修改核准 bytes。全部舊版保留，六個回退版本發布前已驗證；本次未執行正式回退。

- 直接讀正式 `/api/games`：每個 slug 僅一筆新 current，精確版本／摘要、自有分類／雙語文案／預覽圖與 `presentation: game` 均符合，沒有通用 settingsUrl。
- 直接下載全部 43 檔：HTTP 200、Content-Type、bytes、SHA-256 均相符；package HTML 的嚴格 CSP、`worker-src 'none'`、`connect-src 'none'`、相機禁止與 opaque sandbox 保留。
- 穩定 PWA 入口均為 302／no-store，導向新 current；版本化入口與 manifest scope 正確。正式不指定版本的 session API 均回覆 201／核准新版摘要；只驗證 stateless token 簽署，不將 token、recordId 或測試 Subject ID 保存到收據，不建立正式訓練紀錄／帳號。
- 六款各跑桌機 1320×713 視窗、手機 390×844 的正式 Hub 大廳，以及手機正式獨立 PWA，共 18 個流程。真實引擎、參數、教學、全螢幕、結果、保存失敗／重試、退出清理與返回均通過；Hub 返回時大廳捲動恢復。小行星與移動卡片另檢查實際 Tone 音效開關；相機使用原固定模型與已核對圖片串流。
- 本次是既有格式／能力的 R2 遊戲內容更新，不需部署 Hub／runner。正式 Hub 與 runner 直接讀取新 current；已安裝的版本化 PWA 仍固定原版本，需要從新版入口安裝才取得新版本。

| 遊戲 | 正式 current | 回退版本 | 正式收據 |
| --- | --- | --- | --- |
| 畫畫塔防 | 2.0.6 | 2.0.5 | [收據](releases/drawing-defense-2.0.6.json) |
| 小行星護盾 | 2.0.5 | 2.0.4 | [收據](releases/asteroid-shield-2.0.5.json) |
| 手勢對戰 | 2.0.4 | 2.0.3 | [收據](releases/gesture-battler-2.0.4.json) |
| 手部目標追蹤 | 2.0.2 | 2.0.1 | [收據](releases/motor-cortex-rehab-2.0.2.json) |
| 移動卡片 | 2.0.2 | 2.0.1 | [收據](releases/moving-card-2.0.2.json) |
| 眼動練習 | 2.0.1 | 2.0.0 | [收據](releases/oculomotor-training-2.0.1.json) |

原始發布／驗收紀錄、公開驗證及主要截圖保留於 `docs/migrations/r2-game-tone-audio/production/`。該批六款 `backgroundMusic` 為 null，先發布 Tone.js／MIDI 譜面介面與既有提示音；當時未加入新的作曲。MIDI CC、延音踏板、pitch bend、GM 樂器音色、Safari／iOS、實體相機／音訊輸出與長時間離線尚未驗收。

## 小行星四軌音樂（2026-10-13）

小行星護盾 current 已切換至精確核准的 `2.0.6`：主旋律／合聲使用 square，打擊 white-noise，bass triangle 並提高一個八度；四軌 1,049 個音符同步循環 48 秒。34 項音訊測試、142 項架構測試、七項本機 gate、正式 API／session／12 檔公開 bytes 與桌機 Hub／手機 Hub／手機獨立 PWA 三流程均通過，原 2.0.5 保留為已核對回退版。其餘五款歌曲仍為空，沒有建立正式訓練紀錄。

精確摘要、TDD 與正式驗收見[發布紀錄](asteroid-shield-music-2.0.6.md)及[正式收據](releases/asteroid-shield-2.0.6.json)。本次 R2 發布沒有手動部署平台；commit／push 後由既有 workflow 執行驗證及依範圍部署。已安裝的版本化 PWA 保留原版，需從新版入口取得 2.0.6。
