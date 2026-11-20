# 官方活動標籤與相似度

管理員可在「管理後台 → 相近活動」查看每款官方活動的功能標籤、任務需求、裝置配置及前五個相近活動。標籤以玩家在活動中做的事為依據，供目錄審閱與活動比較。對外文案沿用「練習」、「活動」、「當次紀錄」，只描述玩法與可觀察的表現。

## 理論框架與 ICF

WHO ICF 提供功能與活動代碼。各維度在 `taxonomy.json` 指定一個主要框架，CI 在本機核對 ICF 代碼與雙語名稱。活動標籤描述的是作業需求。

ICF 代碼須出自 WHO ICF 2001 雙語版。採用後續版本新增的代碼時，須另建框架條目並註明版本。來源為王顏和譯《國際機能、失能和健康分類》，衛生署委託「國際健康功能與身心障礙分類系統-兒童與青少年版推動計畫」99M4073。[WHO ICF 2001 雙語版 PDF](https://www.pmr.org.tw/files/papers/ICF.pdf)

足部操作的兩個標籤 `motor.foot_use` 與 `response_modality.foot` 改用 `d4350`（用下肢推動），對應踩踏板的動作。`d446` 未收錄於 2001 版。

| 維度 | 框架 | 引文 | ICF 代碼 |
| --- | --- | --- | --- |
| `attention` | Sohlberg–Mateer Clinical Model of Attention | Sohlberg MM, Mateer CA (1987/2001) clinical model of attention (focused, sustained, selective, alternating, divided). J Clin Exp Neuropsychol 9(2):117-130. | `b140`、`b1400`、`b1401`、`b1402` |
| `executive` | Miyake Unity and Diversity of Executive Functions | Miyake A, et al. (2000) unity and diversity of executive functions. Cognitive Psychology 41:49-100. | `b1440`、`b164`、`b1643` |
| `higher_cognition` | WHO International Classification of Functioning, Disability and Health | WHO ICF 2001 雙語版 | `b1641`、`b1646` |
| `working_memory` | Baddeley Model of Working Memory | Baddeley A (2000) the episodic buffer: a new component of working memory? Trends Cogn Sci 4(11):417-423. | `b1440` |
| `processing_speed` | Cattell–Horn–Carroll Theory of Cognitive Abilities | Schneider WJ, McGrew KS (2018) The Cattell-Horn-Carroll theory of cognitive abilities. In Contemporary Intellectual Assessment (4th ed.). | `b147`、`b1470` |
| `quantitative` | Cattell–Horn–Carroll Theory of Cognitive Abilities | Schneider WJ, McGrew KS (2018) The Cattell-Horn-Carroll theory of cognitive abilities. In Contemporary Intellectual Assessment (4th ed.). | `b172` |
| `time` | WHO International Classification of Functioning, Disability and Health | WHO ICF 2001 雙語版 | `b1802` |
| `visual_perception` | Warren Visual Perceptual Hierarchy | Warren M (1993) A hierarchical model for evaluation and treatment of visual perceptual dysfunction in adult acquired brain injury. Am J Occup Ther 47(1):42-54. | `b144`、`b1561`、`b1565`、`b2101`、`b21022`、`b215`、`b2152` |
| `motor` | WHO International Classification of Functioning, Disability and Health | WHO ICF 2001 雙語版 | `b760`、`b7602`、`d4350`、`d440`、`d445`、`d4452` |
| `language` | Western Aphasia Battery-Revised (WAB-R) | Kertesz A (2006) Western Aphasia Battery-Revised (language modalities). | `b16700`、`b16701`、`b16710`、`b16711` |
| `speech_motor` | WHO International Classification of Functioning, Disability and Health | WHO ICF 2001 雙語版 | `b310`、`b320` |
| `oral_swallowing` | Logemann Swallowing Phases | Logemann JA (1998) Evaluation and Treatment of Swallowing Disorders (2nd ed.) (oral preparatory, oral, pharyngeal, esophageal phases). | `b5102`、`b5103`、`b51050`、`b51051` |
| `environment` | Gentile Taxonomy of Motor Skills | Gentile AM (2000) Skill acquisition: action, movement, and neuromotor processes. In Movement Science: Foundations for Physical Therapy in Rehabilitation (2nd ed.). | 無 |
| `intertrial_variability` | Gentile Taxonomy of Motor Skills | Gentile AM (2000) Skill acquisition: action, movement, and neuromotor processes. In Movement Science: Foundations for Physical Therapy in Rehabilitation (2nd ed.). | 無 |
| `pacing` | Schmidt and Lee Motor Control and Learning | Schmidt RA, Lee TD (2019) Motor Control and Learning (6th ed.) (self-paced vs externally paced; discrete/serial/continuous). | 無 |
| `movement_continuity` | Schmidt and Lee Motor Control and Learning | Schmidt RA, Lee TD (2019) Motor Control and Learning (6th ed.) (self-paced vs externally paced; discrete/serial/continuous). | 無 |
| `stimulus_modality` | WHO International Classification of Functioning, Disability and Health | WHO ICF 2001 雙語版 | `b1560`、`b1561` |
| `response_modality` | WHO International Classification of Functioning, Disability and Health | WHO ICF 2001 雙語版 | `b215`、`b310`、`b5103`、`b760`、`d4350`、`d440`、`d445` |
| `reaction_type` | Donders Reaction Types | Donders FC (1868/1969) On the speed of mental processes. Acta Psychologica 30:412-431 (a-, b-, c-reactions). | 無 |

眼球動作子系統補充採 Leigh RJ, Zee DS (2015) The Neurology of Eye Movements (5th ed.) (saccade / smooth pursuit / fixation subsystems)。反應作業類型中的連續追蹤、回憶重現與自訂節奏的問題解決借用 Schmidt 與 Lee 的動作類型與作答節奏概念。口顏動作與吞嚥階段各自獨立標註，無食團的動作只標對應的口顏動作。

## 標註與相似度

- `2` 是核心需求，`1` 是次要要求或部分模式，`0` 是審閱後確認未涉及。功能標籤省略時顯示「尚未標註」。
- 每款活動只直接標註啟用的葉標籤。父標籤取已知子標籤中的最高值。子標籤都缺值時，父標籤也缺值。每個等級為 `2` 的功能葉標籤都要寫一則繁中玩家行為描述。
- 任務需求的所有啟用葉標籤都要填 `0`、`1` 或 `2`。單選維度以主要玩法為準，恰好一項填 `2`，其餘填 `0`。以實際作答是否受遊戲的時機或限時制約來分節奏。整局的計時紀錄、背景音樂及只在作答後出現的回饋音不列為作答線索。
- `supportedSetups` 的配置可任選一種，每種配置須具備其 `allCapabilities` 中的全部能力。例如「有球必應」從相機或麥克風辨識同一類拍擊動作。眼動練習的 WebGazer 配置仍搭配滑鼠或觸控。
- 功能與任務需求分別以共同標註項目的餘弦相似度乘上覆蓋率。覆蓋率是共同標註的等級平方和除以雙方全部已標註的等級平方和。共同項目有一方的向量長度為零時，該群組分數為 `null`。平方和分母為零時，覆蓋率為 `null`。
- 總分以固定權重計算，功能為 0.7，任務需求為 0.3。缺分數的群組對總分貢獻為 0。只有任務需求可比較時，總分上限為 0.3。兩群組都缺分數時不列為相近活動。共同標籤取雙方功能等級都至少為 `1` 的葉標籤與衍生父標籤。同分按活動 ID 排序。

## CI 規則

| 規則 | 檢查 |
| --- | --- |
| R01 | 字典版本符合語意化版本格式，活動資料引用同一版本，且 `schemaVersion` 為 `2`。 |
| R02 | 框架資料包含唯一 ID、名稱與引文，每個維度都引用已登記的框架。 |
| R03 | 維度的群組、選擇方式和必填設定有效，標籤有唯一且以所屬維度加句點開頭的 ID。 |
| R04 | 每個功能標籤都引用字典收錄的 ICF 代碼。任務需求若附代碼，也須收錄於字典。收錄的代碼須有英文與繁體中文名稱，並有標籤引用。 |
| R05 | 父標籤與子標籤屬於同一維度，父子鏈不得循環。 |
| R06 | 標籤名稱和定義以及維度與能力名稱都有繁中與英文。 |
| R07 | 標籤名稱和定義以及維度與能力名稱不含中英文的醫療廣告限制用詞。 |
| R08 | 停用標籤必須指定同維度的啟用替代標籤。 |
| R10 | 活動 ID 與官方目錄一一對應。 |
| R11 | 活動使用正確群組的啟用葉標籤，等級限定為 `0`、`1` 或 `2`。 |
| R12 | 每個必填任務需求維度的啟用葉標籤都有有效等級。 |
| R13 | 單選維度恰有一個 `2`，其餘為 `0`。 |
| R14 | 每個活動至少有一個等級為 `2` 的功能標籤。 |
| R15 | 每個等級為 `2` 的功能標籤都有中文行為依據，其他標籤不填依據。 |
| R16 | 每種正向反應方式都有相容的配置。配置使用的每個能力都能對應正向反應方式或字典標明的輔助能力。 |
| R17 | 相機、麥克風、替代配置與官方目錄權限一致。 |
| R18 | 審閱狀態為 `draft` 或 `confirmed`。 |

## 產物與執行方式

`npm run recommendation:build` 依序載入並驗證字典、比對官方目錄和活動資料、推導標籤等級、計算兩兩相似度與前五名、寫入 `generated/featureIndex.json`。摘要列出活動數、草稿／確認數，以及每個維度已標註葉標籤數和可標註總數。產物使用排序後的鍵、四位小數精度、LF 與檔尾換行。輸入 SHA-256 涵蓋字典、活動資料、目錄 ID／權限及計分版本，以排序鍵的 JSON 計算。

`npm run test:recommendation` 執行相同管線的 `--check`，逐位元組比較產物，再跑規則、相似度、管線及管理介面測試。若用規則編號回報錯誤，先改來源資料。若產物過期，執行 `npm run recommendation:build` 後再驗證。本機 `test:ci`、PR 與正式部署的共用 CI 都會執行這項 gate。

新增官方活動後，若目錄和流程清單已登記但缺少標籤條目，管線會回報 `[R10]` 並使 CI 失敗。若條目缺少主要功能標籤，會回報 `[R14]`。管理介面測試載入實際執行時的目錄並渲染選單，逐一比對選項、管線目錄和標籤資料的活動 ID，也逐款檢查主要標籤的行為依據。每款活動須在選單的分類中恰好出現一次。

## 新增活動或修改字典

1. 對照官方目錄、`public/game.json`、GDD 和實際流程，選擇字典現有的標籤。
2. 在 `gameFeatures.json` 新增 `draft` 條目。補齊任務需求、裝置配置和每個主要功能的中文行為依據。擁有者審閱後改成 `confirmed`，需要重審時改回 `draft`。
3. 執行 `npm run recommendation:build` 與 `npm run test:recommendation`，一併交付來源資料和產物。

建議新增標籤時，先確認現有標籤的定義無法涵蓋，再提供可觀察的行為、中英文定義、所屬框架引文和 ICF 對應。任務需求若無合適的 ICF 對應，記錄理由。新增標籤升字典次版本，重新命名或移除升主要版本。停用時保留舊 ID，建立 `replacementTagId`，並遷移活動資料。兩份 JSON 的 `taxonomyVersion` 同步更新。變更權重、缺值處理或計分方式時更新 `featureSpaceVersion`。

## 標籤審閱重點

擁有者已確認現有 56 款官方活動的標籤。新增活動依上述流程以 `draft` 開始。

- `oculomotor-training`、`hart-chart`、`hex-schulte`、`antisaccade`、`exploratory-saccade`、`ufov` 的眼動或周邊視野標籤有些取自玩家所見的指示與畫面設計。眼動練習僅在啟用 WebGazer 時記錄眼動，其餘這些作業的作答資料無法直接確認凝視位置或掃視軌跡。
- `digit-span`、`n-back`、`letter-memory`、`keep-track` 的語音迴路依可念出的刺激及短暫保留需求標註。實際使用的記憶策略由玩家決定。
- `moving-card` 的排列有靜止與旋轉模式，單選環境採預設排列。 `time-perception` 的按住模式持續用力，估計與比較模式採單次作答。 `seagull-flight` 的頭頸動作只適用相機模式。 `driving-rehab` 的足部操作只適用實體踏板配置。
- `every-ball-response` 的拍手與拍腿歸入手與手臂使用。麥克風辨識拍擊聲。按鈕及鍵盤是啟用感測器之後的替代作答方式，啟動配置仍需相機或麥克風。

## 里程碑

第一階段提供字典、活動資料、相似度與管理員審閱。第二階段在訓練大廳加入活動推薦，訪客使用本機活動紀錄。第三階段加入公開的二維活動地圖。

## 本機介面驗收

執行 `npm run build:hub` 後，執行 `node scripts/check-admin-similarity-browser.mjs`。腳本透過本機 Brave 讀取靜態輸出，以模擬管理員及 API 回應開啟 `/admin/`。在 360 × 740 的觸控模擬及 1280 × 800 的桌面視窗，以鍵盤切換頁籤及活動，再點選相近活動，檢查選項、焦點、控制項尺寸、橫向溢出與驗證狀態。兩種視窗都使用減少動態設定，截圖路徑會印在終端機。可用 `BRAVE_BIN` 指定 Brave 路徑，或用 `npm run test:uiux-browser` 執行整套本機瀏覽器驗收。

功能與任務需求的維度、框架、代碼及缺值可在管理頁逐項複核。管理員、已授權人員（`therapist`）及訪客的頁籤顯示權限由 `test:recommendation` 驗證。實體裝置及外部帳號需另行驗收。
