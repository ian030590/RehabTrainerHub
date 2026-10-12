# 小行星護盾隕石與警示音效 2.0.8

2026-10-13：依使用者「完成後核准直接發佈並commit與push到遠端」的預先授權，已完成聲波與遊戲驗證、發布 R2 並切換 current 至 `asteroid-shield@2.0.8`。正式 API／固定版本 session／12 個公開檔案、桌機 Hub／手機 Hub／手機 PWA 三個流程均通過；見[正式收據](releases/asteroid-shield-2.0.8.json)及[摘要](migrations/asteroid-shield-effects-2.0.8/production/summary.json)。

## 音效與預聽

| 音效 | 合成方式 | 音量設定 | 預聽 |
| --- | --- | --- | --- |
| 隕石墜落 | 白噪音經 bandpass，1800 → 650 Hz 下降呼嘯；0.32 秒加 0.1 秒釋放 | -12 dB | [隕石](migrations/asteroid-shield-effects-2.0.8/audio/fall.wav) |
| 受擊／扣分警示 | 方波，987.77 → 739.99 → 554.37 Hz，短促下降三音 | -9 dB | [受擊](migrations/asteroid-shield-effects-2.0.8/audio/damage.wav) |
| 失敗結束 | 方波，880 → 659.25 → 440 Hz，較長下降三音 | -9 dB | [失敗](migrations/asteroid-shield-effects-2.0.8/audio/defeat.wav) |

原警示為 -21 dB 的低頻正弦波；新版提高音量設定 12 dB，並增加中頻與諧波，讓較小喇叭容易辨識。新隕石生成時播放一次，藍／綠／暗色都有呼嘯，能量石沿用原玩法。同畫面短時間多次受擊合併一次警示，失敗結束會取代尚未結束的受擊音。

完整音樂／提示／警示／呼嘯混音通過遊戲自有 -3 dB Limiter。四軌音樂、成功／勝利提示及既有 HUD／教學沿用。音效直接以遊戲自己的 Tone.js 合成，發布套件沒有 WAV、取樣、外連或 Worker；上述 WAV 是本機真實瀏覽器輸出的預聽證據。

完成會停止呼嘯及音樂，再播放結束音；結果畫面讓結束音播放完畢，返回設定、靜音、退出／卸載及 pagehide 清理全部音源與 Context。

## 測試先行與量測

先執行失敗測試：缺少呼嘯 API、game loop 沒有新隕石音效事件、舊正弦警示未符合亮度／音量要求，以及返回設定未清理警示。修正後 37 項音訊、13 項小行星、147 項架構測試通過。[失敗與通過紀錄](migrations/asteroid-shield-effects-2.0.8/tests/)包含 TDD、建置與音訊測試。

Brave 在正式的 opaque sandbox／CSP 下擷取實際 Tone 原生出口 PCM，並以 500 Hz highpass＋3000 Hz lowpass 近似小喇叭頻段。舊版正弦警示以相同 Tone 音量／頻率／包絡重現。首次擷取器接到靜音節點，已修正為真正的 Destination 出口；修正擷取後，初版呼嘯的頻段 RMS 為 0.00269，低於 0.003 驗收門檻，才調整呼嘯音量與包絡。

最終[量測紀錄](migrations/asteroid-shield-effects-2.0.8/audio/measurements.json)：

| 輸出 | 500–3000 Hz RMS | 相對舊警示 | 波形峰值 |
| --- | --- | --- | --- |
| 舊警示 | 0.00555 | 基準 | 0.104 |
| 呼嘯 | 0.00690 | — | 0.074 |
| 受擊 | 0.17797 | +30.1 dB | 0.494 |
| 失敗 | 0.20412 | +31.3 dB | 0.567 |
| 音樂＋呼嘯＋警示混音 | 0.18161 | — | 0.560 |

上述樣本峰值均小於 1，沒有數位削波；另測 20 次同時受擊呼叫的合併、靜音／替換／結束／清理。完整六款 Tone 合成回歸與小行星 48 秒循環亦通過。

七項本機 gate、遊戲 Vite build、精確摘要 dry-run 與 Hub build（35 項任務、R2 bundle 排除）均通過。開聲桌機 Hub／手機 PWA、關聲小視窗 Hub，以及真正的正式桌機 Hub／手機 Hub／手機 PWA 全流程均通過，包含觸控、HUD、教學、全螢幕、成果與保存重試；保存只寫本機 SQLite，沒有正式帳號或訓練紀錄。維持既有七項 CI matrix，Brave 音訊測試留在本機。

可重跑 `node scripts/check-r2-game-audio-browser.mjs --effects-only` 做針對性音效量測；不加參數會驗六款音訊與完整循環。

## 發布與回退

- 版本：`asteroid-shield@2.0.8`。
- contentSha256：`8b64ea45eea1eaab277dc1881fb1a86c2d085b90ab91d87e1d8a72746d53da65`。
- 12 個檔案、1,775,169 bytes；逐檔上傳／回讀，再發布 manifest 與切換 current；正式公開 bytes、MIME、CSP 與 SHA-256 均相符。
- 回退：`2.0.7`，摘要 `63dee846c20307797421d9f5bae473c4c5b38de4c22e0e833d211d49fef0f011`；發布前核對 approved manifest 與全部實際 bytes，沒有執行回退。
- 回退指令：`node scripts/publish-official-game.mjs asteroid-shield --activate-version 2.0.7`。
- 本次 R2 發布沒有手動部署平台；commit／push 後由既有 workflow 驗證及依範圍處理部署。已安裝的版本化 PWA 保留原版，從[穩定入口](https://trainerhub-user-games.pages.dev/games/asteroid-shield/)取得新版。

頻段量測是模擬，尚未以使用者的實體小喇叭試聽；Brave 手機為模擬，實體觸控與 Safari／iOS 未驗收。
