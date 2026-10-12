# 小行星護盾音量平衡與直接輸出 2.0.9

2026-10-13：修正 2.0.8 負向提示比成功提示明顯大聲，並依使用者要求移除上次新增的限幅處理。沿用同一音效任務已核准的發布／commit／push 流程，已發布 R2、切換 current 至 `2.0.9`，核對正式 API／固定版本 session／12 個公開檔案，並通過桌機 Hub／手機 Hub／手機 PWA 三個流程。見[正式收據](releases/asteroid-shield-2.0.9.json)及[驗收摘要](migrations/asteroid-shield-audio-balance-2.0.9/production/summary.json)。

## 音量與資源

- 成功／勝利正弦提示從 -21 調整為 -15 dB；受擊／失敗方波從 -9 調整為 -17 dB，依音色能量補償，保留各自的音高與節奏。
- 四軌背景音樂、隕石呼嘯與提示音直接連到遊戲的 destination；移除自有 Limiter、額外 output 節點與轉接函式。
- 同一畫面的重複成功提示合併成一組三音；20 次同時呼叫從 60 個排程音降為 3 個，後續成功仍正常發聲。結束時先清理未完成的成功／受擊提示，再播放結束音。
- 完整套件由 1,775,169 降為 1,773,051 bytes，減少 2,118 bytes；原生壓縮器建立數為 0。沒有做實體裝置 CPU 百分比基準測試。

預聽：[成功](migrations/asteroid-shield-audio-balance-2.0.9/audio/success.wav)、[受擊](migrations/asteroid-shield-audio-balance-2.0.9/audio/damage.wav)、[勝利](migrations/asteroid-shield-audio-balance-2.0.9/audio/victory.wav)、[失敗](migrations/asteroid-shield-audio-balance-2.0.9/audio/defeat.wav)。WAV 是測試擷取產物，遊戲仍使用自身 Tone.js 直接合成。

## 測試先行與實際聲波

先更新行為測試並確認失敗：舊負向音量比正向高，20 次成功排程 60 音，額外壓縮器仍被建立。真實瀏覽器量測也重現舊版負向樣本的平均音量約比成功高 15 dB。第一次校準的中頻比較差距為 -3.20 dB，超出 ±3 dB 門檻；微調音量後通過，沒有放寬測試。

以實際 Brave PCM 的最響 100 毫秒 RMS 比較提示，避免不同長度影響單次提示音量的判斷；另測 500 Hz highpass＋3000 Hz lowpass 的近似小喇叭頻段。[完整量測](migrations/asteroid-shield-audio-balance-2.0.9/audio/measurements.json)：

| 比較 | 原始音訊差距 | 500–3000 Hz 差距 |
| --- | --- | --- |
| 受擊相對成功 | -1.86 dB | -2.21 dB |
| 失敗相對勝利 | -1.40 dB | -1.69 dB |

負值表示負向提示略低於正向提示，全部在 ±3 dB 驗收範圍。四軌音樂＋呼嘯＋20 次受擊／20 次成功呼叫的直接輸出樣本峰值為 0.379，小於 1，沒有數位削波；全部測試 Context 的原生壓縮器計數均為 0。

通過 38 項音訊、13 項小行星、148 項架構測試，七項本機 gate、Vite build、精確摘要 dry-run 及 Hub build（35 項任務、R2 bundle 排除）。六款真實 Tone 回歸、小行星完整 48 秒循環、靜音／替換／返回／清理，以及本機／正式桌機 Hub、手機 Hub／PWA 的完整遊戲與保存重試均通過。證據位於 [tests](migrations/asteroid-shield-audio-balance-2.0.9/tests/)及正式收據；保存僅寫本機 SQLite，沒有正式帳號或紀錄。

維持既有七項 CI matrix，Brave 音訊測試留在本機。可用 `node scripts/check-r2-game-audio-browser.mjs --effects-only` 重跑量測；不加參數執行六款完整回歸。

## 發布與回退

- 版本：`asteroid-shield@2.0.9`。
- contentSha256：`ed8c281dc4f599bffb25fdf609dfb6051c09e050cbc349499649a49ff3477abe`。
- 12 檔、1,773,051 bytes；逐檔上傳／回讀後發布 manifest，再切換 current；正式公開 bytes／MIME／CSP 與雜湊相符。
- 回退：`2.0.8`，摘要 `8b64ea45eea1eaab277dc1881fb1a86c2d085b90ab91d87e1d8a72746d53da65`；發布前核對 approved manifest 與全部實際 bytes，沒有執行回退。
- 回退指令：`node scripts/publish-official-game.mjs asteroid-shield --activate-version 2.0.8`。
- 本次沒有手動部署平台；commit／push 後由既有 workflow 驗證並依範圍部署。已安裝的版本化 PWA 保留原版，從[穩定入口](https://trainerhub-user-games.pages.dev/games/asteroid-shield/)取得新版。

頻段量測是模擬，尚未使用實體小喇叭試聽；Brave 手機為模擬，實體觸控與 Safari／iOS 未驗收。
