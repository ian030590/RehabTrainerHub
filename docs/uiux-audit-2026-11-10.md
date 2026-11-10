# UI／UX 審查：2026-11-10

審查基準：工作樹 `16d46aac`、當次公開的 `https://trainerhub.cc/`，以及既有 `DESIGN.md`。這是審查報告，沒有修改產品程式、登入正式帳號、建立正式訓練紀錄、部署或發布。

主要結論：優先處理登入視窗的鍵盤行為、載入與錯誤回饋、非同步清單的位置變動及字型失效。排版最明顯的問題是開發者頁手機標題的單字末行與過緊行距。篩選面板的動畫、安全區和主要大廳版面已有良好基礎，無須為了加入設計術語而全面改版。

## 檢查範圍與證據

- 正式站七個公開路由：大廳、進度、衛教、下載、關於、隱私、開發者。
- 大廳視窗：320×740、390×844、768×1024、1024×900、1440×1000；其他公開頁以 390px 為主，開發者頁另查 1440px。
- 實際指標點擊、Tab、Escape、手機篩選開關及英文大廳；另執行字型阻擋與根字級 200% 壓力檢查。後者不等同已完成瀏覽器原生縮放、作業系統文字放大或 iOS 驗收。
- 慢速登入檢查、患者清單與進度 API 503 以瀏覽器攔截回應重現。假身分與清單只存在臨時瀏覽器中，所有 `/api/*` 都由假回應處理；所有非 GET／HEAD／OPTIONS 請求均阻擋。
- 遊戲容器與部分 R2 遊戲只做原始碼抽查，沒有逐款執行所有遊戲或硬體流程。
- 既有相關測試 **53／53 通過**。這些測試沒有完整涵蓋下述焦點、慢網路及字型失效情境，不代表這些問題已被測試排除。

原始量測：[一般情境](../.tmp/uiux-audit-2026-11-10/measurements.json)、[深入情境](../.tmp/uiux-audit-2026-11-10/deep-measurements.json)。截圖同目錄。`.tmp` 是本機臨時證據，未納入版本控制。

## 優先改善項目

P1：直接妨礙操作的問題；P2：影響辨識、可讀性、狀態理解或操作效率；P3：精修或有條件改善。各項的「來源確認」不等同已在真人、閱讀器與所有瀏覽器驗證。

### 01．P1：登入視窗的焦點會離開視窗，Escape 關錯層

**正式站重現。** 以指標開啟登入視窗後，焦點仍在背景「註冊／登入」按鈕。Tab 經過視窗內控制項後，繼續到背景練習指南、搜尋、篩選與遊戲操作。Escape 把帳號 popover 隱藏，登入 dialog 仍保留在 DOM，但一起變成不可見，沒有正常關閉與焦點還原。

來源：[AuthPanel.tsx:635](../packages/ui/src/components/AuthPanel.tsx#L635)、[個人資料視窗:744](../packages/ui/src/components/AuthPanel.tsx#L744)、[HubNavigation.tsx:129](../apps/rehabtrainerhub/app/HubNavigation.tsx#L129)。`div role="dialog" aria-modal="true"` 沒有自行提供瀏覽器模態行為。

建議：以 native dialog 或等效、經驗證的模態實作統一登入／個人資料流程。開啟時移入焦點、限制背景操作與 Tab 範圍、Escape 關閉最上層、關閉後返回觸發鈕。可參照現有手機篩選面板的做法。驗收依據：[WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。

### 02．P2：手機登入的主要操作被大量前置文字推到視窗下方

**正式站重現。** 在 390×844 視窗，初始畫面主要是說明與提醒；同意勾選框約在 y=849、Google 登入 y=904、Email y=1036、取消 y=1361。使用者必須先在對話框內捲動，才能接觸登入表單；頂端也缺少常駐的關閉操作。

來源：[privacyNotice:587](../packages/ui/src/components/AuthPanel.tsx#L587)、[登入表單:642](../packages/ui/src/components/AuthPanel.tsx#L642)、[取消:734](../packages/ui/src/components/AuthPanel.tsx#L734)。[截圖](../.tmp/uiux-audit-2026-11-10/auth-open.png)。

建議：重新安排摘要、完整說明與操作的層級，讓關閉操作始終可達。可用明確 disclosure 展開細節；必須保留必要告知、明確同意與原有驗證，不能以折疊取代告知或預先勾選。

### 03．P2：點登入後等待網路，按鈕沒有 pending 回饋

**瀏覽器慢速回應情境重現。** 把 session 檢查延後 2.8 秒：點擊後 300ms 沒有 dialog、按鈕未停用、文字仍是「註冊／登入」，也沒有 `aria-busy`。等待完成才開啟視窗。來源的逾時上限為 5 秒。

來源：[openAccountDialog:403](../packages/ui/src/components/AuthPanel.tsx#L403)、[按鈕:625](../packages/ui/src/components/AuthPanel.tsx#L625)、[逾時:224](../packages/ui/src/components/AuthPanel.tsx#L224)。已有「檢查登入狀態中」文案但未呈現。

建議：立即顯示明確的載入狀態，或先開視窗再檢查 session；抑制重複呼叫並允許取消。這是 pending feedback，不需要先假裝登入成功。

### 04．P2：清單晚到時，搜尋下方的大廳會被往下推

**來源與瀏覽器假資料情境確認。** 患者清單首次載入先回傳 `null`，完成後插在結果前。測試中 `.lobby-layout` 從 y=419.98 移到 y=990.53，約 **571px**；該次非近期操作引起的 layout-shift entry 約 **0.340**。

這是特定假清單與延遲下的重現值，不是正式使用者的全站 CLS 或 P75。一般未登入大廳當次五種寬度的非近期操作位移合計為 0～0.0162，沒有因此判定全站 CLS 不合格。正式效能仍應依真實使用分布評估：[CLS 定義與量測](https://web.dev/articles/cls)。

來源：[AssignedPracticePlan.tsx:39](../apps/rehabtrainerhub/app/AssignedPracticePlan.tsx#L39)、[TrainingLobby.tsx:311](../apps/rehabtrainerhub/app/TrainingLobby.tsx#L311)。

建議：已知需要載入清單的狀態保留合理區域，或先協調這一區與下方內容的首次呈現。避免所有沒有清單的人永久留下大塊空白；重新整理時保留既有清單。

### 05．P2：進度讀取失敗仍顯示 0 天與尚無紀錄

**瀏覽器 503 假回應重現。** 顯示「目前無法載入進度，請稍後再試」的同時，仍顯示「0 天／尚無訓練紀錄」，頁面沒有重試按鈕。使用者可能把讀取失敗理解為紀錄消失或連續天數歸零。

來源：[ProgressDashboard.tsx:216](../apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx#L216)、[CSV 錯誤與分頁:362](../apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx#L362)。[截圖](../.tmp/uiux-audit-2026-11-10/progress-error-fixture.png)。

建議：區分真正的零、沒有資料、尚未登入、載入中、讀取失敗。失敗時顯示「暫時無法取得」及重試；若有前次成功資料，保留並標明更新失敗。CSV 首次清單讀取失敗也需要可用的重試入口。

### 06．P2：外部圖示字型失效時，介面出現原始英文詞

**正式頁面阻擋字型服務後重現。** `explore`、`help`、`search`、`tune` 等 ligature 文字直接出現；搜尋圖示區的文字與 placeholder 重疊，帳號及底部分頁圖示也出現裁切的字串。這個情境沒有整頁水平溢出，但辨識與視覺品質明顯下降。

來源：[外部字型載入 layout.tsx:56](../apps/rehabtrainerhub/app/layout.tsx#L56)、[圖示樣式 globals.css:175](../apps/rehabtrainerhub/app/globals.css#L175)、[搜尋圖示:1037](../apps/rehabtrainerhub/app/globals.css#L1037)。[截圖](../.tmp/uiux-audit-2026-11-10/fonts-blocked-390.png)。

建議：關鍵操作圖示改為隨產品提供的 SVG 或其他不依賴外部字型的形式；保留可見標籤與 accessible name。固定位寬可減少位移，但單純裁掉英文詞不足以恢復辨識。Noto 文字字型的 fallback metrics 應另量測，不能把圖示問題都歸因為文字 x-height。

### 07．P2：部分獨立操作目標低於專案的 44px 目標

**正式站尺寸確認。** 768px 以上的「網站導覽」高 36px；開發者頁「複製提示詞」高 34px。登入的註冊／取消按鈕高約 26px。一般大廳手機操作與篩選面板多已達 44px。

來源：[globals.css:684](../apps/rehabtrainerhub/app/globals.css#L684)、[複製按鈕:4475](../apps/rehabtrainerhub/app/globals.css#L4475)、[AuthPanel.css:311](../packages/ui/src/components/AuthPanel.css#L311)。

建議：讓這些獨立按鈕的可點區至少 44×44px，視覺圖示本身不必放大到 44px。優先照顧平板和動作控制不精準的使用者。不要把 input 方框本身的 20px 當成缺陷：連動 label 的整體可點區也要計算。

44px 是本站設計目標，也符合 WCAG enhanced target 的尺寸方向；不能把所有低於 44px 的控制項直接宣告 WCAG AA 不合格。AA minimum 是 24×24 CSS px，並含間距及其他例外：[W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)。

### 08．P2：開發者頁手機中文標題出現單字末行，字距與行距偏緊

**正式站截圖確認。** 390px 時「開發居家練習遊戲」換成七字加末行單獨「戲」。當時 H1 字級 **50.7px**、行高 **49.686px（0.98）**、tracking **-2.7885px（-0.055em）**。沒有觀察到字形實際重疊，因此不將過緊行高描述成已發生重疊。

來源：[globals.css:3800](../apps/rehabtrainerhub/app/globals.css#L3800)、[手機字級:4694](../apps/rehabtrainerhub/app/globals.css#L4694)。[截圖](../.tmp/uiux-audit-2026-11-10/developer-390.png)。

建議：針對繁中與手機斷點調整字級、tracking、leading，重新驗證 320／390／768px 與英文。中文多行標題可試較接近 1.15～1.25 的行高、較小幅的負字距，再由截圖確認。保留正常換行與既有欄寬。

既有 [DESIGN.md](../DESIGN.md) 與 [check-hub-presentation.test.mjs:32](../scripts/check-hub-presentation.test.mjs#L32) 要求標題自然換行、開發者說明使用可用欄寬，並禁止對這些標題套用 `text-wrap: balance`。本報告不建議用全站 balance 或固定窄欄推翻這個既有決策。

### 09．P2：個人資料錯誤訊息在視窗外

**來源確認，未登入真人帳號驗證。** 個人資料驗證及儲存失敗寫入共用 `error`；輸出卻在 backdrop 外、帳號 popover 內。視窗開啟時，錯誤可能被遮住，且沒有 alert/live announcement。

來源：[驗證:552](../packages/ui/src/components/AuthPanel.tsx#L552)、[儲存失敗:573](../packages/ui/src/components/AuthPanel.tsx#L573)、[錯誤位置:631](../packages/ui/src/components/AuthPanel.tsx#L631)、[個人資料視窗:743](../packages/ui/src/components/AuthPanel.tsx#L743)。

建議：在當前視窗內提供錯誤摘要及重試；對應欄位用 `aria-invalid`／`aria-describedby`，必要時把焦點移到第一個錯誤。不要只在被遮住的帳號選單內提示。

### 10．P2：遊戲操作的名稱重複，控制項清單難辨識

**來源與正式頁面確認。** 每張卡的 button／link 都叫「開始訓練」／「安裝遊戲」。article 雖有遊戲名標籤，子控制項不會因此自動把遊戲名稱帶進 accessible name。

來源：[TrainingLobby.tsx:490](../apps/rehabtrainerhub/app/TrainingLobby.tsx#L490)、[開始／安裝:527](../apps/rehabtrainerhub/app/TrainingLobby.tsx#L527)。

建議：使用「開始訓練：畫畫塔防」、「安裝遊戲：畫畫塔防」等名稱；保留可見文字包含在 accessible name 中。可參考清單內 [PracticePlanDetails.tsx:37](../apps/rehabtrainerhub/app/PracticePlanDetails.tsx#L37) 已有的模式。這有助於閱讀器的控制項清單及語音操作；本次未實測閱讀器或語音軟體。

### 11．P3：網站導覽的捲動排程尚未完整配合減少動態與快速切步

**來源確認。** 教學 engine 以 50ms timer 呼叫 `scrollIntoView({ behavior: 'smooth' })`，沒有讀取減少動態偏好，也沒有取消前一步的 timer 或比對當前步驟。快速切步存在舊捲動排程執行的風險，實際發生頻率未量測。

來源：[toutourEngine.ts:461](../packages/ui/src/tour/toutourEngine.ts#L461)。CSS 的 `scroll-behavior: auto` 不能取代對明確 JS smooth 請求的處理。另 [globals.css:3749](../apps/rehabtrainerhub/app/globals.css#L3749) 在 reduced motion 下仍保留載入圖示無限旋轉。

建議：新步驟取消舊排程並比對步驟索引；減少動態時直接定位。載入狀態可提供靜態圖示與文字。本項不直接宣告為 WCAG 違規，也不更動遊戲刺激時間。

## 指定項目逐項判斷

| 項目 | 判斷與改善空間 |
| --- | --- |
| Kerning | 未觀察到需單獨修正的字偶問題；沒有顯式 `font-kerning` 不代表失效。先處理已確認的 tracking，再以實際中英標題檢查。 |
| Optical centre | 本次截圖未見一致性的偏心問題。三角播放符號可在個別元件做視覺置中確認，不建議全站加 transform 位移。 |
| Tabular numbers | 篩選計數與抽樣遊戲 HUD 已有 `tabular-nums`。進度及管理數字可明確統一，但現有字型可能本來就等寬，未量測出跳動前只列一致性建議。數字表格按欄位性質考慮靠右。 |
| Layout shift | 第 04 項已重現；大廳圖片本身已有尺寸與 16:9 預留。一般首次讀取當次量測良好，不能取代真實使用者效能資料。 |
| Tracking | 第 08 項是具體改善位置。中文不宜直接沿用極緊的英文字標設定。 |
| Optimistic update | 搜尋、篩選與展開即時更新已合理。訓練紀錄、登入與後台儲存應保留伺服器確認，先補 pending／失敗／重試，不要先宣告保存成功。 |
| x-height | 繁中為主，沒有單憑缺少 `font-size-adjust` 判定缺陷。可在冷字型、fallback 與英文下量測可讀性及尺寸差，再決定 metric override。 |
| Touch target | 第 07 項。主操作多已達 44px，補齊登入、平板導覽與複製操作。 |
| Leading | Hub 正文約 1.6，已有基礎；開發者多行 H1 的 0.98 值得優先調整（第 08 項）。 |
| Origin-aware animation | 手機篩選以目前捲動位置決定背景 transform origin，已有實作。訓練開啟可選擇保留來源卡片標題連續性，不必全站改動畫。 |
| OKLCH | 可在未來建立分類色階時使用，以改善感知明度一致性；現有 hex／語意 token 並非缺陷。轉色彩空間不能代替對比計算。 |
| Widow | 正文已有 `text-wrap: pretty`；第 08 項的標題單字末行已確認，建議以特定斷點字級等處理，保留既有自然換行策略。 |
| Safe area | Hub 頂／底導覽及篩選 footer 已使用 safe-area inset，viewport 也為 cover。程式基礎合理，實體 iOS、橫向與系統鍵盤仍需驗收。 |
| Stagger | 沒有必要讓整頁遊戲卡依次延遲出現。這類工具以快速可操作為先；若新增只用在少量狀態變更，並遵守減少動態偏好。 |
| Line length | 1440px 開發者 lead 實測約 1045px 寬，但既有設計明確要求使用欄寬。列為有閱讀證據後才考慮的條件優化，避免直接縮窄全文。程式碼／表格與一般段落應分開評估。 |
| Affordance | 大廳有實際按鈕、底線連結、選取狀態及焦點環。優先改善登入關閉入口與重複的遊戲操作名稱（第 02、10 項），不是把整張卡假裝成按鈕。 |
| Combobox | 後台個案與遊戲長選單可評估可搜尋 combobox（PracticePlanManager.tsx:35、140）；短選單保留 native select。新增前需覆蓋鍵盤、輸入法、選取／清除與空結果。尚未實測後台操作效率。 |
| Interruptible animation | 篩選面板會取消舊 frame、接續位置與速度；已有良好處理。教學切步排程是待補的例外（第 11 項）。 |
| Progressive disclosure | 大廳指南已用原生 details 分層；登入的大量前置資訊可改善（第 02 項），但必須保留明確告知與同意。 |
| Shared element transition | 卡片到訓練容器可作低優先的空間連續性實驗；目前缺少此效果不算錯誤。應可取消、支援 reduced motion，且不可干擾練習刺激、計時、全螢幕與 iframe 隔離。 |

## 現有優點與驗收結果

| 檢查 | 結果與證據 |
| --- | --- |
| 大廳五寬度整頁 reflow | PASS：當次無超出視窗的頁面級橫向溢出。開發者目錄與 code 的局部水平捲動不能直接視為整頁溢出。 |
| 手機篩選基本鍵盤流程 | PASS：實際點開後 Escape 關閉，焦點返回 `.filter-mobile-trigger`。 |
| 登入模態鍵盤流程 | FAIL：初始焦點留在背景、Tab 離開視窗、Escape 隱藏父層，詳第 01 項。 |
| 慢速登入回饋 | FAIL：延遲情境中沒有 pending 呈現，詳第 03 項。 |
| 進度失敗與真零區分 | FAIL：503 與零值／無紀錄同時顯示，沒有重試，詳第 05 項。 |
| 圖示字型失效韌性 | FAIL：阻擋字型後圖示露出原始字串並重疊／裁切，詳第 06 項。 |
| 主要正文與語意 | 已有：正文行高、語意標題、skip link、搜尋 label、結果 live region、篩選 chip／換頁焦點處理。 |
| 底部安全區／手勢／動畫 | 來源確認：safe-area、visualViewport、可中斷 spring、reduced-motion 定位、捲動位置還原均有實作；不是實體裝置全通過聲明。 |
| 品牌／色彩／裝飾 | 保留：既有黑灰文字、語意色票、分類色與低動態定位；未發現需要導入新色彩系統或大量進場特效的證據。 |
| 200% 與完整無障礙 | NOT ASSESSED：根字級壓力截圖已留存，未完成原生縮放、字距覆寫、閱讀器、高對比及所有控制項的完整驗收。 |
| 完整遊戲與硬體 | NOT ASSESSED：沒有逐款 gameplay、真實相機、實體觸控、Safari／iOS 與登入後真人流程驗收。 |

執行的既有測試：

```powershell
node --test scripts/check-hub-navigation.test.mjs scripts/check-hub-presentation.test.mjs scripts/check-mobile-filter-sheet.test.mjs scripts/check-lobby-filters-pagination.test.mjs scripts/check-account-identity.test.mjs scripts/check-tour.test.mjs
```

結果：53 tests、53 pass、0 fail。未新增自動化測試、未改測試入口，因此未執行整套七 gate 或建置／推送。後續若實作，依 AGENTS.md 先以可執行行為測試重現失敗，再修改最小範圍，並接入 root `test:ci`；上述瀏覽器／字型／視窗情境應納入適用的本機驗收。

建議實作順序：01 → 03／05／09 → 04／06／07／10 → 02／08 → 11；其餘指定項目保留為有證據後才安排的精修。
