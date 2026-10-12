# 小行星護盾背景音樂 2.0.6

2026-10-13：將使用者提供的三份桌面 Tonejs/Midi JSON 與訊息中的 bass JSON 加入小行星護盾。主旋律與合聲均使用方波，打擊使用白噪音，bass 使用三角波並提高一個八度。擁有者已核准下方精確版本／摘要，發布 R2 並切換 current 至 2.0.6；12 個公開檔案、正式 API 與三個正式瀏覽器流程均驗證通過，2.0.5 保留為已核對回退版。[正式收據](releases/asteroid-shield-2.0.6.json)與[正式驗證摘要](migrations/asteroid-shield-music-2.0.6/production/summary.json)保留發布證據。

| 使用者提供的來源 | 遊戲自有檔案 | 音符數 | 實際音色 |
| --- | --- | --- | --- |
| 主旋律squarewave.txt | `music/melody.json` | 167 | square |
| 合聲sinewave.txt | `music/harmony.json` | 480 | square（依使用者更新指示） |
| 打擊whitenoise.txt | `music/percussion.json` | 246 | white-noise |
| 訊息中的 bass JSON | `music/bass.json` | 156 | triangle，MIDI +12 |

四份 JSON 保留完整音符、和弦、秒數、長度、力度及原中繼資料。`music.ts` 以四條軌道、共 1,049 個音符接入遊戲自有 soundManager，設定 48 秒完整小節循環，沒有另加循環間隔。bass 原始 JSON 不改寫，只在組成播放譜面時將其 MIDI +12：首音 A2 → A3（220 Hz），末音 C#3 → C#4。音樂僅在 gameplay 播放，沿用既有聲音開關；完成、返回設定、退出、撤回與卸載沿用既有清理。

只修改此遊戲的 MIDI 型別以接受原 JSON 的 instrument number。瀏覽器實際播放發現 timeout 排程延遲時，過期打擊會被 Tone.js 壓到同一起音時間並拋錯；修正為跳過已過期的音符，下一個音符沿原時間軸播放，不改寫譜面、不累積補播。

四軌手機 gameplay 另重現白噪音節拍被重複觸發，兩次起音時間只差浮點尾數（例如 21.842 與 21.842000000000002），觸發 Tone.js 起音檢查。每條白噪音軌道現在略過同一個已播放節拍，使用 Tone.js 的一微秒容差；下一輪循環與其他聲部的同時和弦保留。

## 測試先行

- 曲目測試先因 `backgroundMusic = null` 失敗；版本測試先因舊版 2.0.5 失敗。接入曲目並更新 package／lockfile 至 2.0.6 後通過。
- 延遲排程測試先因過期音符仍會發聲而失敗；修正後通過，Brave 完整曲目播放不再出現 `Start time must be strictly greater than previous start time`。
- 合聲改方波時，先將測試期望改為 square，確認舊 sine 設定失敗，再修改遊戲設定；33 項音訊測試通過。
- bass 測試先因缺少第四條 triangle 音軌而失敗；升八度測試先因首音仍為 MIDI 45 而非 57 失敗。接入後，33 項音訊測試通過，逐項驗證四軌的實際合成頻率、時間、長度與力度，並確認只對 bass 升八度。
- 白噪音重複節拍測試先因同一節拍播放兩次而失敗；修正後，34 項音訊測試通過，包含次輪循環與同時和弦不受影響。
- JSON 回歸雜湊使用解析後的 JSON，避免 Git 的 LF／CRLF checkout 差異；原始 bass 的 156 個音符與全部中繼資料另有固定雜湊驗證。

## 本機驗證

- 七項既有 gate：`test:naming`、`test:pwa`、`test:game-architecture`、`test:hub-functions`、`test:gamerunner`、`test:entrypoints`、`test:cloudflare-deploy`。
- 遊戲 Vite build、`build:hub` 與官方 Publisher dry-run。
- Brave 真實 Tone.js 合成：四軌完整 48 秒、升八度 bass、第二輪循環、靜音、替換、context 清理、opaque sandbox、CSP；無 Worker 或外連。
- Brave 桌機 Hub 登入／開聲音及手機獨立 PWA／開聲音：設定往返、教學、全螢幕、30 秒真實玩法、完整成果與返回；Hub 驗失敗保存／重試／單一 SQLite row。只寫本機 SQLite，不建立正式帳號或訓練紀錄。

同步工具會改名 workspace 的建置輸出。遊戲候選改在專用暫存副本建置；位置記於本機 `.tmp/asteroid-music-snapshot.txt`，瀏覽器使用固定 Hub／runner output。沒有修改平台 Publisher、部署 workflow 或平台 UI。

## 已核准發布版本

- gameId：`asteroid-shield`
- version：`2.0.6`
- contentSha256：`226381bdf6a0537fc7fe7331f29ae6d8cd6291e8c7181215adfdb12580be0902`
- 套件：12 個檔案，發布逐檔回讀後再發布 manifest／切換 current；全部公開 bytes、Content-Type、SHA-256 與核准清單相符。
- 回退：已核准正式版 2.0.5；正式收據見 `releases/asteroid-shield-2.0.5.json`。

擁有者於本對話回答「核准發佈，並將至今的變更commit並push到遠端」，核准前一則訊息連結的精確版本／摘要。發布使用已驗證的固定輸出，不重建或改寫已核准 bytes；發布前核對 2.0.5 的正式 manifest／逐檔 bytes，未執行回退。

正式 `/api/games` 與不指定版本的 session API 分別回覆 200／201，選擇核准 2.0.6 與相同摘要；穩定 PWA 入口 302／no-store，版本化 scope 正確。正式桌機 Hub 視窗、手機 Hub 與手機獨立 PWA 的開聲音／訓練／結果／返回流程通過，Hub 保存失敗與重試只寫本機 SQLite；沒有建立正式帳號或訓練紀錄，也沒有保存 session token／recordId。原始驗證與截圖位於 `docs/migrations/asteroid-shield-music-2.0.6/production/`。

本次 R2 發布沒有手動部署平台；後續 commit／push 由既有 GitHub workflow 按變更範圍執行驗證與 Pages 部署。已安裝的版本化 PWA 仍固定原版本，需從新版入口取得 2.0.6。Safari／iOS、實體音訊輸出與人工聆聽混音尚未驗收。
