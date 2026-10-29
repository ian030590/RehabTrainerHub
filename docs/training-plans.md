# 練習清單後端與操作畫面

這個功能讓管理員或獲指派的工作人員，替指定玩家建立一份練習清單，包含遊戲、每週次數與設定。玩家依清單完成活動後累計本週進度。後端、工作人員分頁、玩家大廳區塊與遊戲設定串接均已實作。開關預設關閉；2026-10-29 擁有者決定在正式站開啟。

## 功能開關與啟用前提

`TRAINING_PLANS_ENABLED` 只有字串 `'1'` 才會啟用。未設定、`'0'`、`'true'` 都停用。正式站的值來自 GitHub repo variable `TRAINING_PLANS_ENABLED`（2026-10-29 設為 `1`）：Workers 部署步驟把它傳給 `scripts/deploy-cloudflare-workers.mjs`，由 `CreateHubWorkerSecrets` 以 `0`／`1` 寫入 Hub Worker 執行期設定。改值後要重新部署才生效。Pages 備援流程不傳這個開關。

停用時，以下清單 API（包含 OPTIONS）一律回應 HTTP 404：

```json
{ "error": "Training plans are not enabled." }
```

既有遊戲啟動與紀錄保存維持可用，忽略 `planItemId`、`planFollowed`，不讀寫清單表、不回傳 `planSettings`、不在新 token 加入清單欄位。

依 `AGENTS.md`，個別化使用在正式提供前，須先取得台灣醫療／醫材法規專業意見。2026-10-29 擁有者決定在正式站開啟；這個決定不代表已完成法規審查。`0015_account_subject_ids.sql`、`0016_training_plans.sql` 會在 `main` 部署時由 `scripts/deploy-cloudflare-workers.mjs` 自動套用（已套用者不重跑）；建表不會開啟功能。要關閉時把 repo variable 改成 `0`（`gh variable set TRAINING_PLANS_ENABLED --body 0`）再重新部署。runner 不需要此開關或資料庫 binding。

測試環境也只有明確設定該字串才啟用。移除開關或改成 `'0'` 會立即停用後續 API、啟動綁定與進度累計，保留已存在的清單和進度資料。部署命令與正式環境操作由擁有者另行執行。

## 資料與週進度

| 資料表 | 用途與約束 |
| --- | --- |
| `training_plans` | 玩家、建立者、標題（1 至 60 字元）、備註（最多 300 字元）、狀態及時間。partial unique index 保證每人最多一份 active 清單；刪除玩家會連帶刪除，刪除建立者則將建立者欄位設為 NULL。 |
| `training_plan_items` | 每份 1 至 12 個項目；遊戲限可信 `officialGameReleases`，同份不得重複，每週目標為整數 1 至 14。排序 0 至 11 且唯一，設定存 JSON 或 NULL。最少一項由 API 驗證，清單與所有項目在同一 transaction 建立。 |
| `training_plan_completions` | 以紀錄 ID 為主鍵，記下清單、項目、玩家、週起始日期及保存時間。 |
| `training_plan_weeks` | 每位玩家每週最多一筆達成紀錄，保留達成時的清單 ID。 |
| `user_titles` | 每位玩家每種稱號最多一筆，目前僅 `six-week-streak`。 |

週界線採 `REHAB_TIME_ZONE`，未設定則為 `Asia/Taipei`。週一 00:00 起至下週一 00:00 前為一週；回應的 `week.end` 是週日日期（含當日）。紀錄週別使用既有紀錄流程算出的 `verifiedTrainingDate`，來源為官方 session 的簽署 `iat`，不使用客戶端日期或上傳當下日期。

只有清單內所有項目都達到各自當週目標，才新增達成週。連續六個日曆週達成後，一次性授予 `six-week-streak`：繁中「六週全勤」，英文「Six-week streak」。本週達成即計入連續週數；本週尚未達成時沿用上週的連續週數，任何未達成的過去週都中斷。跨清單仍依玩家的已達成週計算。

更換清單不搬移舊項目的完成次數。當週新清單的 `week.achieved` 依新項目計算；若同週舊清單已達成，既有達成週、連續週與稱號保留，同週不會再新增第二筆達成週。

設定直接使用 `IsGameSettings`，與遊戲的 `settings` port 訊息相同：最多 64 個欄位，key 須符合 `/^[a-z][A-Za-z0-9_]{0,63}$/` 且不得含敏感名稱；value 僅接受 boolean、絕對值不超過 1e9 的有限數字，或 1 至 80 字元且無控制字元的字串。巢狀物件、陣列與欄位值 NULL 不接受；整份設定可為 NULL 或空物件。不額外推論個別遊戲支援的參數值。建立清單的請求上限為 256 KiB，涵蓋十二份完整的多位元組設定。

## 工作人員 API

使用既有 `GetAuthenticatedUser` cookie session 與同源檢查，限 admin、therapist。admin 可存取所有 `patient`；therapist 僅可存取 `therapist_patient_assignments` 中的玩家。玩家回應 403，未登入回應 401。一般 bearer 不取代 cookie；若日後另外啟用既有 `ADMIN_ALLOW_BEARER`，則沿用該 helper 的明確設定。回應採 `no-store`。

### GET `/api/admin/training-plans?patientId=<id>`

```json
{
  "plan": null,
  "archivedPlans": [
    { "id": "list-id", "title": "上週清單", "createdAt": "ISO timestamp", "archivedAt": "ISO timestamp" }
  ]
}
```

有 active 清單時，`plan` 格式與下列玩家 API 相同。`archivedPlans` 只含該玩家最近十份封存清單，依封存時間由新到舊排列。

### POST `/api/admin/training-plans`

```json
{
  "patientId": "player-account-id",
  "title": "本週練習",
  "note": "依清單進行活動",
  "items": [
    { "gameId": "motor-cortex-rehab", "weeklyTarget": 3, "settings": null }
  ]
}
```

`note` 可省略，預設空字串；其餘欄位必填。HTTP 201 回傳 `{ "plan": { ... } }`。舊 active 清單封存、新清單與項目建立、`training-plan.create` 稽核事件在同一個 D1 batch。任一寫入失敗全部回滾。驗證錯誤為 400，無權存取為 403，admin 指定不存在或非 patient 的帳號為 404。

### POST `/api/admin/training-plans/<planId>/archive`

不需要 body 欄位。封存前再次確認角色、玩家存取權與 active 狀態，將封存與 `training-plan.archive` 稽核放在同一 batch。成功 HTTP 200 `{ "ok": true }`，不存在或已封存為 404。稽核只存玩家 ID、清單 ID、項目數等必要資訊，不複製備註或設定。

## 玩家 API

### GET `/api/training-plans/current`

使用 bearer `RequireSession`，只讀 session 帳號，任何 `patientId` 查詢值都不改變讀取對象。未登入為 401。沒有 active 清單回傳 `{ "plan": null }`。有清單時：

```json
{
  "plan": {
    "id": "list-id",
    "title": "本週練習",
    "note": "依清單進行活動",
    "status": "active",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "assignedBy": "工作人員顯示名稱",
    "items": [
      { "id": "item-id", "gameId": "motor-cortex-rehab", "weeklyTarget": 3, "settings": null, "completedThisWeek": 1 }
    ],
    "week": { "start": "2026-10-26", "end": "2026-11-01", "achieved": false },
    "achievedWeeks": 2,
    "currentStreak": 2,
    "weeksToTitle": 4,
    "titles": []
  }
}
```

`assignedBy` 僅為 `display_name`，無名稱或建立者已不存在時為 NULL，不以 email 代替。回應不含玩家或建立者的帳號 ID、email、Subject ID。完成次數可超過目標；`weeksToTitle` 為距六週的週數，已獲稱號固定 0。稱號格式為 `{ "id": "six-week-streak", "awardedAt": "ISO timestamp" }`，雙語顯示名稱由介面依上述對照呈現。

## 啟動與紀錄串接

1. `POST /api/official-game-sessions` 的原請求可加 `planItemId`。啟用時限登入者自己的 active 清單，且 gameId 必須相符；無效為 400。成功時簽署 token 加入 `planItemId`，原回應另加 `planSettings`（object 或 NULL）。未帶 `planItemId` 時 token、回應與原流程相同。
2. 容器讀取 `planSettings`，套用遊戲設定並依遊戲確認的 `settings` 訊息判斷是否照清單進行。成果 `config` 較小，後端不使用它比對設定。
3. `POST /api/records` 可在最上層加入 boolean `planFollowed`。只有已驗證 token 含項目 ID、`planFollowed === true`、項目仍屬本人 active 清單且 gameId 相符時才記次。遊戲成績與此欄位皆是客戶端回報，不宣稱伺服器重算或提供防作弊保證。
4. 先保存原訓練紀錄與既有 CSV，再於另一個 batch 記次、檢查全項目目標、授予達成週及稱號。進度寫入出錯只記錄伺服器錯誤，紀錄仍回應成功。完成紀錄以 record ID 防重，既有紀錄的重送不再執行清單記次，也不能把原先 false／省略的欄位升級為一次完成。

若進度 batch 失敗，重送原紀錄不會補記進度；本次不新增補登 API。需由維運依錯誤紀錄另行處理。重新啟用開關也不回補停用期間的活動。

## 驗證

### 操作畫面

工作人員登入後，後台會探測清單 API。停用時只顯示「練習清單尚未開放」，不顯示分頁或表單；啟用後，管理員與已授權人員可在「練習清單」分頁，從既有可管理玩家名單選擇玩家，查看目前清單、本週進度、達成週數、連續週數及稱號。沒有玩家時顯示空白狀態，已授權人員另看到管理員指派玩家的說明。建立新清單前會說明舊清單將封存；手動封存另須確認。

新增清單可使用預設參數，或點「在遊戲中設定參數」開啟原遊戲設定畫面。容器的擷取模式在私有通道收到符合既有規則的 `settings` 訊息後，帶回參數並關閉，不寫入裝置設定記憶，也不保存活動紀錄或 CSV。畫面上方的獨立說明列提示按下遊戲的開始按鈕，與 iframe 各占自己的空間。

登入玩家的大廳標題下方、篩選與結果上方，顯示目前指派的清單。訪客、工作人員、停用或沒有清單時不顯示；請求中的載入訊息與錯誤重試只顯示於登入玩家。日期區間、次數、達成週、連續週、距稱號週數與稱號皆取自 API。

清單啟動透過原有 overlay 傳入 `planItemId`，以 session 回傳的 `planSettings` 優先初始化遊戲；NULL 或缺少時沿用裝置記憶。容器以最後一份有效 `settings` 訊息逐欄比對，將 `planFollowed` 隨成果送出；沒有自訂參數時為 true。清單模式不覆寫裝置記憶。保存成功後更新大廳進度，保留成果畫面供玩家查看。一般啟動仍保留原設定記憶、感測器代理、CSV、成果檔案及重試流程。

介面專項：`node --test scripts/check-practice-plans.test.mjs`，納入既有 `test:entrypoints`。本機瀏覽器點擊驗收由主代理另行執行，尚不能視為已完成手機、實體裝置或正式站驗收。人工步驟：在啟用的本機環境分別用工作人員與玩家帳號，建立清單、擷取與重設參數、確認封存；在 360px 與鍵盤操作下檢查焦點、Escape 關閉、清單啟動、保存後進度更新與成果畫面保留；停用開關後確認玩家區塊消失、後台只留未開放說明。

專項測試：`node --test apps/rehabtrainerhub/functions/api/training-plans.test.mjs`。使用 `node:sqlite` 依序套用所有實際 migrations（含 0015、0016），測試停用、角色權限、輸入邊界、原子更換、封存、session 綁定、冪等保存、時區週界線、所有項目目標、六週與中斷、回應隱私及記次失敗時保留紀錄／CSV。

後端交付執行 `npm run test:hub-functions`、`npm run test:naming`、`npm run test:cloudflare-deploy`，並對異動的 function 檔案執行 `node --check`。介面交付另執行 `npm run test:entrypoints`、`npm run test:game-architecture` 與 `npm run build:hub`。這些都是本機驗證，不執行正式環境操作。瀏覽器點擊與實際部署驗收另行處理。
