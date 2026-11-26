---
name: 遊戲內共同元素
description: 每款 R2 遊戲各自實作、規格一致的設定對話框、成果畫面與停止中斷面板；變數命名統一，主色取自遊戲所屬分類。
colors:
  primary-movement: "#005eb8"
  primary-movement-hover: "#00478d"
  primary-vision: "#006c47"
  primary-vision-hover: "#005235"
  primary-cognition: "#7a4a24"
  primary-cognition-hover: "#5a3519"
  primary-oral: "#6750a4"
  primary-oral-hover: "#4f378b"
  background: "#f6f7f9"
  surface: "#ffffff"
  text: "#202428"
  heading: "#14212b"
  text-muted: "#606970"
  border: "#d4d9de"
  border-strong: "#7d868e"
  text-on-accent: "#ffffff"
  error: "#ba1a1a"
  overlay: "rgba(20, 24, 28, 0.54)"
typography:
  results-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 4vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  panel-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "calc(1.5rem * 1.15)"
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  key-value:
    fontFamily: "system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 4vw, 3rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  panel-body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-movement}"
    textColor: "{colors.text-on-accent}"
    rounded: "{rounded.md}"
    padding: "8px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-movement-hover}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.heading}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  dialog-settings:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    width: "42rem"
  setting-section:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "20px"
  input-setting:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px"
    height: "44px"
  key-metric-lead:
    backgroundColor: "transparent"
    textColor: "{colors.heading}"
    padding: "0"
  key-metric:
    backgroundColor: "transparent"
    textColor: "{colors.heading}"
    padding: "0"
  interrupt-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "24px"
    width: "28rem"
---

# Design System: 遊戲內共同元素

本檔是 `apps/rehabtrainerhub/games/` 底下每款 R2 遊戲都會出現的三組介面的**目標規格**：設定對話框、成果畫面、遊玩中的停止與中斷面板。Hub 頁面看根目錄 `DESIGN.md`；遊戲刺激、盤面、canvas 與玩法畫面不在本檔範圍，由各遊戲自己決定。

frontmatter 的元件以動作藍示範；實作時把 `primary-*` 換成該遊戲的分類色（見 Colors）。本檔描述的是應有樣子，現況與規格不符的遊戲列在 Do's and Don'ts 最後的「待對齊」表。

## Overview

**Creative North Star: "同一套儀表，各自的車（Same Dashboard, Own Vehicle）"**

每款遊戲是獨立的一台車，零件不互借，但儀表、煞車與停車的位置在每台車上都一樣。使用者從大廳的分類卡片進入遊戲，看到同一個顏色延續到設定按鈕；在任何遊戲裡按「停止」都先停下來問一句；結束時第一眼就知道「做完了、有沒有存到」。規格一致，實作各自擁有。

使用者多是居家練習的年長者，常用平板或手機，可能被打斷，也可能誤觸。介面因此安靜、字大、按鈕大，只有一個主要動作。遊戲刺激才是畫面主角，共同元素只在練習前、暫停時與結束後出現。

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1。三組元素在每款遊戲刻意長得一樣，動態只剩按壓回饋。

**Key Characteristics:**
- 每款遊戲自己寫一份 CSS 與標記，不引入共用元件、套件或其他遊戲的程式碼。
- 變數名稱在所有遊戲相同，數值依遊戲分類填入。
- 停止永遠先開中斷面板，不直接結束。
- 成果畫面先給結論與保存狀態，細節收在「查看詳細資料」裡。
- 觸控區至少 44px，主要按鈕 48px；焦點外框 3px。

## Colors

中性灰白構成所有共同元素，唯一的色彩是遊戲所屬練習分類的主色，與大廳卡片同一個顏色。

### Primary
分類主色寫入每款遊戲 `game.css` 的 `:root`，名稱固定為 `--primary`、`--primary-hover`、`--primary-soft`。數值取自 `games/catalog.ts` 的 `trainingThemes`（遊戲 build 時不 import catalog，只抄數值）：

- **動作藍**（`primary-movement`／`-hover`）：上肢、下肢動作類，也是未分類遊戲的預設。`--primary-soft` 為 `color-mix(in srgb, var(--primary) 8%, #fff)`。
- **視覺綠**（`primary-vision`／`-hover`）：視覺訓練類。淡底 8%。
- **認知棕**（`primary-cognition`／`-hover`）：注意力、記憶、高階認知、語言類。淡底 10%。
- **口腔紫**（`primary-oral`／`-hover`）：口腔訓練類。淡底 9%。

分類色只用在：主要按鈕底色、焦點外框、圖表資料點與趨勢線、設定摘要徽章文字與淡底、表單控制的 `accent-color`。

### Neutral
- **淺灰底**（`background`）：設定對話框內層、表格斑馬列。
- **白表面**（`surface`）：設定區塊、成果統計區塊、中斷面板、表格儲存格、次要按鈕。
- **內文墨**（`text`）與**標題墨**（`heading`）：內文與 H1 到 H3。
- **輔助灰**（`text-muted`）：說明、保存狀態、表頭、圖表座標文字。
- **細邊線**（`border`）：區塊與表格分隔。**控制輪廓**（`border-strong`）：輸入框、次要按鈕外框。
- **錯誤紅**（`error`）：設定驗證錯誤與保存失敗，必定搭配文字。
- **遮罩**（`overlay`）：設定對話框與中斷面板背後。

### Named Rules
**The Same-Name Rule.** 所有遊戲使用同一組變數名稱：`--primary`、`--primary-hover`、`--primary-soft`、`--background`、`--surface`、`--text`、`--heading`、`--text-muted`、`--border`、`--border-strong`、`--text-on-accent`、`--bg-overlay`、`--error`、`--radius`。不另取別名（如 `--accent`、`--bg-card`）。

**The Category-Owns-Color Rule.** 共同元素的色彩只來自遊戲的分類主色。大廳卡片是棕色的遊戲，進入後設定按鈕也是棕色。

**The No-Stale-Fallback Rule.** `var()` 不寫其他顏色的後備值。`var(--primary, #146c5b)` 這類舊綠色後備是錯的；變數已在 `:root` 定義，直接寫 `var(--primary)`。

## Typography

**Body Font:** `system-ui, sans-serif`（遊戲在隔離的 runner origin 執行，不載入網頁字型）

**Character:** 系統無襯線字，靠字重與字級分層。共同元素一律粗體（700 起），讓年長使用者在平板上一眼讀到。

### Hierarchy
- **Results Title**（700，`clamp(1.8rem, 4vw, 2.6rem)`，1.15）：成果畫面唯一的 H1。
- **Panel Title**（900，`calc(1.5rem * 1.15)`，640px 以上 `calc(1.875rem * 1.15)`）：設定對話框與規則面板的 H2。
- **Key Value**（900，`clamp(2.1rem, 4vw, 3rem)`，`tabular-nums`）：主要指標的數值。
- **Panel Body**（700，1.15rem，1.6）：`training-panel` 與設定對話框內文，依 `AGENTS.md` 為設定表單 1.15 倍；區塊 H3 為 `calc(1.125rem * 1.15)`、900。
- **Body**（700，1rem，1.5）：成果畫面內文、表格、按鈕。最小字級 0.95rem 只給定義清單的項目名稱與表頭。

### Named Rules
**The Semantic Order Rule.** 成果畫面一個 H1，區段 H2，細節內的小節 H3；設定對話框標題 H2，設定區塊 H3。

## Layout

三組元素都是蓋在遊戲畫面上的全畫面層，不與遊戲刺激並排。

- **設定對話框**：寬 `calc(100% - 32px)`，上限 42rem，高度上限 `calc(100dvh - 32px)`；頁首、可捲動內容、頁尾三段，只有內容捲動。內距 20px，640px 以上 24px 32px。
- **成果畫面**：可捲動全畫面，內容上限 78rem 置中，內距 24px，600px 以下 16px。
- **中斷面板**：置中，寬 `min(28rem, calc(100% - 32px))`。

設定類用 640px（`min-width: 640px` 放寬、`max-width: 639px` 改直排）。成果畫面分手機（600px 以下）、平板（601 至 1023px）與桌機（1024px 以上）三種布局。趨勢圖可點選資料點，逐回合明細表橫向捲動時固定首欄。遊戲畫面自己的斷點不受限。

頁面不得橫向溢出；只有成果表格可在自己的容器內橫向捲動。

## Elevation & Depth

扁平為主。共同元素整層浮在遊戲上方，因此只有這一層帶陰影；層內的區塊用邊線與明度分組。

### Shadow Vocabulary
- **浮層陰影**（`0 8px 24px rgba(20, 33, 43, 0.12)`）：設定對話框外框、中斷面板。
- **貼地陰影**（`0 1px 2px rgba(20, 33, 43, 0.08)`）：設定對話框內的 `training-setting` 區塊。

遮罩用 `--bg-overlay`；`backdrop-filter: blur(12px)` 只用在設定對話框背後，中斷面板背後不模糊，讓使用者看得到被暫停的畫面。

## Shapes

溫和的方：對話框、區塊、按鈕、輸入框都是 8px（`--radius`）；設定摘要徽章 6px。不使用膠囊形或正圓按鈕（手勢遊戲的圖示返回鈕除外，見 Components）。

成果畫面所有帶底色、邊框或焦點外框的區塊與控制項一律使用 `--radius` 圓角，包括面板、當次設定、統計區塊、表格捲動區、可展開的明細與標題、按鈕及下拉選單。

## Components

### Buttons
- **主要按鈕**（`.btn.btn-primary`）：分類主色實心、白字 800、高 48px、內距 8px 24px；hover 改 `--primary-hover`，按下 `translateY(1px)`。每個畫面只有一顆。
- **次要按鈕**（`.btn.btn-ghost`）：白底、`--border-strong` 外框、標題墨字 800、高 44px；hover 時外框與文字改分類主色。
- **停用**：不透明度 0.6，游標 `not-allowed`（保存中用 `wait`）。
- **焦點**：所有按鈕、輸入、選單、可聚焦區域 `outline: 3px solid var(--primary); outline-offset: 3px`。

### 設定對話框（Settings Dialog）
原生 `<dialog>` 以 `showModal()` 開啟，`aria-labelledby` 指向標題。

```text
dialog.game-settings-dialog.<gameId>-phase-menu
  form.training-config
    header.training-config-header > h2（遊戲名稱）
    div.training-config-body
      section.training-setting > h3 + label > input|select + small.training-setting-description
    footer.config-actions > div.training-config-navigation-buttons
      button.btn.btn-ghost      返回大廳／返回入口（Back to lobby／Back to entry）
      button.btn.btn-primary    確認設定（Confirm settings）
```

- **DOM 順序即視覺順序**：返回在前、確認在後。桌面一列，確認在右；639px 以下直排滿寬，確認在下方（拇指區）。不使用 `row-reverse` 或 `column-reverse`。
- Enter 送出表單即確認；Escape 觸發 `cancel`，等同返回。
- 驗證失敗時，錯誤文字以 `--error` 顯示在欄位下方，焦點移到第一個錯誤欄位。

### 停止按鈕與中斷面板（Stop and Interrupt Panel）
遊玩中有一顆常駐的次要按鈕「停止」（Stop），所有遊戲同一個字。位置在遊戲 HUD 不遮刺激的角落，手機上不小於 44×44px。

按「停止」或 Escape **不直接結束**，而是開啟中斷面板：

```text
div.game-interrupt-panel [role=dialog][aria-modal=true][aria-labelledby]
  h2   已暫停（Paused）
  p    一句話說明結束後的紀錄結果，例如「結束後不會保存這次紀錄。」或「結束後會保存已完成的部分。」
  button.btn.btn-primary   繼續（Continue）     ← 開啟時取得焦點
  button.btn.btn-ghost     結束活動（End activity）
```

- 面板開啟時遊戲停止計時與出題；計時型作業由該遊戲定義暫停期間的試次如何處理（作廢重出或保留），並寫在其 `design/gdd/<gameId>.md` 或遷移文件。
- 面板內 Escape 等同「繼續」；不會因連按兩次 Escape 而結束。
- 「結束活動」才呼叫 `ExitGame()`／返回設定，並退出全螢幕。
- 失去全螢幕或相機、手勢輸入中斷時，同樣開啟這個面板，說明句改寫原因。
- 面板文字的「紀錄結果」必須與實際行為一致；不確定時寫「這次紀錄不會保存」並讓實作符合它。

### 成果畫面（Results Screen）
結論在前、細節在後：

```text
div.experiment-container.results-container
  section.experiment-results [tabindex=-1]   ← 掛載時焦點移到 h1
    header.score-header > h1（當次成果）+ p（遊戲名稱）
    section.score-priority
      p.score-complete     已完成本次活動（Activity complete）
      div.score-key-grid > div.score-key-metric × 1–3   各指標皆透明、無邊框，僅以 24px 間距分隔
    p.score-save-status [role=status]   保存中…／已保存／保存失敗，請重試。／獨立練習，成果未保存至 Hub。
    div.score-actions
      button.btn.btn-ghost.score-retry-button   重試保存（只在失敗時）
      button.btn.btn-primary.score-return-button 返回大廳／返回入口
    details.score-details
      summary   查看詳細資料（View details）
      section.score-context（當次設定）
      section.score-analysis（統計、資料品質、圖表、明細表、分頁）
```

- 主要指標最多三格，桌面三欄，600px 以下單欄橫列。
- `details` 預設收合；展開後的區段順序維持現行（設定、統計、品質、圖表、明細表）。
- **圖表只佔一個 Tab 停點**：SVG 容器 `tabindex=0`，左右鍵移動資料點、以 `aria-live` 讀出數值；資料點本身不可個別 Tab。焦點外框 3px。
- 明細表放在可捲動區域內（`tabindex=0`、有名稱），每頁 50 列，分頁順序「上一頁、頁碼、下一頁」。

## Do's and Don'ts

### Do:
- **Do** 在每款遊戲自己的 `game.css`、`rules.css`、`results.css` 寫出本規格；複製貼上是允許的做法，引用是不允許的。
- **Do** 依遊戲分類填 `--primary` 三個變數，並與 `games/catalog.ts` 的 `trainingThemes` 數值一致。
- **Do** 讓「停止」與 Escape 先開中斷面板，焦點預設落在「繼續」。
- **Do** 在成果畫面最上方顯示完成與保存狀態，再給返回按鈕。
- **Do** 對外文案遵守 `AGENTS.md` 的法規用語（練習、活動、當次紀錄），不宣稱治療、診斷、療效。

### Don't:
- **Don't** 從 `packages/ui`、其他遊戲或任何共用模組 import 這三組元素；遊戲之間不共用 UI 或元素。
- **Don't** 在 `var()` 寫其他色的後備值，也不在元件裡寫死色碼。
- **Don't** 用 `row-reverse`／`column-reverse` 調換按鈕順序，讓視覺與 Tab 順序不一致。
- **Don't** 讓單一點擊或單次 Escape 直接結束活動。
- **Don't** 讓圖表的每個資料點各佔一個 Tab 停點。
- **Don't** 為「停止」換用其他字（停止訓練、停止練習、停止活動），所有遊戲都叫「停止」。

### 待對齊（2026-11-16 盤點，目標版本前的現況）
| 規格 | 現況 | 遊戲 |
| --- | --- | --- |
| 分類主色 | `--primary` 寫死動作藍 `#005eb8` | 53 款（只有 tongue-catch 用口腔紫、exploratory-saccade 用墨灰），其中視覺與認知類應換色 |
| 無過期後備色 | `rules.css` 含 `var(--primary,#146c5b)`、`#0d5547` 等綠色後備 | 共用 `rules.css` 的 49 款 |
| 中斷面板 | Stop／Escape 直接結束 | 除 motor-cortex-rehab、oculomotor-training 外全部；driving-rehab、seagull-flight、ufov 只有自動暫停 |
| 按鈕順序 | `row-reverse`／`column-reverse` | 共用 `rules.css` 的 49 款 |
| 成果順序 | 細節全部展開、保存狀態在最後 | 55 款 |
| 圖表單一停點 | 每個資料點 `tabIndex=0`（每頁最多 50 個） | 有 `ScoreAnalysis.tsx` 的 54 款 |
| 停止字樣 | 停止訓練／停止練習／停止活動 | gabor-patching、moving-card、reading-training、hart-chart（停止訓練）；oculomotor-training（停止練習）；motor-cortex-rehab（停止活動） |
| 變數命名 | 別名 `--accent`、`--bg-card`、`--text-primary` 等 | hart-chart |
| 次要按鈕外框 | 基底按鈕用 `--border` | asteroid-shield、drawing-defense、driving-rehab、gabor-patching、hart-chart、moving-card、oculomotor-training、reading-training |
| 結果頁 H1 | 「訓練成果」，擁有者 2026-11-16 核准改為「當次成果」（Session results） | 46 處 |

改動任何已發布遊戲都要升版本並經擁有者核准精確 version／contentSha256 後發布（見 `AGENTS.md`）。
