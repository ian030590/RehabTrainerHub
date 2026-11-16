---
name: 居家訓練網
description: 居家訓練工具與衛教資訊 Hub：墨灰中性介面，四個分類色標示練習類別，扁平分組、大字級、大觸控區。
colors:
  primary: "#262626"
  primary-hover: "#0a0a0a"
  primary-soft: "#eaeaea"
  heading: "#171717"
  text-muted: "#525252"
  background: "#f5f7f6"
  surface: "#ffffff"
  surface-muted: "#edf2ef"
  surface-strong: "#e2e6ea"
  border: "#d7dfda"
  border-strong: "#7d868e"
  focus: "#1d6fd1"
  overlay: "rgba(20, 24, 28, 0.54)"
  category-movement: "#005eb8"
  category-movement-dark: "#00478d"
  category-vision: "#006c47"
  category-vision-dark: "#005235"
  category-cognition: "#7a4a24"
  category-cognition-dark: "#5a3519"
  category-oral: "#6750a4"
  category-oral-dark: "#4f378b"
  success: "#16734f"
  success-soft: "#dff3e9"
  warning: "#8c5d00"
  error: "#b3261e"
  gold: "#a66d00"
  gold-soft: "#fff1c7"
  accent-blue: "#245da8"
  accent-blue-soft: "#e8f0fb"
typography:
  display:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, Microsoft JhengHei UI, Arial, sans-serif"
    fontSize: "2.8125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, Microsoft JhengHei UI, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, Microsoft JhengHei UI, Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, Microsoft JhengHei UI, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, Microsoft JhengHei UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-card-action:
    backgroundColor: "{colors.category-movement}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  button-card-action-hover:
    backgroundColor: "{colors.category-movement-dark}"
  button-card-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.primary-soft}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 56px 12px 48px"
    height: "56px"
  nav-link:
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  nav-link-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
  chip-filter-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  tag-category:
    textColor: "{colors.heading}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card-game:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  pagination-current:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    size: "44px"
---

# Design System: 居家訓練網

本檔描述 Hub（`apps/rehabtrainerhub`，`trainerhub.cc`）的視覺系統，token 以 `apps/rehabtrainerhub/app/globals.css` 為唯一來源。各遊戲的 canvas、runtime 與遊戲內畫面屬於各遊戲自己；每款遊戲都有的設定對話框、成果畫面與停止中斷面板另見 `apps/rehabtrainerhub/games/DESIGN.md`（各遊戲自行實作的共同規格）；`packages/ui/src/trainerTheme.ts` 是遊戲 runtime 與 PixiJS 用的舊 trainer token，不作為 Hub 頁面的色彩來源。上方 frontmatter 是規範值，下文只說明用途，不重寫數值。

這是以手機與平板為優先的原創 Hub 規格。互動模式參照 [design-ai 專案的 Instagram 規格](https://github.com/Khalidabdi1/design-ai/blob/c46449573bafa883484dcfcfd5499eec39725554/design-md/instagram/DESIGN.md)、[X 規格](https://github.com/Khalidabdi1/design-ai/blob/c46449573bafa883484dcfcfd5499eec39725554/design-md/x/DESIGN.md)、[Threads 規格](https://github.com/Khalidabdi1/design-ai/blob/c46449573bafa883484dcfcfd5499eec39725554/design-md/threads/DESIGN.md)（commit `c46449573bafa883484dcfcfd5499eec39725554`）。這三份是參照倉庫的描述，不是社群產品官方發布的設計系統；本站不複製其視覺資產。另可查核 [Meta 對 Threads 網頁單欄／多欄瀏覽的說明](https://about.fb.com/news/2025/04/new-features-threads-web-experience/)。

## Overview

**Creative North Star: "標示清楚的工具箱（The Labelled Toolbox）"**

Hub 是一個整理好的工具箱：箱子本身是墨灰與白色，安靜、可信、易讀；顏色只出現在「這件工具屬於哪一類」的標示上。使用者打開大廳，先看到標題、搜尋與分類，再看到一排排以預覽圖為主的遊戲卡；分類色告訴他這是動作、視覺、認知還是口腔練習，墨灰色告訴他哪裡可以操作。練習內容和操作永遠比裝飾醒目。

密度依頁面目的調整：大廳是可掃描的工具目錄，進度頁是資訊層級清楚的紀錄，衛教與關於頁是單欄閱讀。介面面向居家使用者與年長讀者，字級在程式中已整體放大 1.25 倍，觸控區至少 44px。圖片優先瀏覽取自 Instagram、明確導覽與搜尋取自 X、單欄閱讀節奏取自 Threads；不把任何頁面做成社群時間線。

保留「居家訓練網」標誌、既有遊戲素材與分類色。

Dial: ENERGY 1 / RHYTHM 1 / MOTION 2。安靜不喧嘩；大廳的卡片網格刻意一致，讓使用者只比較內容；動態只用在幫助辨認來源與去向的轉場。

| 參照模式 | 本站取用 | 本站不取用 |
| --- | --- | --- |
| Instagram：媒體突出、底部分頁、少量介面裝飾 | 既有遊戲預覽圖、手機四目的地底部分頁、清楚卡片操作 | 品牌漸層、Story ring、貼文動作、圖示獨佔的導覽 |
| X：搜尋、即時回饋、可掃描的資訊層級 | 即時搜尋結果、明確當前路由、精簡狀態訊息 | 黑底／藍色品牌、即時社群時間線、趨勢與推薦側欄 |
| Threads：單欄閱讀、細分隔線、輕量層次 | 手機／平板閱讀節奏、衛教行長、平面列表 | 回覆連接線、追蹤／按讚／轉發、固定 640px 的所有頁面 |

**Key Characteristics:**
- 墨灰中性介面，唯一的色彩來源是四個練習分類。
- 遊戲預覽圖是卡片的視覺重心，16:9 一致比例。
- 扁平分組：1px 邊線、表面明度差與留白；陰影只給浮在內容上的層。
- 大字級（內文 16px／500、H1 45px）與至少 44px 的觸控區。
- 轉場只說明「從哪裡來、到哪裡去」，不進入遊戲刺激與計分。

## Colors

墨灰與帶極淡灰綠的紙白構成整個介面，四個中高彩度的分類色只負責標示練習類別。

支援 OKLCH 的瀏覽器由 `globals.css` 的 `@supports (color: oklch(0 0 0))` 區塊改用等值 OKLCH；frontmatter 的 hex 是作者原始值與 sRGB fallback。轉換色彩空間不取代對比驗證，主次文字、狀態文字與控制輪廓的對比由測試計算。

### Primary
- **炭墨灰**（`primary`）：內文、一般連結、導覽選取、表單文字。依擁有者要求使用沉穩黑灰色，不使用品牌藍。
- **深墨黑**（`primary-hover`）：連結與控制的 hover／pressed，以及分頁目前頁的實心底。
- **淡墨灰**（`primary-soft`）：導覽目前頁、帳號選單展開、外框按鈕 hover 的底色。
- **標題墨**（`heading`）：H1 到 H3 與卡片標題，比內文再深一階。

### Secondary
每個練習分類一組主色與深色，由遊戲 catalog（`apps/rehabtrainerhub/games/catalog.ts` 的 `trainingThemes`）提供，執行時寫入 `--trainer-color`、`--trainer-color-dark`，並以 `color-mix` 混入 8 到 10% 產生 `--trainer-surface` 淡底。

- **動作藍**（`category-movement`／`-dark`）：上肢、下肢動作類；也是未分類遊戲的預設主題。
- **視覺綠**（`category-vision`／`-dark`）：視覺訓練類。
- **認知棕**（`category-cognition`／`-dark`）：注意力、記憶、高階認知、語言類，淡底混入 10%。
- **口腔紫**（`category-oral`／`-dark`）：口腔訓練類，淡底混入 9%。

分類色只出現在：卡片預覽區淡底、卡片主要按鈕、分類標籤淡底、篩選群組的邊框與勾選色、啟用中的篩選 chip。四色對白字對比皆超過 6:1。

### Tertiary
- **焦點藍**（`focus`）：所有 `:focus-visible` 的 3px 外框，與跳至主要內容連結的邊框。只表達鍵盤焦點，不當作品牌或連結色。
- **狀態色**（`success`、`warning`、`error` 及 `success-soft`）：只表達真實的成功、警示、錯誤，必定搭配文字或圖示。已登入的帳號按鈕以 `success` 小圓點標示。
- **成就金**（`gold`／`gold-soft`）：進度頁的成就與獎盃狀態。
- **資訊藍**（`accent-blue`／`accent-blue-soft`）：進度頁單一統計項目的區分色，用途固定，不擴張。

### Neutral
- **灰綠紙底**（`background`）：頁面底色，帶極淡的綠色調（OKLCH 色相約 165）。
- **白表面**（`surface`）：卡片、頁首、頁尾、篩選面板、輸入框、對話框。
- **淺灰綠面**（`surface-muted`）：提示框、搜尋清除鈕、停用中的分頁鈕、chip hover。
- **冷灰面**（`surface-strong`）：少數需要比淺灰綠面更明顯的分組底。
- **細邊線**（`border`）：卡片、面板、頁首與頁尾分隔。只用於分組，不是控制輪廓。
- **控制輪廓**（`border-strong`）：搜尋框、分頁鈕、篩選 chip 的外框，對白底 3.7:1。
- **輔助文字**（`text-muted`）：說明、計數、卡片簡介、未選導覽。在紙底上 7.26:1。
- **遮罩**（`overlay`）：相機授權與對話框背後的半透明墨色。

### Named Rules
**The Category-Owns-Color Rule.** 只有練習分類能帶來色彩；導覽、一般連結、篩選文字、分頁與表單永遠是墨灰。新增元件若想用色，先問它是否在標示分類。

**The No-Hardcode Rule.** 所有顏色來自 `globals.css` 的 CSS 變數或分類主題變數；元件內不寫色碼。深色按鈕上的白字使用 `--text-on-accent`。

## Typography

**Display Font:** Noto Sans TC（Google Fonts 可變字重 100 到 900），後備 PingFang TC、Microsoft JhengHei、Microsoft JhengHei UI、Arial、sans-serif
**Body Font:** 同上，單一字族
**Icon Font:** Material Symbols Outlined，由本站提供約 10KB 子集（`/fonts/material-symbols-hub.woff2`），字型服務被阻擋時關鍵圖示仍可辨識

**Character:** 單一無襯線字族，以字重與明度建立層級，不靠第二字體製造個性。繁中字形平穩，內文 500 比常見的 400 稍實，讓年長讀者在手機上也讀得清楚。

### Hierarchy
- **Display**（`display`，`--type-display`）：每頁唯一的 H1。大廳 H1 以 `clamp(var(--type-headline), 3.5vw, var(--type-display))` 縮放；手機為 headline 尺寸，可自然換行。
- **Headline**（`headline`，`--type-headline`）：區段 H2，含大廳「所有練習活動」結果標題。
- **Title**（`title`，`--type-title`）：卡片標題、篩選面板標題、指南小標與次區段 H3；H2 語意不因縮為 title 尺寸而改變。
- **Body**（`body`，`--type-body`）：內文、表單、按鈕、品牌中文名。至少 16px；長文每行約 30 到 45 個中文字。強調連結與操作文字用 700 到 800。
- **Label**（`label`，`--type-label`）：分類標籤、篩選計數、手機底部分頁文字、品牌英文副名、頁尾。計數使用 `tabular-nums`。這是全站最小字級。

五個角色在 `globals.css` 的 `:root` 定義為 `--type-*` token；`globals.css` 與 `practicePlans.css` 的每個文字 `font-size` 都取這五個 token，或兩個 token 之間的 `clamp()`（圖示字形的 px 尺寸除外），由 `check-hub-presentation.test.mjs` 檢查。Display 只給每頁的 H1 與進度頁的大數字；開發者頁 H1 以 `clamp(var(--type-headline), 5.6vw, var(--type-display))` 縮放，區段 H2 在各寬度都是 headline。管理後台的表格與欄位說明、開發者頁的程式碼區塊是密集資料，用 label。

`h1` 到 `h3` 一律 700、`letter-spacing: -0.015em`、`text-wrap: wrap`；段落使用 `text-wrap: pretty`。繁中開發者標題依 `:lang(zh)`（涵蓋 `zh-TW`、`zh-Hant-TW`）調整行高與手機字級，保留自然換行。

`training-panel` 維持倉庫要求：H2、H3、P 與有序規則清單，文字字重至少 700，對應設定表單基準放大 1.15 倍，保留可讀行高。

### Named Rules
**The Readable Floor Rule.** 必要資訊不小於 14px，內文、表單、按鈕不小於 16px；不照搬參照文件的 14 到 15px 貼文內文或 11 到 13px 關鍵標籤。必要資料不可只靠圖示或 tooltip 傳達。

**The Semantic Heading Rule.** 每頁一個 H1，區段 H2，卡片與次區段 H3；層級由語意決定，視覺縮放不改變標籤。

## Layout

頁面內容寬上限 1440px（`--page-max`），頁首內距隨視窗計算，讓品牌與操作區對齊內容欄。間距以 4px 為基礎，常用 4、8、12、16、24、32px；桌面頁面兩側 32px，手機 18px（安全區更寬時取安全區）。

手機先呈現當前任務：頁名／說明，然後搜尋、分類、結果，最後是使用指南。平板讓內容留有閱讀寬度並以兩欄利用空間。桌面大廳採 272px 側邊篩選加結果網格；篩選面板 sticky，自身可捲動。導航、搜尋和操作的位置在各頁一致，不為了模仿社群 App 新增發布器、動態牆或推薦欄。

| 區間 | 導覽 | 大廳與內頁 |
| --- | --- | --- |
| 手機：`< 768px` | 頂部品牌與圖示化操作（說明、語言、帳號皆 44px 圓鈕）；固定底部四個有圖示與可見文字的目的地，高度 80px 加 `env(safe-area-inset-bottom)` | 單欄、全寬搜尋、「篩選」按鈕開啟底部 sheet、遊戲卡 600px 以下單欄；主內容留出底部分頁高度 |
| 平板：`768–1023px` | 頂部完整四目的地文字導覽，操作區可換行但不重疊 | 側邊篩選收起，改為結果上方的「篩選」按鈕與底部 sheet（`< 1024px` 皆同）；遊戲卡 2 欄；長文居中並限制行長 |
| 桌面：`≥ 1024px` | 頂部完整導覽與操作區 | 272px 側邊篩選加三欄卡片網格（1180px 以下兩欄）；長文單欄，表單與表格保持可用 |

以 320、390、768、1024、1440px 及 200% 文字縮放檢查。頁面本身不得橫向溢出；只有明確的分類選項區可橫向捲動。底部分頁不得遮住頁尾、表單送出、訓練 overlay 或系統安全區；訓練 runtime 顯示時不以 Hub 導覽遮擋畫面。

指南、頁面介紹與開發者文件使用所在欄位的可用寬度，避免在寬螢幕被固定字元寬度或平衡斷行擠在左側；政策長文維持置中的閱讀欄。共享 layout、auth、設定與結果樣式先在 `packages/ui/src` 查重；Hub 頁面只組合共用元件。

## Elevation & Depth

系統是扁平的。內容之間用 1px 邊線、表面明度差（紙底、白表面、淺灰綠面）與留白分組；遊戲卡、篩選面板、搜尋框在靜止時都沒有陰影。陰影只出現在真正浮在內容上的層：帳號選單、對話框、訓練 overlay 與嵌入訓練頂欄。

### Shadow Vocabulary
- **貼地陰影**（`--shadow-sm`：`0 1px 2px rgba(20, 33, 43, 0.08)`）：嵌入訓練頂欄、關於頁區塊、設定與成績共用元件的輕微分層。
- **浮層陰影**（`--shadow-md`：`0 8px 24px rgba(20, 33, 43, 0.12)`）：浮動面板、共用設定表單、帳號 popover，以及 1024px 以下的篩選底部 sheet（sheet 另有對話框遮罩分層）。

### Named Rules
**The Flat-By-Default Rule.** 靜止的內容不浮起；hover 與焦點以邊框色、底色或外框表達，不以加陰影、放大或漂浮表達。

**The Visible Focus Rule.** 焦點一律 3px `focus` 外框、外距 3px（卡片 4px，並改用分類色）；不可照搬「只換背景而取消 outline」的做法。

## Shapes

形狀語言是「溫和的方」：控制與小容器 8px（`--radius`），提示區塊 12px（`--radius-lg`），遊戲卡與帳號 popover 16px（`--radius-xl`）。膠囊（`--radius-pill`）只用在分類標籤、主題徽章與篩選計數徽章；手機的圖示操作鈕（說明、語言、帳號）是 44px 正圓。子分類標籤與語言旗幟 4px（`--radius-sm`），是最小的圓角。頁首與大廳不寫死 px 圓角。

卡片以 `overflow: hidden` 裁切 16:9 預覽區，預覽圖 `object-fit: contain`，不裁掉遊戲畫面。手機篩選 sheet 只圓上方兩角（`--radius-xl`）。

## Components

元件的感覺是**穩重清楚、手指好按**：標籤永遠可見，每張卡一個實心主要操作，狀態以邊框、字重與底色表達而非裝飾。所有互動都有可見的 hover、focus、pressed、disabled 狀態，pressed 以 `translateY(1px)` 或 0.96 到 0.98 縮放回饋。通用控制的顏色與邊框轉場 180ms ease。

### Buttons
- **Shape:** 8px 圓角（`rounded.md`），高度至少 44px。
- **卡片主要操作**（`button-card-action`）：分類主色實心、白字 700、佔滿操作列剩餘寬度；hover 與卡片 focus-within 時改分類深色。「安裝遊戲」不是第二顆按鈕，而是右側的墨灰文字連結：600、只在文字下加底線（圖示不加）、無底色與邊框、至少 44px 高。
- **外框按鈕**（`button-outline`）：白底、`border` 細邊、墨灰字 600，例如頁首「網站導覽」；hover／focus 時邊框轉墨灰並加淡墨灰底。手機只留圖示並改為 44px 圓鈕，文字改由無障礙名稱提供。
- **文字按鈕**：篩選「清除」、空結果操作；墨灰 700，底線平時透明、hover 顯示。
- **分頁**：44px 方鈕、`border-strong` 外框；目前頁深墨黑實心白字（`pagination-current`）；停用時淺灰綠底、輔助文字色。

### Chips
- **分類標籤**（`tag-category`）：分類淡底、標題墨、膠囊形，只標示類別，不可點按。子分類標籤無底色、4px、輔助文字色。
- **啟用中的篩選 chip**（`chip-filter-active`）：分類淡底、分類深色 1px 邊框、墨灰字、尾端關閉圖示；點按移除該篩選。「清除全部」同尺寸，白底、`border-strong` 邊框、文字加底線。

### Cards / Containers
- **遊戲卡**（`card-game`）：白表面、`border` 細邊、16px 圓角、最小高度 390px。上方 16:9 預覽區以分類淡底襯底，下方 20px 內距依序放分類標籤與主題圖示、H3 名稱、玩法簡介、裝置需求、操作列。官方卡不顯示作者與版本：先說做什麼、需要什麼。
- **裝置需求**：每張卡一行輔助文字色的純文字加圖示（不是 chip）。官方卡取 `moduleFlowManifest` 的 `mediaPermission`，第三方卡由 release capabilities 推得；文案為「不需攝影機」（`check_circle`）或「需要攝影機」「可選用攝影機」「需要攝影機或麥克風」「需要攝影機和麥克風」「需要麥克風」（`info`）。
- **預覽圖替代文字**：「{名稱} 活動畫面」，不重複簡介；卡上主題標誌為裝飾圖，替代文字為空。
- **Hover / Focus:** 邊框混入 44% 分類色；鍵盤進入卡內時整張卡外加 3px 分類色外框。卡片容器不冒充按鈕，實際操作由可聚焦的按鈕或連結完成。
- **第三方卡**：保留審核標示、開發者、版本、「平台試玩」與安裝，另加同一行裝置需求。
- **提示區塊**：淺灰綠面、8px 或 12px 圓角、無邊框，用於指南註記與開始說明。
- **開發者遊戲載入列**：放在卡片網格之後、分頁之前，也就是開發者遊戲會出現的位置；官方活動不受這個請求影響，所以讀取中或失敗時仍留在第一屏。讀取中顯示一行輔助文字色的「正在載入開發者遊戲…」（`role="status"`）。讀取失敗時改為淺灰綠面、1px `border`、8px 圓角的通知：`warning` 色圖示、說明文字與 44px「重新載入」外框按鈕，不用側邊色條或金色底。重試期間通知區保持掛載並取得焦點；重試成功後焦點移到結果標題。
- **練習清單狀態**：已有清單時，重新整理的載入與錯誤（含重試鈕）顯示在收合的 `details` 外，收合時也看得到。

### Inputs / Fields
- **搜尋框**（`input-search`）：56px 高、白底、`border-strong` 外框、左側 16px 處放搜尋圖示、右側 44px 清除鈕（淺灰綠底，8px 圓角）。即時過濾，比對名稱與簡介；第三方卡另比對卡上顯示的開發者。官方卡不顯示作者，所以不以作者比對，避免出現看不出原因的結果。隱藏瀏覽器內建清除鈕，改用自有清除鈕。
- **Focus:** 外框轉墨灰，並有全站 3px 焦點藍外框。
- **篩選選項**：20 到 22px 原生 checkbox，`accent-color` 依分類；整列至少 44px 可點，計數靠右 `tabular-nums`。勾選列以分類淡底與 700 字重標示，不加左側色條或內陰影；分類群組只有 1px 混色邊框與淡底。
- **篩選計數**：依目前搜尋字詞計算（不受已勾選目的影響）。計數為 0 的選項停用、計數改顯示「尚無」、輔助文字色、`not-allowed` 游標；已勾選的選項即使變成 0 仍可取消。分類下所有目的皆為 0 時，分類勾選框一併停用。

### Navigation
- **桌面與平板**：頁首置中的四個圖示加文字連結（訓練大廳 `/`、進度追蹤 `/progress/`、衛教資訊 `/qa/`、下載程式 `/download/`），未選為輔助文字色 700；目前頁淡墨灰底、墨灰字，下緣 3px 墨灰底線由中央展開。以 `aria-current="page"`、字重與底線共同標示。
- **手機**：固定底部四欄，圖示 24px 在上、0.875rem 文字在下；目前頁圖示改為實心（`FILL 1`）。品牌連結回大廳；語言、使用說明、帳號、開發者與管理入口留在頁首操作區，不塞進四分頁。
- **跳至主要內容**：固定於左上，平時移出畫面，獲得焦點時滑入，焦點藍 2px 邊框。

### Account, Dialogs & Overlays
- **帳號選單**：頁首按鈕，登入後顯示頭像與名稱（手機只留頭像）並帶 `success` 小圓點；展開為 16px 圓角白色 popover，可用 Escape 關閉。
- **登入與個人資料視窗**：body portal 的原生 `dialog`，有可達的關閉操作、鍵盤循環、背景隔離與焦點還原。完整告知放在可展開內容，同意勾選與驗證照舊。載入有狀態回饋，取消可中止請求；讀取失敗不得顯示成真實零值，重試應重做失敗操作。
- **訓練 overlay**：全螢幕、透明底的原生 `dialog`，開啟時釋放頁面捲軸槽位。設定只覆蓋大廳，開始後由遊戲 runtime 接管；完成顯示既有分數、圖表、紀錄及返回流程。overlay 開啟時焦點進入內容，關閉後回到原觸發鈕。
- **網站導覽（spotlight tour）**：不再自動開啟。由大廳標題下「第一次使用？」一行的「開始網站導覽」、頁首「網站導覽」或 `/?tour=1`、`/?tour=guide` 開啟；同一行另有「閱讀練習指南」連到頁內指南。5 步依使用順序：搜尋、篩選、第一張活動卡、主要導覽、網站導覽鈕，可「跳過導覽」。樣式來自 `packages/ui/src/tour/toutour.css` 的 `--tt-*` 變數，現在指向 Hub token（`--primary`、`--primary-hover`、`--primary-soft`、`--surface`、`--text`、`--border-strong`、`--radius-lg`、`--bg-overlay`），並保留字面值 fallback；「下一步」按鈕是墨灰實心，不再有獨立的青綠強調色。
- **載入狀態**：40px 圓形轉圈，3px 邊，顏色取分類色（Hub 頁面取墨灰）；遊戲 iframe 準備好後以 320ms 淡入取代載入層。

### Motion
- **路由進場**：260ms、`cubic-bezier(0.2, 0.75, 0.25, 1)`。
- **卡片 stagger**：只用於畫面內新出現的結果；位移 6px、160ms、每張間隔 24ms，最大延遲 96ms，按鈕始終可操作；保留的卡片及畫面外卡片不重播。
- **開啟遊戲的共享元素轉場**：選定卡片與訓練視窗背景採 220ms shared element transition，讓使用者辨認來源與返回位置；具名過場不包含遊戲 iframe。新操作取消舊過場。
- **減少動態**：`prefers-reduced-motion` 或不支援 View Transitions API 時立即完成切換，停止非必要位移與縮放。這些效果不進入遊戲刺激、計時與計分流程。

### Inner Pages
- **進度頁**：統計、每日項目、最近使用、成就、CSV 下載，以及空白與錯誤狀態；患者清單以穩定的精簡列呈現載入、無清單及錯誤狀態，清單晚到時保持收合，由使用者決定展開。
- **衛教與關於頁**：單欄閱讀與可查核來源。下載頁保留平台及裝置說明。
- **開發者與管理頁**：表單、列表、狀態、操作及權限；密集資訊用表格或分隔線，不套遊戲卡。

## Do's and Don'ts

### Do:
- **Do** 讓分類色只標示練習類別（The Category-Owns-Color Rule）；介面其餘部分用 `primary`、`heading`、`text-muted` 三階墨灰。
- **Do** 以遊戲預覽圖作為卡片視覺重心，16:9、`object-fit: contain`，並提供替代文字。
- **Do** 保持內文、表單、按鈕至少 16px，觸控區至少 44 × 44px。
- **Do** 以 1px 邊線、表面明度差與留白分組；陰影只給帳號選單、對話框、訓練 overlay 等浮層。
- **Do** 讓每個焦點都有 3px 可見外框；選取、錯誤與成功同時有文字或形狀輔助。
- **Do** 在手機底部分頁同時顯示圖示與文字，並預留 `env(safe-area-inset-bottom)`。
- **Do** 為每個顯示資料的區塊提供載入、空白與錯誤狀態，與實際資料同步。
- **Do** 以 live region／status 呈現必要更新並避免反覆朗讀；支援減少動態及系統高對比（`forced-colors`）。

### Don't:
- **Don't** 在元件或樣式表內寫死色碼（The No-Hardcode Rule）。`globals.css` 與 `practicePlans.css` 的色碼只存在兩個 `:root` 色票區塊，其他規則用 token 或 token 的 `color-mix()`，由測試檢查。
- **Don't** 讓導覽、一般連結、篩選文字或分頁使用分類色或品牌藍。
- **Don't** 使用 Instagram 漸層、X 品牌藍或黑底、Threads 社群身份元素、圖示獨佔分頁、14 到 15px 正文、三欄時間線、無限捲動、Story／按讚／追蹤／留言／轉發、虛構熱度與個人化推薦。
- **Don't** 新增暗色模式；目前沒有需求，`color-scheme` 固定為 light。
- **Don't** 給靜止的卡片加陰影、漂浮或放大動畫。
- **Don't** 移除 outline 而只換背景作為焦點樣式。
- **Don't** 讓 Hub 的轉場、stagger 或任何動態進入遊戲 iframe、刺激、計時與計分。

## Repository Constraints｜倉庫規範（非視覺，保留）

以下條目不是視覺 token，保留於此供 UI 實作時對照；權威來源為 `AGENTS.md`，兩者衝突時以 `AGENTS.md` 為準。

**功能與安全不變**：保留所有既有路由、繁體中文預渲染、SEO metadata、canonical、PWA、語言、帳號、進度、下載、官方及第三方遊戲流程。Hub 不複製 trainer 設定或 runtime；遊戲 renderer、canvas 和生命週期不移入 Hub 或共用 shell。第三方遊戲仍在獨立網域，以既有嚴格 iframe sandbox、CSP、MessageChannel、nonce／sequence、一次性 run token 及人工審核運作；UI 不增加私密資料存取或降低權限檢查。不新增追蹤資料或外連。

**文案邊界**：品牌固定「居家訓練網」，定位「居家訓練工具與衛教資訊」。使用「練習」、「活動」、「當次紀錄」、「刺激參數」、「換算參考值」等中性用語；不加入診斷、治療、醫療服務、改善功能或保證成效宣稱。專業資格及作者資訊依 `AGENTS.md` 已查核內容呈現。任何可見文案同時檢查繁中／英文、SEO 與台灣醫療文案限制。

**實作入口**：先查 `apps/rehabtrainerhub/app/HubNavigation.tsx`、`TrainingLobby.tsx`、`globals.css`、`hubMotion.css` 及 `packages/ui/src/components` 的共用 shell。沿用現有 token、圖示、圖片與資料，不自行生成社群假資料或新功能。

**驗收**：依 `AGENTS.md` 的 TDD 原則，先寫會因待完成行為而失敗的測試，再做使其通過的最小修改。至少驗收：

1. 四個路由在三區間可達、有當前頁標示；手機文字標籤、底部安全區、帳號及語言可用。
2. 搜尋、分類複選、計數、清除、空結果一致；兩類遊戲卡的開始／試玩及安裝連結可用。
3. 訓練設定保持大廳背景；開始、完成、退出、記錄及返回流程與原功能一致。
4. 進度、衛教、下載、開發者、管理、登入與 PWA 均保留既有資料、權限及錯誤狀態。
5. 五個檢查寬度、200% 縮放、鍵盤、觸控、高對比及減少動態均可操作，無頁面級橫向溢出。
6. UI 變更後執行相關 `test:entrypoints`、`test:training-flow`、`test:game-architecture`、`build:hub`、`test:seo`、`test:pwa`；若涉及 Cloudflare 或第三方沙盒流程，再跑其對應 gate。
