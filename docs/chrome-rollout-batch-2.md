# 遊戲共同介面第二批

| 遊戲 | 本機候選版本 | 中斷時的紀錄 | 中斷試次處理 |
| --- | --- | --- | --- |
| attention-network-task | 2.1.0 | 「結束後不會保存這次紀錄。」檢查 `exit` 與 `stopRuntime` 只停止執行並中止 jsPsych；完成回呼才呼叫 `SendGameResult`。 | 隱藏刺激、丟棄尚未完成的題目；繼續時重播該題並重設作答時鐘。已完成的題目與組間休息狀態保留。 |
| attentional-blink | 1.1.0 | 「結束後不會保存這次紀錄。」檢查 `exit` 與 `stopRuntime` 只停止執行並中止 jsPsych；完成回呼才呼叫 `SendGameResult`。 | 中斷時隱藏字串，繼續時重播未完成的字串並清除部分作答；已完成的回合保留。 |
| continuous-performance | 1.1.0 | 「結束後不會保存這次紀錄。」檢查 `exit` 與 `stopRuntime` 只停止執行並中止 jsPsych；完成回呼才呼叫 `SendGameResult`。 | 中斷時隱藏字母並丟棄當前字母作答；繼續時重播該字母並重設計時，之前的字母保留。 |
| divided-attention | 1.1.0 | 「結束後不會保存這次紀錄。」檢查 `exit` 與 `stopRuntime` 只停止執行並中止 jsPsych；完成回呼才呼叫 `SendGameResult`。 | 凍結圓點、活動時間與算式時鐘，繼續後保留原算式及剩餘時間；暫停期間不取追蹤樣本。 |
| reaction-time | 2.1.0 | 「結束後不會保存這次紀錄。」檢查 `exit` 與 `stopRuntime` 只停止執行並中止 jsPsych；完成回呼才呼叫 `SendGameResult`。 | 暫停時取消等待中或顯示中的訊號，保留已完成紀錄；繼續後由玩家重新開始下一次，活動時限不包含暫停時間。 |
| schulte-grid | 1.1.0 | 「結束後不會保存這次紀錄。」檢查 `exit` 與 `stopRuntime` 只停止執行並中止 jsPsych；完成回呼才呼叫 `SendGameResult`。 | 隱藏方格並凍結回合計時，繼續後保留數字排列與已找到的數字；暫停時的點擊不計。 |

退出全螢幕時的提示為「已退出全螢幕，結束後不會保存這次紀錄。」候選版本尚未發布；瀏覽器與實際裝置驗收尚待執行。
