# R2 遊戲設定控制項 UI/UX 修正與設定值保存（2026-10-17 候選）

狀態：**本機候選，尚待擁有者逐一核准精確 version／contentSha256 後發布**。未發布 R2、未提交、未推送。擁有者決定兩項需求合併在同一批新版本。

## 1. 設定控制項

擁有者要求檢視已搬遷的八款 R2 遊戲，讓設定控制項符合一般使用者對該資料類型的期待。原則：有名稱的選項用下拉選單並以名稱開頭；有上下限的百分比／秒數用顯示目前值的滑桿；只顯示目前選擇會用到的欄位；需要精確數值的欄位用數字框，確認時才驗證。移動卡片與眼動練習檢視後不需修改控制項。

| 遊戲 | 控制項修正 |
| --- | --- |
| 閱讀訓練 | 文章材料改下拉選單（隨機／第 1–3 篇）；每批片段改 1–5 段滑桿（保存值仍為 100–500） |
| 蓋伯斑塊 | 難度選項以「簡單／中等／困難」開頭，參數保留於括號 |
| 小行星護盾 | 同上 |
| 手勢指令對戰 | 辨認嚴格程度、手勢維持秒數改為顯示數值的滑桿；敵人耐久維持數字框 |
| 手部目標追蹤 | 目標大小、速度改為顯示數值的滑桿 |
| 畫畫塔防 | 「自訂」成為時間選項，選了才出現秒數欄；背景顏色／圖片欄位依背景模式顯示；生命值與自訂秒數不再逐鍵強制改值，確認時以 `reportValidity` 驗證 |

保存的設定欄位、數值範圍、驗證與成績欄位均未改變。

## 2. 設定值保存在本裝置

擁有者要求：每個遊戲的設定值存在該裝置的 `localStorage`，沒有才用預設值，並寫入 R2 遷移計畫（`docs/r2-game-migration-plan.md` 第 5 節「設定值保存在本裝置」、第 7 節設定畫面、第 11 節審查單；`AGENTS.md` 同步一段）。

遊戲在不透明 origin 的沙盒中無法使用 `localStorage`，且不得放寬沙盒，因此由容器保存：

- 共用協定（`packages/ui/src/selfContainedGame.js`）：`IsGameSettings`（與成果 config 同規則）、`AcceptGameSettingsMessage`（只接受宣告 `settings-storage` 的版本）、`ReadSavedGameSettings`／`WriteSavedGameSettings`（key `trainerhub.game-settings/v1:<gameId>`，storage 被封鎖或資料損壞時回傳空值）。
- Hub `R2GameOverlay`：宣告能力時讀取本機保存值放入 `init.settings`，收到 `settings` 訊息時寫入。
- Runner：`settings-storage` 加入能力白名單，限官方 `presentation: "game"`；宣告後獨立入口改用官方啟動頁（無相機時不載入相機程式、不給相機權限），啟動頁在 runner origin 保存並回傳設定，退出時回 `configure`。
- 八款遊戲：`package.json` 宣告 `settings-storage`；bridge 接收 `init.settings`、提供 `OnSavedSettings`／`SaveGameSettings`，非相機遊戲支援 `mode: "standalone"`；新增 `runtime/settingsMemory.ts` 只還原遊戲自己定義的欄位並以遊戲自身驗證檢查，失敗即用預設值；確認設定時回報容器。小行星護盾新增 `ValidateSettings`；畫畫塔防新增 `settings.ts`（無限時間存 0，上傳圖片不保存、記為星空背景）。

### 第三方投稿遊戲

依擁有者要求另做第三方部分：Hub 的 `PackageGameOverlay` 送出設定表單時以 `trainerhub.package-settings/v1:<slug>` 保存，下次以保存值作為表單預設值並用該遊戲 `settings.json` 驗證，不合法就用原預設值（`apps/rehabtrainerhub/app/train/packageSettingsMemory.ts`）。只改 Hub，遊戲與 runner 不變、不需重新發布；未遷移官方遊戲（`TrainingOverlay`、共用 `GameSettingsForm`、`OfficialGameShell`）不改動。TDD：`scripts/check-package-settings-memory.test.mjs` 先 0／3 失敗，實作後 3／3，加入 `test:entrypoints`。七項 CI gate 重跑通過；Hub build 後本機 Brave（模擬第三方遊戲與其 `settings.json`）：首次顯示預設值→改滑桿 8、模式困難並開始→Hub `localStorage` 保存 `{speed:8,mode:"hard"}`→重新開啟顯示保存值→改成超出範圍的保存值後回到預設值。`scripts/check-game-architecture-browser.test.mjs`（含未遷移官方遊戲設定表單）在同一 Hub build 上，整檔執行時分別各有一項計時失敗（成績圖表、導覽寬度），單獨重跑皆通過；這兩項不在 CI，也不涉及本次改動的檔案。

### 部署順序（重要）

舊 runner 不認得 `settings-storage`，會拒絕載入宣告此能力的版本。**必須先部署 Hub 與 runner，再發布這批遊戲。** 新 Hub／runner 對目前已發布的舊版本行為不變（不送也不收設定）。

## 3. 候選版本

| 遊戲 | 版本 | 檔案 | bytes | contentSha256 |
| --- | --- | --- | --- | --- |
| 閱讀訓練 | `2.0.1` | 5 | 1,205,891 | `6beb58a5e70d165b3cf574af9cd22be09d998a929230fbc6feb886a3c53a87c1` |
| 蓋伯斑塊 | `2.0.2` | 5 | 1,158,105 | `780e71823bc5b5f5f229e49b14ad9e1a79a96df3e373da2e88582cdd43681b83` |
| 小行星護盾 | `2.0.10` | 12 | 1,774,371 | `2ef64194e7b99caafda7bba7e7075a10b15d2443c7dfe775ab795d40004538b9` |
| 手勢指令對戰 | `2.0.5` | 5 | 1,139,262 | `3160d162c5621e25e2c22fa8165278be0955b659679188d912704d355b1f5887` |
| 手部目標追蹤 | `2.0.3` | 5 | 615,196 | `a51a7a7045db9dcd167a3fba141b355da160729403f4e1d54637ebed966460c8` |
| 畫畫塔防 | `2.0.7` | 6 | 5,851,373 | `a46e717fc8eac312be1c51c31be032b5eb8738e27d36cc9a5ae67fd2e270a183` |
| 移動卡片 | `2.0.3` | 5 | 1,170,998 | `295a60da488c2d60b33d4659a4009fb7e77af8291c4d3c896ecbc6a43843f912` |
| 眼動練習 | `2.1.2` | 11 | 771,196 | `7e3cc574adb50a12632592cc9fd44921da1ff7c27540448285508d5ef5408f2a` |

先前只含控制項修正的六個 digest 已作廢，不得發布。

## 4. TDD

- 控制項：`scripts/check-r2-settings-controls.test.mjs`（先 0／5 失敗，修正後 5／5）；閱讀訓練下拉選單／片段數斷言加入其 migration test。
- 設定保存：`scripts/check-r2-settings-memory.test.mjs`（先 0／19 失敗，修正後 19／19）與 `apps/usergamerunner/tests/settingsMemory.test.mjs`（先 0／3，修正後 3／3）。
- 既有測試調整：版本與能力釘選（小行星、蓋伯、手部、移動卡片、閱讀）；`check-self-contained-game` 改為「每個設定都是讀取自身 state 的受控輸入」；`check-r2-game-ui` 改為檢查表單呼叫 `confirmSettings` 且其中先 `reportValidity` 再進教學；手部 Brave fixture 改斷言滑桿夾在 75；畫畫塔防 fixture 先選「自訂」再輸入秒數。

## 5. 驗證

- 七項 CI gate 通過（`test:game-architecture` 246、`test:gamerunner` 53、`test:hub-functions` 125）。
- 八款 build 與 dry-run 通過；Hub、runner build 通過；無 `conflicted` 檔案。
- 本機 Brave `--settings-memory`：八款 × Hub／獨立 PWA 共 16 項通過（改設定→確認→容器 `localStorage` 有值、遊戲本身無法存取 storage→重新整理後還原）。
- 本機 Brave 完整流程回歸 17 項通過（非相機遊戲的獨立 PWA 已改走官方啟動頁）：閱讀（桌機、獨立 PWA、英文登入手機）、蓋伯（寬螢幕視窗、獨立手機 medium）、小行星（桌機、獨立手機）、畫畫塔防（桌機含保存失敗重試、獨立 PWA 返回設定）、移動卡片（桌機、獨立 PWA）、手部（桌機、獨立手機，實際 MediaPipe）、手勢（桌機、獨立手機英文，實際 MediaPipe）、眼動（桌機、獨立 PWA）。保存只寫本機 SQLite。
