# 居家訓練網系統架構優化藍圖

狀態：In progress（Phase 0–2 基礎垂直切片、Phase 3 Vision preload/abort 與 build-manifest 驗收切片、Phase 4 五個指定影音模組 native jsPsych lifecycle + data-only simulation、Phase 5 root shell + dependency closure/offline pack 基礎、同源 allowlisted runtime-assets 與 AI/WASM/WebGazer 離線閉包、官方遊戲 PWA staged 離線安裝、Phase 6 migration/狀態 gate 與 Phase 7 審查 API/UI 垂直切片、10 個目標模組的 host setup/engine 切片、內建 Drawing Defense 隱私邊界與回歸 gate 已實作；瀏覽器/部署驗收與 legacy brain 遷移仍依清單逐步完成）

盤點日期：2026-08-29

適用範圍：Hub 內建訓練、開發者遊戲平台、隔離執行器、PWA、CI/CD 與套件管理

## 0. 架構決策摘要

本文件先給結論，後續章節再說明依據與實作順序。

| 議題 | 建議決策 |
| --- | --- |
| 是否直接刪除 mouth / motor / vision / brain runtime | **不要直接刪除 runtime 邊界。**逐步退役四個「類別型 Vite shell」，改成每局建立 fresh iframe 的輕量 `official-training-host`，再由每個遊戲動態載入並擁有自己的 engine/jsPsych run handle。 |
| 大型函式庫如何隔離 | 函式庫檔案可用固定版本、內容雜湊的共用資產節省下載；**instance、renderer、model、media stream、timer、listener 與 dispose 必須由單一遊戲擁有**，不可建立跨遊戲長生命週期 singleton。 |
| 何時開始載入 Pixi / Three / MediaPipe / TensorFlow / WebGazer | config 與規則 UI 不得靜態 import 重型依賴。進入 `rules-visible` 後才允許下載程式碼與資產；使用者按「開始」後才允許建立 jsPsych instance、renderer、model instance 與實際 media stream。 |
| jsPsych 規範 | 新遊戲只接受 module-owned native jsPsych plugin/timeline。既有 external adapter 是遷移橋接，不是新模組範本。哈特圖與駕駛注意力模擬練習不列入本次轉換，但仍須通過既有 lifecycle gate。 |
| 是否使用公用 CDN | Production 不直接依賴 jsDelivr、unpkg、Google model URL 等第三方公用 CDN。上游檔案只能在受信任的同步流程取得、驗證 SHA-256 後鏡像到平台控制的版本化路徑。CDN 是傳輸層，不是版本來源。 |
| CDN 是否影響 PWA | 會。跨來源、未列入 service worker cache 的資產無法保證離線；PWA 安裝也不等於已下載所有遊戲。改成「小型 app shell + 使用者明確下載單一遊戲離線包」。 |
| 單一 HTML/ZIP 的小 CI | 保留現有同步 intake scanner，新增 queue 驅動的隔離掃描服務：結構檢查、AST/HTML policy、malware signature、jsPsych/SDK contract、無網路動態 smoke。掃描完成才進管理後台審核佇列。 |
| 能否保證零外傳、零病毒 | **任意 HTML/JavaScript 在使用者瀏覽器執行時，無法只靠 regex、CSP 與 iframe 做絕對保證。**平台能提供分層降低風險與隔離；若產品文案要求絕對零外傳，必須改用無任意 JavaScript 的 declarative game format，或在遠端無網路瀏覽器執行。 |
| 偵測問題後的開發者選項 | 可修正後提交新的 submission attempt；只有可疑或可能誤判的 finding 可要求人工審查。確認的 malware、ZIP bomb、path traversal、加密壓縮檔等 hard block 不可人工放行。 |
| 套件管理 | 全 repo 原子遷移至 pnpm。不得保留「pnpm lockfile，但 scripts / CI 仍執行 npm」的混合狀態。 |

## 1. 需求邊界與用詞

### 1.1 本次 jsPsych 必要範圍

「模組」只指 `trainingCatalog` 中可執行的遊戲；尚未可玩的頁面不算遊戲模組。目前 `ComprehensionTraining` 與 `LowerLimbTraining` 是 placeholder，等真正註冊 catalog manifest 時才適用完整 contract。

必要範圍共 10 個：

- Motor：`drawing-defense`、`asteroid-shield`、`gesture-battler`、`motor-cortex-rehab`
- Vision：`moving-card`、`oculomotor-training`、`gabor-patching`、`reading-training`
- Mouth：`tongue-catch`
- Brain：周邊視野訓練 `ufov`

明確排除本次轉換：

- `hart-chart`（哈特圖）
- `driving-rehab`（駕駛注意力模擬練習）

排除代表「不要求在本工作流轉換」，不是允許它們破壞既有 lifecycle、PWA 或 entrypoint gate。

### 1.2 「沒有硬編碼」的可執行定義

不能把「無硬編碼」解釋成程式內完全沒有 literal。安全上限、schema version、預設值與 timeout 本來就必須存在，但需符合以下條件：

1. 有唯一、具名、版本化的來源。
2. 不在 UI、API、scanner、runner 與文件各複製一份。
3. 有 type/schema 與測試鎖定。
4. 不能由不受信任的 client 或一般環境變數任意放寬安全政策。
5. 顏色使用 theme token；公開文字使用 i18n key；URL 使用經驗證的 site/asset registry。

## 2. 現況盤點

### 2.1 已經做對的部分

- 四個 `training-runtimes/*/src/App.tsx` 已是 lazy-load 的 route/layout shell，實際頁面位於 `training-modules/*`。
- `training-modules/moduleFlowManifest.ts` 已對所有 catalog 遊戲宣告 flow、媒體權限與 jsPsych lifecycle 類型。
- `packages/ui/src/jsPsychLifecycle.ts` 已提供 renderer-independent 的 external lifecycle adapter。
- Vision 四個主要遊戲與 UFOV 已使用 native jsPsych plugin/timeline。
- `packages/game-sdk` 已以 `MessageChannel` 管理 uploaded game 的 ready/start/pause/resume/complete/abort。
- `usergamerunner` 已維持 separate domain、`sandbox="allow-scripts"`、限制性 CSP、版本化 runtime 與每版 PWA。
- 上傳端已有檔案/解壓大小、路徑、混淆、危險 API、jsPsych/SDK contract 與 SHA-256 檢查。
- 發布端已有 quarantine、人工三項確認、lease、核准前重新驗證檔案雜湊、immutable release 與 revoke 流程。

### 2.2 jsPsych 現況不是「未使用」，而是兩種成熟度

| 範圍 | 現況 | 目標 |
| --- | --- | --- |
| Vision：moving / oculomotor / gabor / reading | `native-timeline` | 保留，補強行為測試與 loading boundary |
| Brain：UFOV | `native-timeline` | 保留，將 config/rules 與 engine chunk 明確切開 |
| Motor 四個遊戲 | module-owned lifecycle scaffold；Hub 已接入 native host setup/engine | 保持 component-owned renderer/input，持續補行為與瀏覽器驗收 |
| Mouth：tongue-catch | module-owned lifecycle scaffold；Hub 已接入 native host setup/engine | 保持 component-owned renderer/model/stream，持續補行為與瀏覽器驗收 |
| Hart Chart（排除） | `external-runtime-adapter` | 本輪不轉換，維持回歸測試 |
| Driving（排除） | `native-timeline` | 本輪不轉換，維持 Three/fullscreen 回歸測試 |

因此，需求中的 10 個模組目前都已由 jsPsych 管理至少一層生命週期；Motor/Mouth 的 custom lifecycle plugin 已完成，但 component 仍自行建立 jsPsych run。下一個垂直切片必須把 component-owned run 移入 module setup/engine，避免以第二個 jsPsych instance 假裝完成 host migration。

### 2.3 ownership 已收斂，保留相容 adapter

這一輪已把 module 的 canonical 實作與 category runtime adapter 分開；`training-modules` 不再 import 或 re-export `training-runtimes/*`。下列檔案曾是反向依賴的主要風險點，現在均已搬到 module-owned 實作，僅保留 runtime -> module 的單向相容匯出：

- `training-modules/motor/utils/settings.ts`
- `training-modules/vision/utils/pixiPool.ts`
- `training-modules/vision/utils/webgazerLoader.ts`
- `training-modules/brain/utils/trainingRecords.ts`
- mouth / motor / vision 的 i18n、settings、records、sound 與部分 component adapter

舊版依賴曾形成循環概念：

```text
runtime shell -> training module -> runtime shell utility
```

目前依賴已收斂為單向：

```text
Hub/official host -> module setup -> module engine
                  -> packages/ui / packages/training-contracts
```

### 2.4 重型載入時機（基線問題與尚待切換範圍）

目前有三個明確問題：

1. `SelectionCard` 在 focus、pointer enter、touch start 呼叫 `onPreload`。
2. Motor/Mouth 的 loader 載入整個 game component，而 component 頂層靜態 import Pixi、MediaPipe、TensorFlow 或 jsPsych。
3. Vision 在 module config 展開時執行 `PreloadTrainingEngine()`，甚至 `WarmUpPixiTrainingRuntime()`。

所以現況的「dynamic import」只能證明未進 entry bundle，不能證明「規則顯示後才載入」。需要把輕量 setup chunk 和重型 engine chunk 物理分檔，並由狀態機唯一觸發 engine loader。

### 2.5 PWA 現況會抵銷 lazy loading 的收益

現有 `emit-pwa-assets.mjs` 會把 Hub output 幾乎全部加入 root service worker precache。本次盤點的既有 build：

- precache URL：297 個
- precache 大小：約 42.62 MiB
- 內容包含 WebGazer/MediaPipe WASM、Three chunk、TongueCatch 大型 chunk、車輛 GLB 與 StarSky 等遊戲資產

也就是說，網頁 runtime 雖然 lazy-load，service worker 一安裝仍會預先下載大部分重型內容。另方面，單一官方遊戲 PWA 只 precache category shell，不一定包含該遊戲真正的 dynamic chunk；使用者剛安裝後立刻離線，未必能啟動遊戲。

### 2.6 遊戲上傳平台已有安全骨架，但不是完整 CI

現況是 request 內同步 `InspectGamePackage()`，結果直接成為 `blocked` 或 `pending_review`。缺口包括：

- source scan 主要依賴 pattern，不是完整 HTML/JavaScript AST policy。
- 沒有 malware signature/YARA 類掃描紀錄。
- 沒有無網路、無 secret 的動態 jsPsych/SDK smoke。
- Hub scanner 與 runner 各自硬編 capability allowlist；目前 runner 接受 `gamepad/touch`，intake scanner 不接受，contract 已漂移。
- `game_releases` 同時承擔「送審 attempt」與「核准 immutable release」，導致同一 semver 修正後無法重送。
- 開發者 UI 會顯示 blocked，但沒有「針對 finding 修正並重送」或「要求人工判讀誤報」的正式 API/state。
- Admin 能看 blocked，但目前不能合法 override；這是安全的預設，應改成可審查 finding，而不是直接開一個萬用放行按鈕。

### 2.7 pnpm 遷移目前是半完成狀態

盤點期間工作樹已出現：

- `packageManager: pnpm@11.24.0...`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.node-version`
- workspace dependency `workspace:*`
- 移除 `package-lock.json`

但 root scripts、`scripts/build-apps.mjs`、兩份 GitHub workflow、README、AGENTS 與多份 docs 仍執行 npm。本機代理環境目前也找不到 `pnpm` 或 `corepack`。在這個狀態合併會造成 local/CI/Cloudflare 使用不同 package manager。

## 3. 目標架構

```text
trainerhub.cc
├─ Next.js Hub
│  ├─ catalog / 搜尋 / 帳戶 / 紀錄
│  ├─ module-owned config + rules overlay（輕量）
│  └─ official-training-host（同源、單一薄殼）
│     └─ generated module registry
│        └─ module-owned run handle
│           └─ jsPsych instance（模組建立、每次 run 新建）
│              └─ module-owned plugin/timeline
│                 ├─ Pixi / Three renderer instance
│                 ├─ MediaPipe / TF / WebGazer instance
│                 └─ input / timers / stream / dispose
│
├─ Upload control plane
│  ├─ metadata + auth + D1
│  ├─ quarantine R2
│  ├─ scan queue / trusted controller / disposable executor / result queue
│  └─ admin review + immutable publish
│
└─ separate registrable domain: usergamerunner
   ├─ reviewed runtime（pinned jsPsych + game SDK）
   ├─ sandboxed launcher / package iframe
   └─ release-only R2 read path；無 D1、auth、quarantine、secret
```

### 3.1 建議目錄

```text
packages/
  training-contracts/            # 無 React、無 renderer 的 types/schema/state machine
  ui/                            # 共用 shell、config/rules/results components
  game-sdk/                      # 第三方遊戲私有 bridge 與 jsPsych runner

apps/rehabtrainerhub/
  official-training-host/        # 取代四個 category runtime 的單一薄殼
  training-modules/
    registry/                    # build-time generated；禁止手動複製 catalog mapping
    motor/
      drawing-defense/
        manifest.ts              # 輕量 metadata/keys/capabilities/assets
        config.ts                # defaults/schema/validation
        ConfigPanel.tsx           # 不得 import heavy package
        RulesPanel.tsx            # 不得 import heavy package
        loadEngine.ts             # 唯一 dynamic import 邊界
        engine/
          index.ts
          plugin.ts               # jsPsych owns trial lifecycle
          renderer.ts
          results.ts
          tests/
    vision/...
    brain/ufov/...
    mouth/tongue-catch/...

apps/gamevalidator/
  controller/                   # queue、quarantine read、attestation；不執行 artifact
  executor/                     # disposable image；無 credential、無網路
apps/usergamerunner/             # 保持獨立，不與 official host 合併
```

類別目錄只用於團隊閱讀與 domain grouping，不再代表 runtime、bundle 或共享 engine state。Hub、單一遊戲 PWA shell 都不得在自己的 `Window` import engine；每次 run 建立新的 official-host iframe/Document realm，run 結束後移除整個 iframe。這是清除 global listener、module singleton 與 WebGL context 的 fault-containment 邊界，不把可信官方程式誤稱為惡意程式安全沙盒。

## 4. 介面定義

以下介面是目標 contract；名稱可在實作 PR 微調，但責任邊界不可倒退。

### 4.1 輕量 manifest

```ts
export type TrainingDomain = 'motor' | 'vision' | 'brain' | 'mouth';
export type TrainingModuleId = `${TrainingDomain}:${string}`;
export type TrainingCapability =
  | 'audio'
  | 'camera'
  | 'microphone'
  | 'fullscreen'
  | 'gamepad'
  | 'pointer'
  | 'keyboard'
  | 'touch';

export interface TrainingAssetDescriptor {
  id: string;
  version: string;
  path: string;       // 平台控制的版本化路徑，不接受任意 remote URL
  byteSize: number;
  sha256: string;
  contentType: string;
  offline: 'required' | 'optional' | 'never';
}

export interface TrainingModuleManifest {
  schemaVersion: 1;
  id: TrainingModuleId;
  implementationVersion: string;
  purposeId: string;
  catalogOrder: number;
  titleKey: string;
  descriptionKey: string;
  themeToken: string;
  capabilities: readonly TrainingCapability[];
  flow: readonly ['card', 'config', 'rules', 'training', 'results'];
  lifecycle: {
    owner: 'jspsych';
    mode: 'native-timeline' | 'legacy-adapter-exempt';
  };
  pwa: {
    installable: boolean;
    shortNameKey: string;
    orientation: 'any' | 'landscape' | 'portrait';
    iconAssetIds: readonly string[];
  };
  assets: readonly TrainingAssetDescriptor[];
}
```

Route 不再另存一份任意字串：版本化 convention 從 `motor:drawing-defense` 取出 `drawing-defense`，產生 `/games/drawing-defense/`；build 會拒絕跨 domain slug 重複。Setup entry 固定為 module root `index.ts`，engine entry 固定為 `loadEngine.ts`，registry 由 `import.meta.glob`/build generator 建立，不接受手寫 switch。`catalogOrder` 與 `pwa` 則保留在 manifest，因為它們無法從路徑可靠推導。

`manifest.ts`、config 與 rules 的 runtime import graph 禁止包含 `jspsych`、`@jspsych/*`、Pixi、Three、MediaPipe、TensorFlow、WebGazer、Vosk，以及任何 engine 檔案。

### 4.2 Setup 與 engine 邊界

本節刻意分層：`ValidationIssue`、manifest、result 與純資料 state machine 放在 dependency-free 的 `packages/training-contracts`；含 React type 的 setup adapter 放在 `packages/ui`；run handle 由 module engine 實作。Host 永遠看不到 timeline 或 jsPsych instance。

```ts
// packages/training-contracts
export interface ValidationIssue {
  path: string;
  code: string;
  messageKey: string;
}
```

```ts
// packages/ui/trainingHostContract.ts（browser/React adapter）
import type { ComponentType } from 'react';

export interface EnginePreloadContext {
  trigger: 'rules-visible';
  signal: AbortSignal;
  assets: TrainingAssetResolver;
  reportProgress(progress: number): void;
}

export interface TrainingRunContext<TConfig> {
  config: Readonly<TConfig>;
  mountElement: HTMLElement;
  signal: AbortSignal;
  sessionNonce: string;
}

export interface TrainingSetupModule<TConfig> {
  manifest: TrainingModuleManifest;
  defaultConfig: Readonly<TConfig>;
  validateConfig(input: unknown):
    | { ok: true; value: TConfig }
    | { ok: false; issues: readonly ValidationIssue[] };
  ConfigPanel: ComponentType<TrainingConfigProps<TConfig>>;
  RulesPanel: ComponentType<TrainingRulesProps<TConfig>>;
  loadEngine(context: EnginePreloadContext): Promise<PreparedTrainingEngine<TConfig>>;
}
```

```ts
// module engine contract；實作內部才 import jsPsych type/value
export interface TrainingRunHandle {
  readonly result: Promise<TrainingRunResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  abort(reason: 'exit' | 'back' | 'unmount' | 'error'): Promise<void>;
  dispose(): Promise<void>;
}

export interface PreparedTrainingEngine<TConfig> {
  startRun(context: TrainingRunContext<TConfig>): Promise<TrainingRunHandle>;
  dispose(reason: 'back' | 'exit' | 'complete' | 'error'): Promise<void>;
}
```

重要限制：

- `loadEngine()` 可下載與驗證 chunk/model bytes，但不得開 camera/microphone、建立 canvas/WebGL context 或註冊永久 listener。
- `startRun()` 由模組建立全新的 jsPsych instance 與 timeline；實際 renderer/media 初始化放在 plugin `trial()`，結束時以 `finishTrial()` 或 async return 交回資料。
- Host 只呼叫 `startRun/pause/resume/abort/dispose`，不得 import `initJsPsych`、讀取 jsPsych data store 或直接操控 renderer。
- `dispose()` 必須 idempotent，並停止 MediaStreamTrack、animation frame、ticker、audio node、timer、observer、listener、model 與 renderer。
- 動態 import 本身無法可靠取消；返回結果前必須再次檢查 `AbortSignal`，過期 engine 立即 dispose，不得掛到 UI。

### 4.3 Host 狀態機

```text
card
  -> configuring
  -> iframe-booting
  -> rules-loading
  -> rules-ready
  -> starting
  -> running
running -> pausing -> paused -> resuming -> running
running -> completed
rules-loading | rules-ready -> configuring（先 dispose realm）
任何非終止狀態 --abort/unmount/command-timeout--> aborting
任何 async 狀態 --fatal error--> failed
completed | aborting | failed -> disposing -> disposed
```

規則畫面要先出現，再建立 iframe 並背景 preload；Start 在 engine ready 前顯示進度或 await 同一個 promise。Parent 只有收到相符 `commandId` 的 ack 才進下一狀態；pause/resume 被拒絕時保留原狀態並顯示錯誤。返回設定、關閉 overlay、換遊戲、command timeout 或 route unmount 都要 abort preload/run、進入 `disposing`，即使 abort ack timeout 也強制移除 iframe 後才算 `disposed`。

媒體權限可在 config 做 permission preflight，但取得的測試 stream 必須立即停止；不得藉此提早載入 model。正式 stream 由開始後的 jsPsych trial 建立與釋放。

### 4.4 Run result 與 host protocol

```ts
export interface TrainingRunResult {
  schemaVersion: 1;
  moduleId: TrainingModuleId;
  moduleVersion: string;
  status: 'completed' | 'aborted';
  startedAt: string;
  durationMs: number;
  trialCount: number;
  score?: number;
  metrics: Record<string, number | boolean | null>;
}

export interface TrainingLifecycleEnvelope<TPayload> {
  schema: 'trainerhub.training/v1';
  sessionNonce: string;
  sequence: number;
  moduleId: TrainingModuleId;
  payload: TPayload;
}

export interface TrainingHostConnect {
  schema: 'trainerhub.training/connect/v1';
  type: 'connect';
  runId: string;
  sessionNonce: string;
  protocolVersion: 1;
  // MessagePort 以 postMessage transfer list 傳遞，不放進可序列化 payload。
}

export interface TrainingCommandMeta {
  runId: string;
  commandId: string;
}

export type TrainingHostCommand =
  | (TrainingCommandMeta & { type: 'prepare'; config: unknown })
  | (TrainingCommandMeta & { type: 'start' })
  | (TrainingCommandMeta & { type: 'pause' })
  | (TrainingCommandMeta & { type: 'resume' })
  | (TrainingCommandMeta & { type: 'abort'; reason: 'back' | 'exit' | 'unmount' })
  | (TrainingCommandMeta & { type: 'dispose' });

export type TrainingHostEvent =
  | { type: 'iframe-ready'; protocolVersion: 1; hostVersion: string }
  | (TrainingCommandMeta & { type: 'preload-progress'; progress: number })
  | (TrainingCommandMeta & { type: 'prepared' })
  | (TrainingCommandMeta & { type: 'started' })
  | (TrainingCommandMeta & { type: 'paused' })
  | (TrainingCommandMeta & { type: 'resumed' })
  | (TrainingCommandMeta & { type: 'command-rejected'; errorCode: string; recoverable: boolean })
  | { type: 'completed'; runId: string; result: TrainingRunResult }
  | (TrainingCommandMeta & { type: 'aborted'; result: TrainingRunResult })
  | { type: 'failed'; runId: string; commandId?: string; errorCode: string }
  | (TrainingCommandMeta & { type: 'disposed' });
```

Hub 只接收 bounded aggregate result，不接收 camera frame、audio、landmark、raw gaze samples 或第三方自由文字。嵌入訊息維持 exact origin、exact `contentWindow`、nonce、schema 與 monotonic sequence 驗證。

Fresh iframe load 後先送 `iframe-ready`；parent 驗證 exact origin/source/protocol 後才以一次性 handshake 轉交 private `MessagePort` 與 nonce。後續命令只走該 port，並同時驗證 run ID、command ID 與 monotonic sequence；重複 ack 可 idempotent 忽略，未知/stale ID 直接拒絕。

Iframe 內的 host adapter 只把 `start/pause/resume/abort/dispose` 映射到當次 module `TrainingRunHandle`；jsPsych object、renderer reference 與 data store 永不跨訊息邊界。`prepare.config` 必須先以 module schema 驗證，未知欄位剔除後才交給 engine。

### 4.5 Official host iframe policy

Module 只能宣告 capability，不能傳入 iframe attribute、Permissions Policy token 或任意 host URL。中央 factory 從已驗證 manifest 產生完整 policy：

```ts
export type OfficialIframeFeature =
  | 'autoplay'
  | 'camera'
  | 'microphone'
  | 'fullscreen'
  | 'gamepad';

export interface OfficialHostIframePolicy {
  src: string; // 只能由 siteUrls + generated module route 產生
  sandboxTokens: readonly ['allow-scripts', 'allow-same-origin'];
  featureAllowlist: Readonly<Record<OfficialIframeFeature, "'self'" | "'none'">>;
  allowFullscreen: boolean;
  referrerPolicy: 'no-referrer';
}
```

`audio -> autoplay`、camera、microphone、fullscreen、gamepad 各自由同名 capability 導出；未宣告的 feature 必須明確序列化成 `'none'`，不能依賴瀏覽器 default allowlist。Hub response 只設定平台固定的 self-only Permissions-Policy ceiling，iframe `allow`、host route response 與 `allowFullscreen` 再依 manifest 縮限；它們共用同一 policy module 並做 browser test。這個 official policy 可含 `allow-same-origin`，因為官方程式是可信內容；第三方 runner 仍固定只有 `sandbox="allow-scripts"`，兩個 component/type 不得共用或互相轉型。

### 4.6 Generated registry

```ts
export interface TrainingRegistryEntry {
  manifest: TrainingModuleManifest;
  loadSetup(): Promise<TrainingSetupModule<unknown>>;
}

export type TrainingRegistry = ReadonlyMap<TrainingModuleId, TrainingRegistryEntry>;
```

Registry、catalog、官方遊戲 PWA、sitemap 排除規則、record module allowlist 與 build entries 應由 manifest 產生。新增遊戲只新增自己的目錄與 manifest，不得再手改五份 ID array。

### 4.7 第三方遊戲核准版 manifest

單一 HTML 與 ZIP 最終都正規化成同一個 release contract；單一 HTML 固定成唯一的 `index.html`。此 manifest 由 server 根據已掃描 artifact 產生，開發者送來的 metadata、hash、capability 或 runtime URL 都不能直接成為可信值。

```ts
export type UploadedGameCapability =
  | 'audio'
  | 'fullscreen'
  | 'gamepad'
  | 'keyboard'
  | 'pointer'
  | 'touch';

export interface ReviewedGameReleaseManifest {
  schemaVersion: 1;
  gameId: string;
  version: string;
  title: string;
  summary: string;
  purposeId: string;
  entryPath: 'index.html';
  artifactSha256: string;
  capabilities: readonly UploadedGameCapability[];
  runtime: {
    jsPsych: { version: string; path: string; sha256: string };
    gameSdk: { version: string; path: string; sha256: string };
  };
  files: readonly {
    path: string;
    byteSize: number;
    sha256: string;
    contentType: string;
  }[];
  scanEvidence: {
    scanRunId: string;
    policyVersion: string;
    reportSha256: string;
  };
}
```

`path` 只能是 runner root-relative、platform-generated 的固定版本路徑。Uploaded game capability 明確不含 network、camera、microphone、worker、storage 或 navigation；Hub 與 runner 必須引用同一份 capability enum 與 runtime contract，消除目前兩邊 allowlist 不一致的風險。

## 5. Runtime、重型依賴、CDN 與 PWA

### 5.1 不保留四個 category runtime，但保留一個 host

四個 runtime 現在主要重複 route、Navbar、i18n、settings、footer 與 Vite config。直接把它們全部塞回 Next Hub 會讓 renderer lifecycle、fullscreen、錯誤隔離與 PWA entry 更難管理。

建議採 hybrid：

1. 新增單一 `official-training-host`，只含共用 shell、embedded protocol、error boundary 與 generated registry。
2. Hub overlay 與單一遊戲 PWA shell 在每次進入 `rules-visible` 時建立新的 host iframe 供 preload/run；返回設定、退出、完成或錯誤後移除整個 document，不重用上一局的 global realm。
3. 舊 `/runtimes/{trainer}/` 在遷移期仍可啟動，作為 deep-link 相容層。
4. 每完成一個模組，就把 catalog launch target 切到新 host。
5. 所有模組與官方 PWA parity 通過後才刪除四個 runtime directory。
6. storage 中既有 `runtimeId` 可保留作歷史 domain 欄位，不應再控制 bundle 或路由。

### 5.2 共用 bytes，不共用 runtime state

允許共用：

- content-addressed jsPsych/Pixi/Three/MediaPipe/WASM vendor chunk
- 版本化 model bytes
- renderer-independent TypeScript contract、數學 helper、UI 與 asset resolver

禁止共用：

- Pixi `Application`、Three scene/renderer、jsPsych instance
- MediaPipe landmarker、TensorFlow model/classifier、WebGazer session
- camera/microphone stream、game loop、input handler、trial state
- 另一個模組的 engine helper 或視覺規則

共享檔案可降低 PWA 空間；instance ownership 才是隔離單位。為了「隔離」而在每個遊戲複製 10 MiB WASM，會增加下載、快取壓力與更新風險，沒有安全收益。

隔離分成三層，不混用承諾：

| 層級 | 機制 | 能保證什麼 |
| --- | --- | --- |
| Bundle ownership | setup/engine dynamic import boundary | 非目標遊戲不會因共用 shell 而載入該 engine |
| Run realm | 每局全新 iframe/Document，結束移除 | 清除該 realm 的 module singleton、global listener、prototype mutation 與 renderer context |
| Untrusted security | separate-domain runner + opaque sandbox + CSP | 限制第三方遊戲接觸 Hub origin、導頁與外連 |

官方 module 的 fresh iframe 是 lifecycle/fault isolation，不是對惡意官方程式的安全邊界；第三方上傳內容永遠不能進入 official host。
官方 engine 也禁止直接存取 `window.parent/top/opener` 或自行 `postMessage`；只有 host adapter 可跨 realm 通訊，並由 forbidden-import/source gate 鎖定。

### 5.3 CDN 策略

Production asset resolver 只接受同源、版本化、由 R2/Pages route 提供的
`/runtime-assets/{name}/{version}/{sha}/...`；開發環境若需要 fallback，也只能是
同源 localhost 的本地 Pages asset，且必須明確以 `allowLocalFallback` opt-in（未指定時
resolver 會依 localhost origin 自動判斷）。不得由 runtime 組合外部 asset domain 或第三方 CDN URL。

不應有 production 第三方 public fallback。現有 `aiAssets.ts` 的 jsDelivr/Google fallback 與「平台不向外部服務傳送請求」目標衝突，也讓供應鏈與離線行為依賴第三方。

只把 CDN URL 寫成固定 semver 不等於 immutable；上游仍可能換檔、撤檔或改 CORS。SRI 可驗完整性但不會自動提供離線快取，也無法讓 opaque response 適合逐檔驗證，因此正式 PWA dependency closure 只列平台可驗 hash 的資產。

上游版本升級流程：下載到 CI 暫存區、license/SBOM 檢查、size + SHA-256 驗證、更新 asset manifest、上傳新 immutable key、canary、再更新 module manifest。永遠不覆寫舊 key。

### 5.4 PWA 改成 shell 與 offline pack 分離

Root PWA：

- install/activate 只 precache Hub navigation shell、offline fallback、必要字型/icon。
- 明確排除 `/runtimes/**`、`/games/**`、models、WASM 與遊戲大型素材。
- runtime chunk 使用 content hash 的 cache-first；HTML/catalog/API 使用 network-first。

單一官方遊戲：

- build 從 Rollup/Vite manifest 產生該 module 的 dependency closure。
- 產生 `/offline-manifests/{moduleId}/{version}/{manifestSha256}.json`，列出 URL、bytes、SHA-256；key 永不覆寫。
- UI 顯示「下載離線版」、實際大小、進度、版本與移除按鈕。
- 先寫入 temporary cache；全部驗證後才寫 ready marker，避免半套離線包。
- 啟動前檢查 cache 完整性；缺檔時明確顯示需連線，不宣稱已離線可用。
- 使用 `navigator.storage.estimate()` 顯示空間，視支援情況要求 persistent storage；仍須告知瀏覽器或使用者可清除 cache。

Offline manifest 本身不另造應用層簽章：build 先用固定 canonical JSON serializer 產生 bytes/hash，catalog 經同源 HTTPS 提供 expected `manifestSha256`；client 對下載到的原始 bytes 驗 hash，再做 bounded schema 與逐檔 asset hash 驗證。manifest/hash 不符、超出總大小/檔數或有未知 URL scope 時，刪除 staging cache 且不得寫 `ready` marker。此承諾稱為「authenticated immutable manifest」，不稱 signed manifest。

第三方遊戲：維持 runner 每個 `{gameId}/{version}` 的 scope 與 cache prefix。安裝入口需顯示 package + platform runtime 大小；revoke 仍只是「重新連線後 best-effort 回收」，不能宣稱離線 remote kill。

### 5.5 共用 asset cache ownership 與回收

同 origin 的官方遊戲使用一個 content-addressed cache 與 `OfflinePackManager`，module/SW 不得自行猜 cache name 或直接刪共用資產：

```ts
export interface OfflinePackId {
  moduleId: TrainingModuleId;
  moduleVersion: string;
}

export interface OfflinePackManager {
  install(pack: OfflinePackId, signal: AbortSignal): Promise<void>;
  verify(pack: OfflinePackId): Promise<'ready' | 'missing' | 'corrupt'>;
  remove(pack: OfflinePackId): Promise<void>;
  reconcile(): Promise<void>;
}
```

- Cache key 必須包含 asset content hash；IndexedDB index 保存 `asset hash -> Set<packId>`，不用容易因 retry 漂移的裸整數 refcount。
- Install 先進 `staging`，所有 bytes/hash 驗證成功後，才在單一 transaction 加入 pack references 與 `ready` marker。
- Upgrade 先完整安裝新版，再移除舊版 references；remove 只刪掉自己的 pack ID，set 為空且不屬 shell 才刪 asset。
- Service worker activate 與 UI 啟動會 reconcile index、cache 與 manifest；瀏覽器 eviction 後將 pack 降為 `missing`，不假裝仍可離線。
- 多 tab/SW 操作使用 lease + transaction；第三方 runner 是不同 origin，維持自己的 release cache，不共用此 index。

使用者從 catalog 明確按「下載離線版」是 `rules-visible` 網路下載限制的唯一例外：它只允許依 authenticated immutable offline manifest 抓 bytes、驗 hash、寫 cache，禁止 `import()`/執行 script、建立 model/renderer 或要求媒體權限。PWA 安裝與 offline pack 安裝仍是兩個不同狀態。

## 6. 開發者上傳、小 CI 與人工審查

### 6.1 信任區域

```text
Developer browser
  -> Hub authenticated upload API
  -> quarantine R2 + immutable artifact hash
  -> scan job queue
  -> trusted validation controller（只讀 quarantine、job state、report signing）
     -> disposable executor（固定 read-only input；無憑證、無網路）
     <- unsigned evidence（綁 job nonce + artifact hash）
  -> controller 驗證 evidence 並簽署 versioned report
  -> result queue
  -> Hub result consumer 更新 D1
  -> developer fix / manual-review request
  -> admin isolated review
  -> hash recheck + release R2 publish
  -> separate-domain usergamerunner
```

執行上傳內容的 disposable executor 不得取得任何 credential、R2 binding、Hub session secret、OAuth、使用者資料、D1、queue 或一般 Internet。可信 controller 可以有 quarantine 唯讀、result queue write 與專用 report signing key，但絕不 import/parse/execute artifact 程式碼，也沒有 release bucket write。若採 Cloudflare Container/Sandbox，可用 `enableInternet = false` 作 deny-by-default；若換其他供應商，executor 介面與無網路驗收條件不變。

### 6.2 Scan pipeline

1. **Client preflight（UX only）**：檔名、大小、基本 contract；結果不具權威性。
2. **Intake（Hub Worker）**：rate limit、MIME magic、ZIP path/encryption/symlink/bomb、size/file count、SHA-256；寫 quarantine 後 enqueue。
3. **Static policy**：用 HTML parser 與 JavaScript AST 檢查 external URL、network API、dynamic code、navigation、form/frame/worker、obfuscation、bundled runtime、secret/PII pattern；regex 只作補充。
4. **Malware triage**：ClamAV/YARA 或等效 signature，記錄 engine/signature version。更新 signature 的工作與 untrusted scan job 分離。
5. **Framework conformance**：exact pinned jsPsych/SDK URL、`RunTrainerHubJsPsychGame()`、non-empty timeline、result schema、asset allowlist、license/SBOM。
6. **Dynamic smoke**：在 disposable browser/container、本地 HTTP server、無網路、無 secret、read-only artifact、CPU/memory/time limit 下執行；驗證 SDK handshake、ready/start/complete/abort、console error、DOM/navigation/network attempt 與資源釋放。
7. **Report**：產生 policy version、tool versions、artifact hash、finding code、severity、檔案、line/column、修正說明與 verdict。

Provider-specific container 操作包在窄介面後，queue consumer 不直接依賴某一家 sandbox API：

```ts
export interface GameValidationJob {
  jobId: string;
  attempt: number;
  jobNonce: string;
  submissionId: string;
  artifactSha256: string;
  policyVersion: string;
  limitsProfile: 'uploaded-game-v1';
  issuedAt: string;
  expiresAt: string;
}

export interface UnsignedScanEvidence {
  jobId: string;
  attempt: number;
  jobNonce: string;
  artifactSha256: string;
  observedNetworkAttempts: readonly {
    kind: 'fetch' | 'navigation' | 'websocket' | 'webrtc' | 'resource';
    targetClass: 'same-runner-origin' | 'external-origin' | 'opaque';
    targetSample: string;
    count: number;
  }[];
  findings: readonly GameScanFinding[];
  truncated: boolean;
}

export interface GameValidationExecutor {
  execute(
    job: Readonly<GameValidationJob>,
    fixedReadOnlyArtifact: ReadonlyArtifactMount,
    signal: AbortSignal,
  ): Promise<UnsignedScanEvidence>;
}
```

Controller 依 job 中已知 submission 取出 exact quarantine object，先重算 hash，再把 bytes 掛到 executor 的固定 read-only path。Job 不接受任意 URL、mount path、shell command、resource limit 或 CSP override。Controller 回收 evidence 後核對 job ID、attempt、nonce、期限、artifact hash 與 bounded schema，才建立 signed report；signing key 永遠不進 executor。

Executor output 全部視為 untrusted：transport 最多 1 MiB、findings 最多 200、network attempts 最多 100、單一 message/target sample 最多 2,048/256 字元、path 最多 256 字元；先限制 bytes 再 parse，接著 sanitize、dedupe、sort。Tool versions 不採信 executor 字串，由 controller 根據 immutable executor image digest/SBOM 注入。任何 schema overflow、truncation、NaN/Infinity 或未知 enum 都不可能產生 `pass`，而是終止 executor 並回報 resource/policy finding。

Hub consumer 驗證 report authenticity 後，以 `(job_id, attempt)` unique constraint、expected-state compare-and-set 與 nonce/expiry 檢查防止重放。完全相同的 queue retry 只回傳既有結果；舊 attempt、不同 artifact hash 或已結束 submission 的 report 只記 audit，不改狀態。

不得在帶有 repository/deploy secrets 的一般 GitHub Actions job 直接執行上傳內容。GitHub Actions 可測 scanner 自己的 fixtures；每次上傳的 untrusted execution 放在專用、無 secret、無網路的 sandbox。

### 6.3 資料模型不要再讓一個 status 承擔三種狀態

建議拆分：

- `game_submissions`：每次上傳 attempt；同一預定 semver 可有多次修正版。
- `game_submission_files`：quarantine inventory/hash。
- `game_scan_runs`：scanner/policy/tool version、開始/完成、report hash。
- `game_scan_findings`：finding 與 disposition。
- `game_review_requests`：開發者人工審查理由、爭議 findings、狀態。
- `game_releases`：只保存核准後不可變 release；`UNIQUE(game_id, version)` 留在這裡。

三條互相獨立的狀態：

| 軸 | 值 |
| --- | --- |
| scan | `queued` / `running` / `passed` / `flagged` / `failed` |
| review | `not_requested` / `requested` / `in_review` / `changes_requested` / `approved` / `rejected` |
| publication | `unpublished` / `publishing` / `published` / `revoked` |

不要再用單一 `blocked/pending/publishing/...` 欄位推導所有可用操作；所有 transition 經由 server-side state machine，使用 compare-and-set/lease 並寫 audit event。

### 6.4 Finding 與人工審查政策

```ts
export type FindingDisposition =
  | 'hard-block'
  | 'fix-or-manual-review'
  | 'manual-review'
  | 'info';

export interface GameScanReport {
  schemaVersion: 1;
  jobId: string;
  attempt: number;
  jobNonce: string;
  submissionId: string;
  artifactSha256: string;
  policyVersion: string;
  toolVersions: Readonly<Record<string, string>>;
  verdict: 'pass' | 'changes-required' | 'manual-review-eligible' | 'hard-block';
  findings: readonly GameScanFinding[];
  completedAt: string;
}

export interface SignedGameScanReport {
  report: GameScanReport;
  reportSha256: string;
  attestation: {
    keyId: string;
    algorithm: 'Ed25519';
    value: string;
  };
}
```

簽章輸入使用固定 canonical JSON serialization（包含 schema version、job/attempt/nonce、artifact/report hash，不含 attestation 欄位）。Hub 維護由 `keyId` 索引的 active/grace public-key registry；controller rotation 先發布新 public key，再切 signer，最後才移除過期 key。未知 key/algorithm、非 canonical payload 或驗證失敗一律不更新 submission。

不可 override 的 hard block：

- ZIP bomb、path traversal、symlink、encrypted archive，或 archive/path/filename encoding/entry inventory 無法安全正規化
- 確認的 executable/malware signature
- 超出絕對資源上限
- 入口不存在或 artifact hash/inventory 不一致

可要求人工判讀：

- 字串、教學內容或 dead code 造成危險 API 誤判
- AST 無法證明但可能安全的寫法
- 內容、授權、metadata 或框架相容性的人工判斷

「解析失敗」不能當萬用 hard block：scanner crash/timeout 是 infra `scan_failed`，可重試；parser 尚不支援但語法本身可能有效的 JavaScript 是 `changes-required` 或符合條件的 manual review。只有連 canonical file inventory、入口 HTML/text encoding 都無法安全建立的 artifact 才屬結構 hard block；即使人工審查，也不能在 parser 不理解時直接略過其他安全 gate。

人工審查不能關閉 runner 的 sandbox/CSP、不能增加 `allow-same-origin`，也不能批准實際對外通訊。override 必須綁定 finding ID、scan run、artifact hash、admin ID、理由與時間；artifact 一變更就全部失效。

### 6.5 Developer 與 Admin 介面

Developer portal 每個 submission 顯示：

- scan 階段與進度
- finding code、檔案、line/column、原因、修正範例
- 「上傳修正版」：建立新 attempt，不要求尚未發布的版本先亂升 semver
- 「要求人工審查」：只對 eligible findings 顯示，理由必填
- infra `scan_failed` 的重試，不誤標成程式有問題

Admin queue 顯示：

- artifact hash、scan/policy/tool version、歷次 attempts diff
- source viewer（純文字、CSP sandbox，不直接執行）
- 無網路動態 smoke report 與 network/navigation attempts
- 開發者 manual-review 理由
- 既有三項 publish evidence：原始碼查核、隔離試玩、公開 metadata/法規文案確認；另顯示 license/SBOM 狀態
- approve/reject/request-changes/revoke；有 hard block 時 server 端禁止 approve

後台分成三個不可混用的 queue：`ready-for-review` 只收 scan passed、`manual-review-requested` 只收開發者已提出理由的 eligible finding、`security-blocked` 只供稽核 hard block 摘要且沒有 approve action。掃描尚未結束的 submission 只顯示在 processing monitor，不提早進入內容審核。

Source viewer 必須把內容當資料：API 回 `text/plain; charset=utf-8` 或 JSON string、加 `X-Content-Type-Options: nosniff`，前端只用 `textContent`/會 escape 的 code renderer，禁止 `innerHTML`、`dangerouslySetInnerHTML`、blob HTML preview。隔離試玩只能在無 Hub cookie/credential 的 disposable browser profile 或專用 review origin 進行；quarantine HTML 永不在 Hub/Admin origin 執行，也不能讓公開 `usergamerunner` 取得 quarantine binding。

公開 catalog 必須把 developer game 標成「第三方／社群遊戲」與 `client_reported` 成績；不得暗示平台或職能治療師驗證療效。疾病、治療、改善功能等文案沿用 repo 的台灣醫療與職能治療法規限制。

### 6.6 絕對零外傳的產品選項

目前 arbitrary HTML tier 可以做到非常強的降低風險，但不能誠實承諾絕對零外傳。若這是產品不可妥協條件，新增第二種格式：

1. **Declarative therapist game（建議給一般治療師）**：JSON/schema + 平台內建 trial/plugin + 本地資產，不允許自訂 JavaScript。平台生成 timeline 與 HTML；可以建立更強的 capability 與 egress 保證。
2. **Reviewed developer HTML（進階）**：維持 separate-domain sandbox、CI 與人工審查，標明 residual risk，不收集個資、不開 camera/microphone。
3. **Remote isolated HTML（高成本選配）**：任意程式只在遠端無網路瀏覽器執行，client 接收畫面/輸入通道；安全較強，但延遲、成本、無障礙、離線 PWA 與遊戲手感都會受影響。

Steam 式平台可同時有兩個 tier；不應為了相同 UI，假裝它們具有相同信任等級。

## 7. 共用管理與防止散落硬編碼

| 類型 | 單一來源 | 自動 gate |
| --- | --- | --- |
| 遊戲 ID、purpose、route、copy key、capability | module manifest + generated registry | manifest schema、duplicate ID、route/PWA generation test |
| jsPsych/SDK/runtime version 與 URL | build 產生的 platform runtime contract | lockfile/package version/hash parity |
| game status/transition | dependency-free contract + server transition service | invalid transition/property tests |
| upload limit/scanner policy | versioned server policy module | fixtures、policy snapshot、不能由 client 放寬 |
| official/third-party iframe permissions | 分離的中央 iframe policy generators | capability allow/deny browser test；禁止 module 自訂 token |
| validator evidence limits/attestation | controller policy + public-key registry | bounded schema、replay、rotation、unknown key/algorithm rejection |
| 顏色/間距/字型 | CSS theme tokens | authored CSS hard-coded color check；renderer 刺激色例外需 manifest 宣告 |
| 文案 | i18n dictionaries / catalog copy keys | zh/en parity；禁止 component 內 `lang ? '...' : '...'` |
| site/runner/asset origin | validated environment + `siteUrls`/asset registry | production origin/CSP/CORS tests |
| dependency graph與離線資產 | bundler-generated manifest | entry graph、chunk budget、offline closure test |
| storage namespace | module/domain manifest + migration map | namespace collision/legacy migration tests |

優先處理目前明顯重複：四類 trainer array、release status unions、jsPsych/SDK URL、result limits、runtime IDs、catalog/PWA mapping，以及 `ModulePage.tsx` 中的 inline 中英文字串。

## 8. pnpm 原子遷移

這是 Phase 0，需先完成才新增任何套件。

1. 以 root `packageManager` 的 exact pnpm 版本為唯一版本；開發環境與 CI 明確 provision，不依賴機器剛好有 global pnpm。啟動後先 assert `pnpm --version === 11.24.0`。
2. 以 `pnpm-workspace.yaml` 宣告 `apps/*`、`packages/*`，workspace package 一律使用 `workspace:*` 或明確 workspace range。
3. 只保留 `pnpm-lock.yaml`，CI 使用 `pnpm install --frozen-lockfile`。
4. root scripts 內的 `npm run` 改成 `pnpm run`；app 指令優先使用 `pnpm --filter <package> <script>`。
5. `scripts/build-apps.mjs` 不再 spawn npm，改呼叫 pnpm/filter 或直接以 Node API 執行明確 build task。
6. 兩份 workflow 同步改 pnpm cache、install 與 matrix command；`package-lock.json` path filter 改 `pnpm-lock.yaml` 與 `pnpm-workspace.yaml`。
7. README、AGENTS、部署文件、錯誤提示與 repository settings 同步改成 pnpm。
8. Dependabot 的 `package-ecosystem: npm` 是 GitHub 對 JavaScript registry 的名稱，可保留；但 lockfile/path 與 grouping 要驗證 pnpm。
9. pnpm 11 的非 registry/auth project settings 以 `pnpm-workspace.yaml` 為準；不要同時在 `.npmrc` 重複 `nodeLinker` 等設定。
10. `allowBuilds` 與 legacy `onlyBuiltDependencies` 選一份受測的 canonical policy；預設拒絕未核准 dependency install scripts。
11. `.node-version`、`engines.node` 與 CI 對齊為 Node 24.20.0。`.node-version` 是版本單一來源，架構 gate 會驗證 root `engines.node` 為對應的 `>=24.20.0 <25` 範圍。若工作 shell 不是這個 pinned Node 版本，不能拿該 shell 的結果當 migration 驗收。
12. 因此 repo 曾為無 symlink 環境設定特殊安裝模式，先保留 hoisted/copy 相容策略，並以 `dedupeInjectedDeps: false` 避免 injected workspace dependency 去重時退回 symlink；另在標準 Linux CI 加一個 dependency declaration audit，防止 hoist 掩蓋 undeclared dependency。
13. 兩份 GitHub workflow 以 pinned commit SHA 的 `pnpm/action-setup` 讀取根 `package.json` 的 `packageManager`（唯一 pnpm 版本來源），再由 pinned `actions/setup-node` 讀 `.node-version` 並啟用 pnpm cache；隨後才跑 frozen install。Cloudflare Pages 正式部署沿用該 GitHub job build 完的 artifact + Wrangler，不讓 dashboard 再執行另一套 install；若保留 direct preview build，也必須使用相同 Node/pnpm pin 與 frozen lock。

本機 bootstrap 只負責安裝 package-manager executable：Node 24 環境優先使用其支援的 Corepack；若該發行版未附 Corepack，使用 pnpm 官方 standalone/toolchain 安裝方式取得 exact 11.24.0。完成後所有 workspace dependency 安裝、更新、script 與 filter 操作都只用 pnpm，不用 npm 產生或改 lockfile。

標準命令目標：

```powershell
pnpm install --frozen-lockfile
pnpm run test:entrypoints
pnpm --filter @rehab-trainer/rehabtrainerhub build
pnpm --filter @rehab-trainer/usergamerunner test
pnpm run build:cloudflare
```

## 9. 逐步實作清單

每個可完整驗收的 phase/vertical slice 使用獨立 PR；先平行建立新路徑，再切流量，最後刪舊路徑。Phase 0 的 package-manager、lockfile、scripts、CI/CD 與文件切換例外地必須在同一個原子 PR 完成，不能拆成會留下 npm/pnpm 混合狀態的多個 PR。

### Phase 0：鎖定基線與 pnpm

- [x] 完成第 8 節所有 package manager、CI/CD 與文件切換。
- [ ] 在乾淨 checkout 執行 frozen install、全部現有 gates 與 Cloudflare build（本機已完成 pnpm 11.24 frozen install、Hub/Runner build 與靜態 gates；仍待一次完整 Cloudflare build 驗收）。
- [x] 記錄四個 runtime entry/chunk/PWA precache baseline 與各大型 asset bytes（`docs/runtime-baseline.json`；不記錄 hashed filename）。
- [x] 暫時禁止新增新的 category runtime utility/re-export。
- [x] 建立 ADR：任意 HTML residual risk、兩種 upload tier、CDN policy、PWA offline 定義。

驗收：repo 中除歷史說明外沒有 install/build 指令使用 npm；CI 與本機只接受 `pnpm-lock.yaml`。

### Phase 1：Dependency-free contracts 與 generated registry

- [x] 新增 `packages/training-contracts`，不得依賴 React、jsPsych 或 renderer。
- [x] 定義 manifest、config validation、run result、asset、lifecycle 與 message schemas。
- [x] 先由既有 catalog/flow seed 產生 validated module manifest 與 registry；後續仍需將 catalog seed 完全反向聚合至 manifest。
- [x] 由 manifest 產生完整 host registry、official PWA metadata、record allowlist 與測試清單（`trainingModuleRegistry`；catalog launch URL 直接讀 registry）。
- [x] 把 game capability、jsPsych/SDK runtime version、上傳大小上限從 scanner/runner/developer UI 的複本移至 renderer-independent contract；trainer IDs 與 PWA closure 仍待後續切片。
- [x] 加入 circular dependency 與 forbidden import gate（`test:architecture`）。

驗收：新增 fixture module 只新增一個 module directory，即可自動出現在測試 registry；缺任何 contract 欄位會 build fail。

### Phase 2：單一 official-training-host

- [x] 建立輕量 host：route、embedded protocol、locale、display settings、error boundary、fullscreen target。（目前 route 與 typed protocol 已完成；locale/display settings 仍由相容 runtime 提供。）
- [x] Hub shell 在 rules-visible 建立 fresh host iframe，透過 typed envelope 驅動 module run handle；離開後移除 document。（Hub overlay 已完成 fresh host iframe、legacy `prepare` 相容橋接，以及 10 個目標模組與 Every Ball 的 native setup host 切片。）
- [ ] 單一遊戲 PWA 在 rules-visible 使用同一份 fresh host／typed envelope 並完成完整 browser lifecycle（目前仍待部署後驗收）。
- [x] 建立 manifest capability -> Permissions-Policy/iframe allow/fullscreen/referrer 的中央 policy generator；官方與第三方 iframe component 分離。
- [x] Host 僅 dynamic import setup；entry graph 禁止所有 heavy packages。（10 個目標模組與 Every Ball setup 已由 registry/factory 動態載入並通過 static heavy-import gate；其餘 brain legacy adapter 保留在相容 iframe 路徑。）
- [x] 先用一個低風險 module 做 shadow route/parity。（全 catalog 目前先經相容橋接，尚未切除舊 runtime。）
- [x] 保留舊 `/runtimes/{trainer}/` deep link adapter，不立刻刪除（`BuildLegacyTrainingModuleHref` 僅供 official host 相容橋接；不得成為新入口）。
- [x] 將 settings/records/i18n ownership 從 runtime 搬到 module 或 `packages/ui`，消除 module -> runtime re-export。四類 module 現在保有 canonical settings/records/i18n/asset helpers，category runtime 僅透過 `@rehab-trainer/hub-modules/*` 相容匯出；shared shell 元件仍放 `packages/ui`。

驗收：依賴圖只有 `host -> module -> contracts/ui`；module source 不再引用 `training-runtimes`；host entry 不含 `initJsPsych` 且連續兩局的 `Window/jsPsych/renderer` identity 全部不同；未宣告 camera/microphone/fullscreen 的 iframe browser test 均被拒絕。

### Phase 3：Rules-visible loading boundary

- 本輪已先完成 Vision vertical slice：`CreateSingleFlightPreloadCache` 將同一 module 的 rules-visible preload 合併為單一 promise，離開/換模組時以 `AbortController` 清理 Pixi warmup；WebGazer script loader 也支援 abort 與 script node cleanup。四個 Vite runtime 現在輸出 `.vite/manifest.json`，Hub build 會執行 `check-runtime-build-manifest.mjs`，驗證 root entry 的 static closure 不含 heavy chunk。10 個目標模組與 Every Ball 已建立 module-owned setup/engine boundary；仍有 component 內部的 jsPsych 實例與 brain legacy adapter 待後續收斂，且尚未完成瀏覽器 network test。

- [x] 每個遊戲拆成 manifest/config/rules/setup 與 engine 兩個 chunk boundary。（Vision moving/oculomotor/gabor/reading、Brain UFOV/Every Ball、Motor drawing/asteroid/gesture/motor-cortex 與 Mouth Tongue Catch 已完成 setup factory + engine boundary；單一 PWA browser boundary 尚待部署驗收。）
- [x] Selection card 的 hover/focus/touch 不再觸發 runtime preload；card 只負責圖片與 setup UI。
- [x] 現有 Vision/UFOV config 在 rules-visible transition 才以單一 promise 觸發 engine preload（正式 module `loadEngine({ trigger: 'rules-visible' })` 已由 shared setup factory 實作；其餘 legacy module 仍待切換）。
- [x] 返回/離開用 AbortController；重複開關規則不得建立第二份 engine（`CreateSingleFlightPreloadCache` 擁有每次 preload 的 controller，rules cleanup/模組切換會 clear/dispose；跨頁完整瀏覽器驗收仍待執行）。
- [x] 加入 build-manifest assertion：規則前不得把 heavy chunks/models 放入 root static closure。（Hub build 會執行 `check-runtime-build-manifest.mjs`、`check-bundle-budgets.mjs --require-output` 與 `check-native-setup-types.mjs`；CI 的 source gate 由 `test:bundle-budgets` 執行。）
- [ ] 執行 Playwright network test：規則前不得請求 heavy chunks/models。（`scripts/check-official-game-pwa-browser.mjs` 已提供部署後 network gate，但目前環境沒有 Playwright/browser，尚待部署執行。）
- [x] camera/microphone preflight 後立即 stop；實際 stream 只在 trial start 存活（共用 preflight 與 `test:media-lifecycle`）。

驗收：除使用者明確發起、只寫 cache 的 offline pack download 外，10 個目標遊戲在 card/config 階段都沒有 jsPsych/Pixi/Three/MediaPipe/TF/WebGazer network request、module execution 或 instance。

### Phase 4：jsPsych native plugin 收斂

- `drawing-defense`、`gesture-battler`、`motor-cortex-rehab`、`asteroid-shield` 與 `tongue-catch` 已完成 native lifecycle scaffold；plugin 只呼叫 module-owned `on_start` 並以 `finishTrial`/`abortExperiment` 由 component 結束，不保存 Pixi、pointer、model、stream 或 game state。每個 plugin 的 start/error/stale-run 行為已由 `test:training-lifecycle` 覆蓋；其餘認知模組仍維持相容 adapter。

- [x] 先轉 `drawing-defense`，建立可複用但不持有 renderer state 的 plugin scaffold（Pixi/input/game state 仍由 module component 擁有）。
- [x] 依序轉 `gesture-battler`、`motor-cortex-rehab`、`asteroid-shield`。
- [x] 最後轉 `tongue-catch`，特別驗證 TF tensor/classifier、MediaPipe 與 stream cleanup。
- [x] 保留 Vision 四遊戲與 UFOV native timeline，改用統一 contract/summarizer。（Vision 四遊戲與 UFOV 均由 module-owned setup/engine 產生統一 `TrainingRunResult`，並由紀錄層驗證保存；Hart/Driving 仍依 exemption。）
- [x] Hart/Driving 標為本輪 exempt；不得成為新遊戲範本（flow manifest 有明確 `hart-chart`／`driving-simulation` exemption metadata，且架構測試鎖定）。
- [x] 將目前 token-presence test 升級成 lifecycle 行為測試：start/finish/abort/unmount/error/dispose（native plugin start/error/stale 與 adapter finish/abort/dispose）。
- [x] custom plugin 實作 data-only simulation，讓 trial/result schema 可在 CI 快速驗證（不啟動 renderer、模型或媒體；fixture identity 由共用 helper 覆寫並鎖定）。

驗收：目標 10 個 manifest 全為 `native-timeline`；external adapter 只剩明確 exempt 或非本次 brain legacy modules，並有移除期限/owner。

### Phase 5：PWA 與資產供應

- [x] root service worker 改為 shell-only precache（排除 runtimes、games、runtime-assets、offline-manifests、模型/WASM/3D 資產，並設 8 MiB shell budget）。
- [x] build 產生每個 module 的 dependency closure/offline manifest（官方遊戲 PWA 會從 Vite manifest 產生 module closure、逐檔 SHA-256 與 bounded offline manifest；不把 category runtime 的其他遊戲 dynamic imports 帶入）。
- [x] 建立 origin-wide `OfflinePackManager`、pack reference set、staging/ready transaction、lease、reconcile/GC、IndexedDB 持久化 fallback 與 immutable URL 衝突檢查（`packages/ui/src/offlinePackManager.ts`；完整 UI 與瀏覽器端驗收仍待後續切片）。
- [x] 新增離線下載、進度、容量、完整性、更新與移除 UI（共用 `OfflinePackControl` 僅在使用者按下離線下載時讀取 `latest.json`，並交由 origin-wide `OfflinePackManager` 驗證與安裝）。
- [x] 將 public CDN fallback 從 production resolver 移除（只保留平台控制的同源/版本化資產路徑）。
- [x] 內建 Drawing Defense 不再由瀏覽器自動上傳筆跡影像或參與者識別資料；以 `test:training-privacy` 鎖定無外傳 API 的回歸邊界。
- [x] 把 WebGazer/MediaPipe/model 資產移至平台控制的 immutable version path（同源 `/runtime-assets/*` 唯讀 route + R2 manifest；production resolver 不接受外部 asset base，`AI_ASSET_BASE_URL` 僅供 R2 驗證／部署工具）。
- [x] Hub build 在產生官方 PWA 後執行產物完整性 gate（同源資源、manifest／Service Worker scope、offline closure SHA-256、R2 runtime asset descriptor 與 immutable/latest 一致性）；Service Worker 安裝期不請求 offline manifest，只有明確下載訊息才會 staged 驗證並快取，fetch cache 也限制在遊戲 scope 與平台資產 prefix。
- [ ] 針對 fresh install -> airplane mode 做每遊戲 browser test。（`scripts/check-official-game-pwa-browser.mjs` 支援 `OFFICIAL_GAME_PWA_GAME_IDS` 逗號清單，會對每個 scope 驗證 Service Worker 啟用、明確下載並完成離線包交易，再以同一 profile 斷網開新頁確認遊戲可啟動；仍需在具瀏覽器的 CI/驗收環境逐一執行並保留離線結果。）
- [x] 驗證舊 offline cache migration，不要誤刪其他遊戲 scope（`MigrateLegacyOfflineCache` 只接受明確的 v0 cache + manifest，並以契約測試確認不會刪除其他 scope；fresh-install/airplane browser test 仍待部署環境驗收）。

驗收：Hub 首訪不再 precache 全部遊戲；已標示「離線可用」的單一遊戲可在全新離線 session 啟動並完成/儲存當次紀錄；移除 A 不會刪除仍被 B 引用的共用 asset。

### Phase 6：非同步 game validator

目前 intake 會在 quarantine 後以同一個 batch 寫入 submission、scan run、finding 與 audit provenance；同步 scanner 仍是 request 內的第一道 fail-fast。已補上 bounded queue/result envelope、controller attestation 驗證、報告 ledger 與 CAS 套用介面；正式 Queue/controller/executor 的部署綁定仍未啟用，因此不可把同步結果宣稱為完整 malware CI。

- [x] 新增 additive D1 migration，拆開 submission、scan run、review request、release；目前仍保留舊同步 release flow 作相容遷移層。
- [x] Hub intake 寫 quarantine 與 enqueue；request 不等待完整 CI（未設定 Queue binding 時維持同步 fail-fast，設定後回傳 `202`；正式 controller/executor 部署仍是環境工作）。
- [ ] 建立可信 controller 與無 secret、無 Internet、有限資源的 disposable executor；只有 controller 持有專用 attestation key（已加入 read-only controller、bounded disposable-executor contract 與 Ed25519 signer library；正式隔離 Worker/VM、資源限制與部署 attestation key 仍待環境接線）。
- [x] 加入 JavaScript parser/AST 結構檢查、high-signal malware signature corpus 與 framework contract（`acorn` pinned static pass、syntax/dynamic import findings）；dynamic smoke executor 仍待隔離部署。
- [x] scan report 綁 job ID/attempt/nonce/expiry/artifact hash/policy/tool versions；Hub 已提供 controller attestation、bounded result envelope 與一次性 ledger/CAS consumer，正式 controller/result queue 部署仍待環境接線。
- [x] 所有 queue job 以 unique key + compare-and-set 保持 idempotent；timeout/infra failure 會標記可重試的 failed 狀態，stale/replayed report 不改狀態（實際 queue retry/backoff 仍由 controller deployment 提供）。
- [x] 保留現有同步 scanner 作第一道 fail-fast，不把它稱為完整 security boundary；新增獨立狀態 contract/gate 防止 hard-block 被發布。

驗收：惡意 fixture 無法連網、讀到 secret 或寫 release bucket；相同 job 重送不會產生兩份 release/status transition。

### Phase 7：Developer/Admin workflow

目前已完成 finding 詳細列表、eligible manual-review request、管理員 validation queue、三項 evidence、source viewer、bounded source/inventory diff、attested dynamic report、通知、bounded retention/reconciliation endpoint 與 public report moderation；scheduler 綁定與 publisher profile 仍待後續切片。

- [x] Developer 顯示 finding 細節、沿用上傳入口修正重送，並提供 eligible manual review request。
- [x] 將修正版重送升級為明確的 attempt/history UI，避免同一 target semver 與舊 evidence 混用。
- [x] 同一 target semver 支援多個未發布 attempts；公開版本仍 immutable unique。
- [x] Admin 顯示送審原始檔下載、scan provenance、validation queue 與 evidence checklist。
- [x] 補上 source viewer、同一 target semver 的 bounded source/inventory diff 與 controller dynamic report；內容以純文字呈現、network attempts 綁 attested report，server 端已禁止 hard-block approve，manual-review request/decision 與逐 finding override evidence 已寫 audit／D1。diff 對大型/二進位檔只回 hash，不執行 HTML。
- [x] 增加 request-changes/reject/revoke 通知與 retention/reconciliation library/endpoint（通知資料表、寫入與開發者讀取、protected-state cleanup、bounded orphan R2 inventory pass 已完成；正式 scheduler 綁定仍待部署）。
- [x] 公開 catalog 加第三方／社群標示、`client_reported` 信任說明、共用 license metadata、檢舉與管理員處理入口及公開 metadata/法規文案 gate；publisher profile 與逐行 source diff 仍待後續切片。

驗收：開發者能完成「被判定 -> 看懂原因 -> 修正重送」或「說明誤判 -> 人工審查」閉環；任何 artifact 改變都使舊 scan/review evidence 失效。

### Phase 8：切換與刪除 category runtimes

- [x] 全 catalog launch URL 切到 official host（Hub lobby/overlay 與 progress deep link 均透過 `/train` 或 registry 產生的 `/official-training-host/{domain}/{slug}/`；`/runtimes/*` 僅保留相容 adapter）。
- [x] official per-game PWA 改由 module-owned flow manifest 的 runtime asset groups + Vite manifest dependency closure 生成；AI/WASM/WebGazer/3D 資產以同源 hash descriptor 納入 offline manifest。
- [x] 建立 Hub overlay、單一 PWA、deep link、歷史紀錄與 storage migration 的靜態整合契約（`test:training-integration`）。
- [ ] 在部署環境驗證上述流程的真實 browser 行為（官方 PWA browser gate 可用 `OFFICIAL_GAME_PWA_GAME_IDS` 涵蓋多個 fresh page／Service Worker／offline shell；真實 Hub overlay、deep link、歷史紀錄與 storage migration 仍待執行）。
- [ ] 更新所有 scripts、R2 asset source path、browser tests 與文件。（PWA/整合/離線與 deployment-only browser scripts、R2 manifest checks、部署文件已同步；category runtime asset source 與實際 browser/部署驗收仍隨 runtime roots 切除處理。）
- [x] 依現行架構保留四個 `training-runtimes/{trainer}` Hub same-origin build roots；它們不是獨立網站，退役 hostname 僅保留 301/route adapter。
- [x] 不重新建立已退役的 trainer hostname、manifest、canonical 或 sitemap（僅保留明確 301 redirect、migration 與部署清理測試；架構 gate 會阻擋新的公開入口）。

驗收：build 不再 loop 四個 trainer；刪除任一類別 shell 不影響其他 module，且所有正式遊戲仍可獨立安裝/執行。

## 10. 測試與部署 gates

沿用既有 gate，命令完成 pnpm 遷移後為：

```powershell
pnpm run test:naming
pnpm run test:training-flow
pnpm run test:assessment-lifecycle
pnpm run test:entrypoints
pnpm run test:media-lifecycle
pnpm run test:runtime-build-manifest # after pnpm run build:hub
pnpm run test:i18n
pnpm run test:pwa
pnpm run test:game-platform
pnpm run test:hub-functions
pnpm run test:gamerunner
pnpm run test:cloudflare-deploy
pnpm run test:seo
pnpm run build:hub
```

新增 gates：

- `test:training-contracts`：manifest/schema/registry/transition/property tests
- `test:training-integration`：catalog、official host、單一遊戲 PWA、進度 deep link 與 storage migration 的靜態整合契約
- `test:training-protocol`：iframe handshake、command correlation/timeout/replay、所有 async state abort/fail/dispose、capability permission denial（已成為 root script，並由 CI matrix 執行）
- `test:heavy-load-boundary`：card/config/rules preload 邊界與 host entry heavy-import 靜態 gate
- `test:media-lifecycle`：共用 media permission preflight 與實際 stream start/stop 邊界
- `test:training-lifecycle`：五個 custom native plugin、既有 adapter 與 shared component training engine 的 start/abort/finish/dispose 行為；component setup 的型別、heavy-import 與 host callback 邊界由 `test:training-contracts` 與 `test:heavy-load-boundary` 鎖定
- `test:training-privacy`：內建訓練不得從瀏覽器自動上傳筆跡、影像或參與者識別資料
- `test:heavy-load-boundary`：規則前 network/import graph 不含 heavy dependency
- `test:runtime-build-manifest`：每個 Vite runtime 的 root static closure、dynamic entry 與 asset path
- `test:bundle-budgets`：entry、setup、engine、asset closure 與 root precache budget（`scripts/check-bundle-budgets.mjs` 先驗證 source contract；有 build output 時可用 `--require-output` 加強）
- `test:offline-packs`：fresh-cache offline browser、shared-asset reference/GC、concurrent install/remove（靜態 manager/asset gate 已可在 CI 執行；browser 部分仍由部署 gate 執行）
- `test:game-validator`：malicious corpus、false-positive corpus、idempotency、nonce/replay/attestation、no-egress
- `test:game-review-security`：source viewer escaping/nosniff、Hub origin 不執行 quarantine、review profile 無 credential（已成為 root script，並由 CI matrix 執行）
- `test:pnpm-policy`：frozen lock、workspace protocol、approved build scripts、undeclared dependency
- `test:architecture`：module/runtime ownership、jsPsych lifecycle 宣告、official/third-party iframe policy、PWA scope、game validation 狀態軸與 pCloud 安裝不變量

`test:architecture` 是不依賴網路與 build output 的靜態架構 gate；它允許清單內既有
legacy adapter 以維持遷移相容性，但禁止新模組加入 adapter。它不把同步 intake
scanner 當成完整 malware CI，也不取代 Phase 3/4 的 heavy dependency graph、offline
closure 與 native lifecycle 行為測試。

Asteroid Shield、fullscreen 或 Pixi canvas 尺寸變更仍至少執行 `test:entrypoints` 與 `build:hub`。Game platform schema/scanner/runner 變更至少執行 game-platform、Hub Functions、gamerunner、Cloudflare deploy 與 SEO/noindex 驗證。

## 11. 完成定義

架構優化完成需同時滿足：

- 10 個指定模組由 jsPsych native plugin/timeline 擁有生命週期。
- card/config 階段不下載或初始化任何 heavy engine；規則顯示是唯一 engine preload trigger。使用者明確發起且只驗 hash/寫 cache 的離線包下載是唯一例外。
- 每個 run 都在 fresh iframe realm 內由 module run handle 擁有 renderer/model/jsPsych/media state；host 不直接操作 jsPsych，退出後移除 document 並使資源為零存活。
- Iframe handshake/command ack 可關聯且可 timeout；Permissions Policy 只由中央 capability policy 產生，未宣告權限為 explicit deny。
- module 不再 import/re-export category runtime；Hub 不複製 config/defaults/validation/rules。
- 新遊戲只新增 module manifest/setup/engine/test，不修改 Hub route switch 或四類 runtime list。
- Root PWA 不再全量下載所有遊戲；單一離線包可驗證完整性與實際離線啟動。
- 公用第三方 CDN 不在 production runtime fallback chain。
- 上傳 artifact 先 quarantine、再完成可追溯的小 CI、再出現在相符的 Admin queue。
- Developer 有修正 attempt 與 manual-review request；hard block 不可 override。
- 不向外宣稱 scanner/CSP 能保證任意 JavaScript 絕對無病毒或絕對零外傳。
- Repo、CI/CD、Cloudflare 與文件只使用 pnpm frozen lock workflow。

## 12. 需要產品/技術共同確認的決策

開始實作前只需要確認五件事：

1. **安全承諾**：接受「reviewed arbitrary HTML + residual risk」，或要求絕對零外傳並優先做 declarative therapist format？建議兩個 tier 並存，治療師預設 declarative。
2. **Runtime 方向**：是否同意「刪四個 category shell，但保留每局 fresh iframe 的單一 official host」？這同時保住 lifecycle realm 邊界與共用 shell，是本文件建議方案。
3. **離線語意**：是否同意 PWA 安裝只裝 shell，遊戲另按「下載離線版」？這可避免目前約 42.62 MiB 的無差別 precache。
4. **Manual review 邊界**：是否同意只有誤判/不確定 finding 可人工覆核，確認 malware/結構攻擊不可放行？這是必要安全底線。
5. **CI 執行成本**：動態 smoke 採 Cloudflare Container/Sandbox、其他專用 sandbox，或第一版只做 static + malware、人工 isolated play test？介面應先抽象，部署可分期。

## 13. 技術依據

- jsPsych 8 custom plugin 的 `trial()` 應以 `finishTrial()` 或 async return 結束，並可在 async loading 完成後呼叫 `on_load`：<https://www.jspsych.org/v8/developers/plugin-development/>
- PWA 的 service worker install 與 PWA 安裝不是同一事件；大型資產適合由使用者明確要求後再加入 Cache：<https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching>
- pnpm workspace 必須有 root `pnpm-workspace.yaml`，workspace dependency 可用 `workspace:` protocol：<https://pnpm.io/workspaces>
- pnpm 11 的 project settings 以 `pnpm-workspace.yaml` 為主，`.npmrc` 只處理 registry/auth：<https://pnpm.io/settings>
- Cloudflare Container 可用 deny-by-default 的 outbound policy；若採用此實作，validator 必須設定無 Internet 並且不持有 production secrets：<https://developers.cloudflare.com/containers/platform-details/outbound-traffic/>
- Cloudflare Workers Web Crypto 支援 Ed25519 sign/verify；實作仍需固定 canonical payload 與 key rotation policy：<https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>
本輪新增 gate：`test:media-lifecycle` 驗證共用 camera/microphone preflight 會立即停止權限探測 stream，module 的實際 stream 只在 jsPsych run 後建立並於 dispose 停止；`test:runtime-build-manifest`（由 `build:hub` 在 runtime build 後執行）驗證 Vite root static closure 不含 heavy chunk，並檢查 dynamic module asset path 與 manifest 完整性。

## 2026-08-30 更新：一般本機磁碟 pnpm 策略

專案已移至一般本機磁碟，不再採用 pCloud 的無 symlink 相容層。現行 canonical 設定是 pnpm 11.24.0、`nodeLinker: isolated`、`packageImportMethod: auto`、workspace symlink，以及 `pnpm install --frozen-lockfile`。`scripts/check-pnpm-policy.mjs` 取代舊的 pCloud 檢查；舊 pCloud 段落僅保留為歷史背景，不再是安裝或 CI 契約。
