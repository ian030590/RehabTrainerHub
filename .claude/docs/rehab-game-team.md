# RehabTrainerHub 遊戲團隊

本倉庫的 [AGENTS.md](../../AGENTS.md) 優先於 [CLAUDE.md](../../CLAUDE.md)，
兩者都優先於 CCGS 技能、角色、模式及本文件。TDD、main 分支政策、推送前七項
gate、R2 精確版本核准與安全契約不因 workflow、review 或 automation 模式而豁免。
既有任務授權持續有效，已授權的檔案變更不重複詢問。

## 安裝與執行

目前安裝 35 個角色、74 個技能，完整名單見 [agent-roster.md](agent-roster.md)。
領導與統籌為 creative-director、technical-director、producer；設計、程式、美術、
音訊、敘事、QA、發布、在地化及營運角色按該名單選用。
唯一引擎專家為 [web-game-specialist](../agents/web-game-specialist.md)，
`engine.name: web` 的 code／shader／ui 路由都使用它；Godot／Unity／Unreal
及其專家未安裝，不可呼叫缺少的角色。

Claude 負責規劃、向使用者提問、審查及最後驗證，成員以 Codex workers 執行。
機制、完整 brief、sandbox、平行執行及寫入後檢查只在
[codex-workers.md](codex-workers.md) 定義。worker 不能提問、啟動其他角色、
接收 SendMessage 或恢復執行；問題與所需專家的名稱／問題回報 Claude。
修正時將前次結果與更正放入新 brief 重跑。

Codex 主會話從 `.agents/skills/<name>/SKILL.md` 使用團隊技能，自己依序扮演角色，
讀取 `.claude/agents/<name>.md`，不執行 worker wrapper。
adapter 由 `scripts/sync-codex-team-skills.mjs` 產生，命令為
`npm run sync:team-skills`；修改技能（尤其 frontmatter description）後須重新產生，
以 `scripts/check-codex-team-skills.test.mjs` 驗證，不手改生成內容。
Codex `workspace-write` 沙盒將 `.agents/` 保護為唯讀，worker 執行同步會因 `EPERM` 失敗。
worker 修改 `.claude/skills/**`（含 frontmatter `name`／`description` 或技能目錄改名）後，
由協調的 Claude 會話在 `npm run test:game-architecture` 前執行 `npm run sync:team-skills`。

## 新遊戲從想法到發布

1. 用 `/start` 或 `/brainstorm` 確認 gameId、練習目標、操作方式與範圍。
   引擎已是 web；`/setup-engine web` 從 package 檔與 lockfile 更新版本紀錄，
   不用搜尋結果選取安裝版本。
2. 用 `/design-system <gameId>` 或相關 `/team-*` 設計階段產出
   `design/gdd/<gameId>.md`。每款新遊戲在 **minimal／standard／full 全部層級**
   都必須有實質內容的以下精確標題：
   `## Summary`、`## Overview`、`## Detailed Design`、`## Edge Cases`、
   `## Dependencies`、`## Acceptance Criteria`。
   minimal 可縮短內容，不能以 `design/game-brief.md` 取代這份 GDD；full 的額外
   設計章節仍適用。接受條件涵蓋設定、教學、開始、完成、保存／重試、返回與行動操作。
3. 依內容選 `/team-combat`、`/team-ui`、`/team-audio`、`/team-level` 等技能，
   用 `/dev-story` 實作適合的最小切片。每次先寫可執行行為測試、看到需求缺少造成的
   失敗，再修改產品碼；不得用縮小需求、刪功能或放寬安全檢查換取通過。
4. 用 `/studio-code-review`、`/team-qa` 與適用的 QA 技能檢查 GDD、程式、可操作流程、
   雙語與桌機／手機／平板。執行倉庫既有 gate、逐遊戲 build 及本機 Brave fixture；
   測試新增／修改須接入 root `test:ci`。需瀏覽器／硬體的項目記錄本機方式與限制。
5. `/team-release` 整理證據，發布仍完全依
   [R2 遷移計畫第 7、11 節](../../docs/r2-game-migration-plan.md)。
   未核准時只執行 `node scripts/publish-official-game.mjs <gameId> --dry-run`；
   擁有者核准精確 version／contentSha256 與檔案清單後，才由獲授權的執行者發布。
   需要 runner 支援時先部署相容平台；新遊戲須先發布並確認 current，再推送切換
   Hub registry。發布後核對正式 bytes、API、session、Hub／PWA 流程與收據，
   不能把本機 build、dry-run 或 push 成功當作正式完成。

所有新遊戲都必須經遊戲團隊。2026-11-09 已存在的遊戲免補這項新遊戲 GDD，
精確凍結清單由 `scripts/game-team-legacy-games.json` 持有，不能為了過測試加進新遊戲。
`scripts/check-game-team-design.mjs` 與 `scripts/check-game-team-design.test.mjs`
經 `npm run test:game-architecture` 檢查新遊戲；既有遊戲修改仍須遵守 TDD 與發布規範。

## Workspace 與安全界線

本倉庫是 monorepo。遊戲 code root 是
`apps/rehabtrainerhub/games/<gameId>/`，新來源可在其 `src/`；既有入口可留原位。
測試使用 `scripts/check-<gameId>-*.test.mjs`（node:test），prototype 放 code root 外。
未授權不得寫入 `apps/rehabtrainerhub/app`、`apps/usergamerunner`、`packages/`
或其他遊戲 workspace。詳細目錄見 [directory-structure.md](directory-structure.md)。

每款自行擁有依賴、`public/game.json`、設定、教學、i18n、樣式、runtime 與結算，
禁止平台套件、`packages/ui` 及跨遊戲程式碼。遊戲保持 `sandbox="allow-scripts"`，
成果只走經 origin／source／nonce／單調 sequence／schema 驗證的私有 MessageChannel。
相機等輸入走 runner 已核准代理，Hub 不複製遊戲 defaults／validation／rules／runtime。
已發布 bytes 不可覆寫，修改須升版。規則與查核點見 AGENTS.md 及 web-game-specialist。

## 文案與合作

writer、ux-designer、narrative-director、community-manager 及所有對外文案角色
遵守 AGENTS.md「台灣醫療與職能治療法規文案」：用「練習／活動／當次紀錄」
（practice/activity/session record），不宣稱治療、診斷、療效、預防疾病或改善人體功能，
不虛構疾病族群適用、專業審閱、見證或臨床量測效度。資格只陳述已查核事實，
不當作產品療效背書；文案或用途需法規查核時，由主會話回報擁有者處理。

合作以問題、選項、決定、草稿、核准為節奏。新增架構決策、未授權寫入或多檔擴大
範圍先呈現可審查草稿與完整路徑；worker 把問題放回報告，由 Claude 詢問。
已授權檔案集與技能明定的 bounded return-contract 例外依 worker protocol 執行。
略過／關閉問題不是核准，沒有明確授權不得 commit／push／部署／發布。
Claude 從其他資料夾啟動時先檢查本倉庫 hooks、deny rules 與指引是否載入。

## 工作狀態與上下文

- `production/session-state/active.md` 是 checkpoint：壓縮、崩潰或 `/clear` 後先讀。
  記下目標、已授權範圍、決策、已完成證據與下一步，檔案是記憶來源。
- `production/session-state/codex-briefs/` 放完整 brief（gitignored）；
  `production/session-logs/` 放本機稽核；`production/qa/evidence/` 保存驗收證據；
  sprint、milestone、release 等紀錄留在 `production/` 對應目錄。
- `.claude/scripts/` helpers 只輸出觀察，不裁定成敗。主會話依任務、模式與倉庫規則
  判讀結果；腳本沒跑、缺輸入或檔案缺少時明說，不能把零命中視為通過。
- 上下文管理細節按需讀 [context-management.md](context-management.md)，
  協作細節見 [coordination-rules.md](coordination-rules.md)。
