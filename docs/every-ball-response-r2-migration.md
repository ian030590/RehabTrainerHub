# 有球必應 R2 搬遷審查單

狀態：**R2 套件 `2.0.0` 已完成，等待擁有者核准精確 version／contentSha256 後發布**。`every-ball-response` 寫成 R2 自包含套件（自有設定、聚光燈教學、成果與 i18n），相機與麥克風改由容器的姿勢／麥克風代理執行。平台支援在 `0497235c`（尚未推送）。

範圍：擁有者要求「有球必應跟舌頭動作訓練還沒有變成R2」，並回答「核准三種代理（建議）」「容器在遊戲後方顯示（建議）」，另要求「順帶發現的問題，請一併處理」。

## 對照

| 項目 | 舊流程 | R2 套件 |
| --- | --- | --- |
| 名稱 | 有球必應／Every Ball Gets a Response | 不變 |
| 分類 | brain／attention | 不變 |
| 設定 | `settings.json` 經 Hub `GameSettingsForm`（反應規則、回合數） | 遊戲自有原生 dialog；反應規則與回合數的預設值與範圍不變（`scripts/fixtures/every-ball-response-legacy.json`），另補回偵測方式、準備期畫面與麥克風靈敏度 |
| 相機／麥克風 | 遊戲在同源 iframe 內自己開相機、跑 MediaPipe 或 Web Audio | 容器經使用者同意後執行 runner 的 `/input/pose-tracking-1.0.0/`、`/input/microphone-1.0.0/`；遊戲只收到座標或音量數字 |
| 相機畫面 | 遊戲內的 `<video>` | 容器把影像放在透明遊戲 iframe 後方、遊戲指定的相機窗位置；遊戲只送正規化位置 |
| 執行 | `EveryBallResponsePage.tsx` 內的 jsPsych 流程 | `logic/everyBallRun.ts`，仍由 jsPsych lifecycle 包住，Pixi 繪製在 `scene.ts` |
| 成果 | Hub `JsonTrainingOverlay` 與舊 `score.json` | 遊戲自有成果頁；summary 與 rounds 前五欄名稱沿用舊 `score.json` |

## 沿用的規則

- 三關：第一關只有籃球，看到就拍手；第二關籃球拍手，其他球不動作；第三關籃球拍手、足球拍大腿，網球與海灘球不動作。
- 每題：準備期 1–3 秒（十字或空白），球出現 900 ms，從球出現起 1800 ms 內反應，回饋 550 ms。各關籃球比例、題目順序的洗牌方式與通過標準（100%／85%／80%）不變。
- 相機判定：兩掌中心距離由 ≥0.2 收到 ≤0.12 算拍手；手掌進入髖到膝的範圍算拍大腿，看不到身體時以畫面下方 38% 為範圍；兩次動作間隔 480 ms。模型與門檻和舊版相同（雙手、lite 身體模型，每 70 ms 一次）。
- 麥克風判定：音量門檻依靈敏度換算，降到門檻 62% 以下才會再次觸發，間隔 320 ms；高頻比例 ≥0.34 算拍手，否則算拍大腿（取哪一個畫面的比例見「順帶修正」）。

## 行為差異

這些差異都有測試覆蓋，發布前請擁有者確認。

- **設定**：遊戲自有 dialog，開啟時焦點在第一個欄位，Enter 確認、Escape 返回。2026-09-09 設定改由 Hub 表單呈現後，偵測方式（相機／麥克風）、準備期畫面（十字／空白）與麥克風靈敏度只剩預設值；這次補回表單，靈敏度只在選麥克風時出現。關卡名稱用遊戲內原本的「第一關：單一目標反應」等名稱。
- **開啟感測器與全螢幕**：確認畫面的第一個按鈕是「開啟相機／開啟麥克風」，在視窗模式下由容器詢問同意，所以權限提示不會被全螢幕擋住。開好後按鈕變成「開始訓練」，再按一次才進入全螢幕並開始第一題。舊版先進全螢幕再開相機。拒絕同意、裝置中斷或模型載入失敗都會回到設定並顯示原因。
- **全螢幕**：由容器對自己的外框（Hub 的 `.embedded-training-frame`、獨立入口的 `#game-shell`）進入全螢幕，相機影像才看得到；遊戲本身的 `document.fullscreenElement` 維持 null。
- **聚光燈教學**：確認設定後依序照亮該關的球與動作卡、一題的時間順序、相機窗（麥克風模式為收音條）、按鈕與進度／停止列。矮的橫向畫面把兩組卡片排成並排的 2×2，放在相機窗與按鈕之間。
- **按鈕與鍵盤**：所有裝置都顯示「拍手」「拍大腿」按鈕；空白鍵是拍手，方向鍵下是拍大腿。相機模式下按鈕與相機窗分在左右兩邊（舊版平板上按鈕蓋住相機窗）。
- **畫面提示**：舊版在球出現時於上方列顯示該做的動作，等於直接給答案；現在上方列只顯示關卡、進度與偵測狀態。
- **成果頁**：主要數值為正確題數、正確率與「答對動作的平均反應時間」，另列漏拍、誤拍、動作錯誤次數、當次設定與可切換指標的逐題圖表與明細。反應時間的說明寫明只計算答對且有做動作的題目。
- **保存欄位**：summary（trials、correct、accuracy、misses、falseAlarms、wrongActions、responseMs）與 rounds 的 trial、level、correct、responseMs、fixationMs 與舊 `score.json` 相同；rounds 另加 ball、expected、response、outcome、source 五個數字代碼（對照表在 `score.ts`），config 依序為 difficulty、rounds、inputMode、fixationStyle、soundSensitivity。
- **反應時間**：感測器在容器內執行，動作要經私有 port 才到遊戲，相機與麥克風的反應時間比舊版多約一個畫面更新（十幾毫秒）的訊息延遲。
- **麥克風頻譜**：容器每個畫面都讀頻譜，舊版只在觸發時讀；Analyser 的時間平滑因此和前一個畫面平均，而不是和上一次拍擊平均，拍手／拍大腿的分類更貼近當下的聲音。
- **背景音樂**：不加。麥克風模式下喇叭的音樂會被收進去。

## 順帶修正

- **追蹤中斷造成的誤判**（舊版就有）：瀏覽器檢查用靜止的手部影像時，一題沒有動作卻記成「拍大腿」。記錄收到的座標後發現手完全沒動，是身體模型每隔約 2.5 秒會有 200–300 ms 抓不到髖與膝，判定就從「髖到膝範圍」切成「畫面下方」，身體回來時又算一次新的拍大腿。手放在大腿上時最容易發生。舊版同樣會在手短暫追蹤不到後重新出現時，把還放在大腿上的手或還合著的雙手再算一次。現在：
  - 一個畫面沒有手時保留上一個狀態，手回來時不算新的動作。
  - 身體模型抓不到時沿用最後的髖膝範圍 1 秒（`poseHoldMs`）。
  - 手要離開大腿範圍至少 250 ms（`thighRearmMs`）才會再次觸發，只掉一兩個畫面不算離開。
  - `scripts/check-every-ball-response-game.test.mjs` 的「camera tracking dropouts」測試涵蓋這三種情況，以及抬手 280 ms 後再拍仍會計算。
- **麥克風把拍大腿聽成拍手**（舊版就有）：瀏覽器檢查每輪兩次 110 Hz 低音，各有一次被判成拍手。記錄收音數字後發現，聲音剛超過門檻的第一個畫面只收到聲音開頭的一小段，頻譜因此偏亮（高頻比例 0.53），10–25 ms 後最響的畫面才是真正的低音（0.08）。舊版同樣用第一個畫面判定，而且只在觸發時讀頻譜，還會和上一次拍擊的頻譜平均。現在：
  - 聲音超過門檻後，看 50 ms 內（`decisionMs`）音量達最大值 70% 以上（`loudRatio`）的畫面：每一個都偏亮才算拍手，有一個偏暗就算拍大腿；聲音提早變小就提早決定。最初只看最響的那一個畫面，2026-10-24 重跑時又有低音被判成拍手：容器的頻譜分析會把前一個畫面的頻譜平均進來（0.45），音量卻沒有平均，所以最響的畫面仍帶著開頭的高頻（0.353，剛好超過 0.34），下一個幾乎一樣響的畫面已是 0.044。
  - 反應時間仍從聲音開始的畫面起算，不含這 50 ms。
  - 聲音在反應時限內開始、但分類完成時已超過時限，仍算作答；時限後才按的鍵盤或按鈕仍不算。
  - `a sound is sorted by its dullest frame near peak loudness…` 用瀏覽器記錄到的兩組數字重現上面兩種誤判；`a sound that starts inside the response window…` 涵蓋時限的情況。
- **足球花紋**：舊版 Pixi 的足球只畫出 5 條縫線中的 1 條（`fill()` 用掉了路徑），現在 5 條都畫。
- **預設值與欄位驗證**：舊的 `check-every-ball-response-architecture.test.mjs` 檢查已不存在的共用 shell，改由遊戲與核心測試取代；核心測試納入 `test:game-architecture`。

## 測試與驗證

- `scripts/check-every-ball-response-game.test.mjs`（由 `check-self-contained-game.test.mjs` 引入）：設定與舊值一致、範圍驗證、時間與比例、相機與麥克風判定、追蹤中斷、成果欄位、感測器訊息只接受精確格式、bridge 的同意／預覽／全螢幕訊息、離開時的清理順序、兩次點擊的開始流程、套件自包含、各模式的聚光燈目標。
- `scripts/check-every-ball-response-core.test.mjs`：題目產生、評分與 score 欄位。
- 共用測試同步加入有球必應：UI、成果、設定記憶、音效、antislop、研究契約、目錄架構、middleware 410、training flow（感測器改為代理權限）。
- `scripts/every-ball-response-browser.mjs` 為 Brave 實際操作流程，從 `check-r2-game-browser.mjs --game every-ball-response` 執行：
  - 遊戲 iframe 自己呼叫相機或麥克風會被拒絕。
  - 設定欄位、滑桿範圍、靈敏度只在麥克風模式出現、Enter 確認、教學返回保留設定、五個聚光燈（說明框不得蓋住目標）、確認畫面。
  - 容器同意：先拒絕（回到設定並顯示原因，感測器沒有啟動），再允許。
  - 相機模式：用 MediaPipe 測試圖片做成的串流，實際的姿勢代理找到手並在相機窗畫出手部點；容器影像的位置與遊戲相機窗相差不超過 2 px（視窗與全螢幕都檢查）；模型與 WASM 從 runner 載入。
  - 麥克風模式：容器頁的麥克風換成一段靜音串流，測試在球出現時播放白噪音（拍手）或 110 Hz 低音（拍大腿），由實際的音量代理與遊戲判定。聲音直接播進代理自己的 AudioContext：經由另一個 AudioContext 的串流傳過去時，Brave 偶爾會掉樣本，缺口讓低音聽起來和拍手一樣亮（音量在聲音中途忽高忽低，就是這個情況的特徵）。代理的頻譜分析、音量計算與訊息仍是正式程式碼。
  - 10 題第三關，`Math.random` 固定為 0.5 以預先算出題目：故意漏拍、誤拍、動作錯誤各一次，其餘以鍵盤、按鈕或聲音答對；檢查成果頁、保存失敗後重試、資料庫中每一題的代碼與 summary。
  - 結束、停止與裝置中斷都離開全螢幕、停止裝置並隱藏相機影像。
- 瀏覽器檢查抓到並已修正：追蹤中斷誤判、麥克風把低音聽成拍手（見上）、設定 dialog 開啟時焦點不在表單內、矮的橫向畫面教學卡片被擠成一字一行。

### Brave 結果（2026-10-24）

相機用 MediaPipe 測試圖片做成的串流，麥克風用上面說明的測試音，`/api/*` 只寫本機 SQLite。全部通過：

| 流程 | 結果 |
| --- | --- |
| `--lobby`（桌機訪客，相機） | 通過 |
| `--lobby --signed-in --english` | 通過 |
| `--lobby --session-failure` | 通過 |
| `--standalone --mobile --english` | 通過 |
| `--lobby --stop` | 通過，不保存並關閉相機 |
| `--sensor-disconnect` | 通過，不保存並關閉相機 |
| `--settings-memory` | 通過，五個設定在 Hub 重開後保留 |
| `--revoke` | 通過，撤回後移除遊戲，沒有保存成果 |
| `--lobby --microphone` | 2 次都通過 |
| `--tablet --microphone`（820×1180） | 2 次都通過 |
| `--mobile --microphone` | 3 次都通過 |
| `--standalone --microphone --english` | 通過 |
| `--sensor-disconnect --microphone` | 通過，不保存並關閉麥克風 |

修正分類規則與測試音之前，麥克風流程約每兩三次有一次把最後一個低音判成拍手（見「順帶修正」與上面的測試說明）。麥克風各列都是最終建置與最終測試音。相機各列是麥克風分類修正前的建置；修正只改麥克風分類，最終建置再跑一次 `--lobby` 仍通過。真人、實體相機與麥克風、Safari／iOS 未驗收。

## 發布候選

5 個檔案（`index.html`、`game.json`、`preview.webp`、JS、CSS）。兩次重新建置的 digest 相同。下方的發布指令會先重新建置，digest 與下表一致才上傳並切換 current。

| gameId | version | contentSha256 | bytes |
| --- | --- | --- | --- |
| `every-ball-response` | `2.0.0` | `25e7c6527d1041109eca10a1b9fcfdc6e0210f8d8dae7e34973a39a68cf7a915` | 1170693 |

順序（擁有者執行）：

1. 推送平台提交 `0497235c`（Hub／runner 的姿勢、麥克風與舌頭代理），等部署完成：`git push origin 0497235c:main`。
2. 核准下表的 version／contentSha256 後發布：`node .tmp/brain-tools/publish-approved.mjs .tmp/brain-tools/oral-candidates.txt`（同一份清單另含舌頭動作訓練 `2.0.0`，兩款依序發布，不會同時執行）。
3. 正式 runner 驗證通過後，推送本次登記（`officialGameReleases.json` 與 catalog）：`git push origin main`。
