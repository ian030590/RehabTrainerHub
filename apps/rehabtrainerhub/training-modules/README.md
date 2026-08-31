# Hub training modules

The repository-level `pnpm run test:training-integration` gate checks that the
catalog, official host routes, generated per-game PWA metadata, progress links,
and storage migration continue to use the same module registry. It is a static
contract; browser/service-worker acceptance still runs in the deployment
environment where a real browser is available.

For a deployed acceptance run, set `OFFICIAL_GAME_PWA_BASE_URL` and execute
`pnpm run test:official-game-pwa-browser`. The optional Playwright gate blocks
cross-origin requests and verifies that the rules transition—not card/config
rendering—starts the heavy module request.

本目錄是 Hub 內建訓練模組的唯一實作來源。模組擁有自己的設定、語系、紀錄、刺激呈現、輸入、jsPsych timeline/plugin 與 renderer lifecycle；不得從 `training-runtimes/*` 反向匯入。

四個 `training-runtimes/{motor,vision,brain,mouth}` 目前只提供遷移期的 route/layout shell。shell 若需要模組實作，必須透過 `@rehab-trainer/hub-modules/*` alias 匯入，不能複製設定或長生命週期狀態。未來會由單一 `official-training-host` 與每個模組的 fresh iframe 逐步取代 category shell。

## 每個模組的責任

- `moduleFlowManifest.ts`：能力、媒體權限、jsPsych lifecycle、資產群組與 PWA metadata 的單一來源。
- `i18n/`、`utils/settings.ts`、`utils/trainingRecords.ts`：模組擁有的語系、設定 namespace 與當次紀錄儲存。
- `pages/`、`experiment/`：config/rules/training/results 與 native jsPsych timeline/plugin；重型套件只可由 rules-visible 之後的 engine 邊界載入。
- `components/`：模組需要的薄 UI adapter；跨模組 shell 元件放在 `packages/ui`。

## 新模組 checklist

1. 新增一個 module directory 與 manifest/config/rules/setup/engine/test；不要修改四個 category runtime 的 route switch。
2. 在 `moduleFlowManifest.ts` 宣告 capability、media permission、asset group 與 jsPsych lifecycle。
3. setup/config/rules 不得 static import Pixi、Three、MediaPipe、TensorFlow、WebGazer、Vosk 或 jsPsych runtime；engine 透過 `loadEngine({ trigger: 'rules-visible' })` 載入。
4. `startRun` 建立本局 jsPsych、renderer、模型、media stream 與 listener；`abort/dispose` 必須可重複呼叫並釋放全部資源。
5. 執行 `pnpm run test:training-flow`、`pnpm run test:entrypoints` 與對應 runtime TypeScript check；涉及 build/entrypoint 時再執行 `pnpm run build:hub`。
