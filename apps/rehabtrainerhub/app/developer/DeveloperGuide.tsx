'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useHubLanguage, type HubLanguage } from '../i18n/HubLanguage';
import { GetDeveloperCopy } from './developerCopy';

const repositoryUrl = 'https://github.com/ian030590/RehabTrainerHub';
const codexGuideUrl = 'https://learn.chatgpt.com/docs/codex/cli';

const repositorySetup = `git clone ${repositoryUrl}.git
cd RehabTrainerHub
npm ci --workspaces --include-workspace-root`;

const codexInstall = `npm install -g @openai/codex
codex --version`;

const codexStart = `cd path/to/your-game
codex`;

const packageTree = `index.html
settings.json
game.js
styles.css
assets/
  stimulus.png
  correct.wav`;

const settingsExample = `{
  "schemaVersion": 1,
  "gameId": "target-selection",
  "sections": [
    {
      "id": "activity",
      "title": {
        "zh-TW": "活動設定",
        "en": "Activity settings"
      },
      "fields": [
        {
          "key": "rounds",
          "type": "slider",
          "label": {
            "zh-TW": "回合數",
            "en": "Rounds"
          },
          "default": 20,
          "min": 5,
          "max": 40,
          "step": 5,
          "unit": {
            "zh-TW": "回合",
            "en": "rounds"
          }
        },
        {
          "key": "soundEnabled",
          "type": "checkbox",
          "label": {
            "zh-TW": "聲音回饋",
            "en": "Sound feedback"
          },
          "default": true
        }
      ]
    }
  ]
}`;

const scoreExample = `{
  "schema": "rehab-trainer.game-score/v1",
  "gameId": "target-selection",
  "presentation": {
    "primarySummaryKeys": ["accuracy", "medianResponseMs"],
    "qualitySummaryKeys": ["omissions"],
    "defaultRoundMetricKey": "responseMs",
    "chartType": "line"
  },
  "columns": [
    {
      "key": "correct",
      "label": { "zh": "正確", "en": "Correct" },
      "sources": ["correct"]
    },
    {
      "key": "responseMs",
      "label": { "zh": "反應時間", "en": "Response time" },
      "sources": ["responseMs"],
      "unit": "ms"
    }
  ],
  "summary": [
    {
      "key": "accuracy",
      "label": { "zh": "正確率", "en": "Accuracy" },
      "sources": ["accuracy"],
      "unit": "%"
    },
    {
      "key": "medianResponseMs",
      "label": { "zh": "反應時間中位數", "en": "Median response time" },
      "sources": ["medianResponseMs"],
      "unit": "ms"
    },
    {
      "key": "omissions",
      "label": { "zh": "遺漏次數", "en": "Omissions" },
      "sources": ["omissions"]
    }
  ]
}`;

const runtimePaths = `/runtime/jspsych-8.2.3.js
/runtime/jspsych-8.2.3.css
/runtime/trainerhub-game-sdk-0.1.0.js`;

const sdkExample = `<link rel="stylesheet" href="/runtime/jspsych-8.2.3.css" />
<script src="/runtime/jspsych-8.2.3.js"></script>
<script type="module">
  import { RunTrainerHubJsPsychGame }
    from '/runtime/trainerhub-game-sdk-0.1.0.js';

  async function startGame() {
    await RunTrainerHubJsPsychGame({
      initJsPsych: jsPsychModule.initJsPsych,
      timeline(settings) {
        return buildTimeline(settings);
      },
      summarize(jsPsych) {
        const trials = jsPsych.data.get();
        return {
          status: 'completed',
          score: trials.filter({ correct: true }).count(),
          trialCount: trials.count(),
          metrics: {
            median_response_ms: trials
              .select('responseMs')
              .median(),
          },
        };
      },
    });
  }

  void startGame();
</script>`;

const validationCommands = `npm run test:game-platform
npm run test:game-architecture
npm run test:embedded-training
npm run test:entrypoints
npm run build:hub`;

interface DeveloperGuideProps {
  children: ReactNode;
}

export function DeveloperGuide({ children }: DeveloperGuideProps) {
  const { language } = useHubLanguage();
  const copy = GetDeveloperCopy(language);

  return (
    <>
      <header className="developer-hero">
        <div>
          <p className="page-kicker">{copy.header.kicker}</p>
          <h1>{copy.header.title}</h1>
          <p>{copy.header.intro}</p>
        </div>
        <dl className="developer-hero-meta">
          <div>
            <dt>Contract</dt>
            <dd>{copy.header.version}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{copy.header.scope}</dd>
          </div>
        </dl>
      </header>

      <div className="developer-docs-layout">
        <aside className="developer-docs-sidebar">
          <p>{copy.onThisPage}</p>
          <nav aria-label={copy.navigationLabel}>
            <ol>
              {copy.nav.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#${id}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="developer-docs-content">
          <DocSection eyebrow={copy.overview.eyebrow} id="overview" title={copy.overview.title}>
            <p className="developer-docs-lead">{copy.overview.body}</p>
            <div className="developer-route-grid">
              {copy.overview.routes.map((route) => (
                <article key={route.number}>
                  <span className="developer-route-number">{route.number}</span>
                  <h3>{route.title}</h3>
                  <p>{route.body}</p>
                  <small>{route.detail}</small>
                </article>
              ))}
            </div>
            <Callout icon="clinical_notes">{copy.overview.notice}</Callout>
          </DocSection>

          <DocSection eyebrow={copy.quickStart.eyebrow} id="quick-start" title={copy.quickStart.title}>
            <p className="developer-docs-lead">{copy.quickStart.intro}</p>
            <ol className="developer-step-list">
              {copy.quickStart.steps.map(([title, body], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <h3>{copy.quickStart.installTitle}</h3>
            <p>{copy.quickStart.installNote}</p>
            <CodeBlock label="Terminal">{repositorySetup}</CodeBlock>
          </DocSection>

          <DocSection eyebrow={copy.aiAgent.eyebrow} id="ai-agent" title={copy.aiAgent.title}>
            <p className="developer-docs-lead">{copy.aiAgent.body}</p>
            <a className="developer-external-link" href={codexGuideUrl} rel="noreferrer" target="_blank">
              <span className="developer-native-icon" aria-hidden="true">↗</span>
              {copy.aiAgent.officialLink}
            </a>
            <div className="developer-code-pair">
              <div>
                <h3>{copy.aiAgent.npmTitle}</h3>
                <CodeBlock label="Terminal">{codexInstall}</CodeBlock>
              </div>
              <div>
                <h3>{copy.aiAgent.runTitle}</h3>
                <CodeBlock label="Terminal">{codexStart}</CodeBlock>
              </div>
            </div>
            <ul className="developer-check-list">
              {copy.aiAgent.notes.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </DocSection>

          <DocSection eyebrow={copy.architecture.eyebrow} id="architecture" title={copy.architecture.title}>
            <div className="developer-flow" role="img" aria-label={copy.architecture.flow.join(' → ')}>
              {copy.architecture.flow.map((item, index) => (
                <div key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
            <p className="developer-docs-lead">{copy.architecture.body}</p>
            <h3>{copy.architecture.boundaryTitle}</h3>
            <dl className="developer-definition-list">
              {copy.architecture.boundaries.map(([term, description]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </DocSection>

          <DocSection eyebrow={copy.package.eyebrow} id="package" title={copy.package.title}>
            <p className="developer-docs-lead">{copy.package.body}</p>
            <CodeBlock label="ZIP">{packageTree}</CodeBlock>
            <ul className="developer-check-list">
              {copy.package.rules.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </DocSection>

          <DocSection eyebrow={copy.settings.eyebrow} id="settings-json" title={copy.settings.title}>
            <p className="developer-docs-lead">{copy.settings.body}</p>
            <ul className="developer-check-list">
              {copy.settings.rules.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <CodeBlock label="settings.json">{settingsExample}</CodeBlock>
            <h3>{copy.settings.fieldTitle}</h3>
            <dl className="developer-definition-list developer-definition-list-compact">
              {copy.settings.fields.map(([term, description]) => (
                <div key={term}>
                  <dt><code>{term}</code></dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </DocSection>

          <DocSection eyebrow={copy.score.eyebrow} id="score-json" title={copy.score.title}>
            <p className="developer-docs-lead">{copy.score.body}</p>
            <Callout icon="account_tree">{copy.score.externalNotice}</Callout>
            <ul className="developer-check-list">
              {copy.score.rules.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <CodeBlock label="score.json">{scoreExample}</CodeBlock>
          </DocSection>

          <DocSection eyebrow={copy.sdk.eyebrow} id="sdk" title={copy.sdk.title}>
            <p className="developer-docs-lead">{copy.sdk.body}</p>
            <h3>{copy.sdk.runtimeTitle}</h3>
            <CodeBlock label="Runtime">{runtimePaths}</CodeBlock>
            <CodeBlock label="index.html">{sdkExample}</CodeBlock>
            <h3>{copy.sdk.resultTitle}</h3>
            <ul className="developer-check-list">
              {copy.sdk.resultRules.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <h3>{copy.sdk.lifecycleTitle}</h3>
            <ol className="developer-number-list">
              {copy.sdk.lifecycle.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </DocSection>

          <DocSection eyebrow={copy.research.eyebrow} id="research" title={copy.research.title}>
            <p className="developer-docs-lead">{copy.research.body}</p>
            <div className="developer-research-grid">
              {copy.research.cards.map(([title, body]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
            <h3>{copy.research.minimumTitle}</h3>
            <ul className="developer-inline-checks">
              {copy.research.minimum.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </DocSection>

          <DocSection eyebrow={copy.accessibility.eyebrow} id="accessibility" title={copy.accessibility.title}>
            <ol className="developer-number-list">
              {copy.accessibility.rules.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </DocSection>

          <DocSection eyebrow={copy.security.eyebrow} id="security" title={copy.security.title}>
            <p className="developer-docs-lead">{copy.security.body}</p>
            <dl className="developer-definition-list">
              {copy.security.groups.map(([term, description]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd><code>{description}</code></dd>
                </div>
              ))}
            </dl>
          </DocSection>

          <DocSection eyebrow={copy.testing.eyebrow} id="testing" title={copy.testing.title}>
            <div className="developer-test-columns">
              <div>
                <h3>{copy.testing.thirdPartyTitle}</h3>
                <ul className="developer-check-list">
                  {copy.testing.thirdParty.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <h3>{copy.testing.repoTitle}</h3>
                <p>{copy.testing.repoNote}</p>
                <CodeBlock label="Terminal">{validationCommands}</CodeBlock>
              </div>
            </div>
          </DocSection>

          <PromptBuilder language={language} />
          {children}
        </div>
      </div>
    </>
  );
}

function DocSection({
  children,
  eyebrow,
  id,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <section className="developer-doc-section" id={id}>
      <header>
        <p className="page-kicker">{eyebrow}</p>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function CodeBlock({ children, label }: { children: string; label: string }) {
  return (
    <div className="developer-code-block">
      <div><span>{label}</span></div>
      <pre tabIndex={0}><code>{children}</code></pre>
    </div>
  );
}

function Callout({ children, icon }: { children: ReactNode; icon: string }) {
  return (
    <aside className="developer-callout">
      <span className="developer-native-icon" aria-hidden="true">{icon === 'account_tree' ? '⑂' : 'i'}</span>
      <p>{children}</p>
    </aside>
  );
}

interface PromptFields {
  route: 'third-party' | 'built-in';
  title: string;
  target: string;
  interaction: string;
  input: 'pointer' | 'keyboard' | 'both';
  session: string;
  metrics: string;
  evidence: string;
}

const initialPromptFields: PromptFields = {
  route: 'third-party',
  title: '',
  target: '',
  interaction: '',
  input: 'pointer',
  session: '',
  metrics: '',
  evidence: '',
};

function PromptBuilder({ language }: { language: HubLanguage }) {
  const copy = GetDeveloperCopy(language);
  const [fields, setFields] = useState<PromptFields>(initialPromptFields);
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => BuildAgentPrompt(fields, language), [fields, language]);

  const update = <TKey extends keyof PromptFields>(key: TKey, value: PromptFields[TKey]) => {
    setCopied(false);
    setFields((current) => ({ ...current, [key]: value }));
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="developer-doc-section developer-prompt-section" id="prompt-builder">
      <header>
        <p className="page-kicker">{copy.prompt.eyebrow}</p>
        <h2>{copy.prompt.title}</h2>
      </header>
      <p className="developer-docs-lead">{copy.prompt.body}</p>
      <div className="developer-prompt-builder">
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>{copy.prompt.fields.route}</span>
            <select value={fields.route} onChange={(event) => update('route', event.target.value as PromptFields['route'])}>
              {copy.prompt.routes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>{copy.prompt.fields.title}</span>
            <input value={fields.title} onChange={(event) => update('title', event.target.value)} placeholder={copy.prompt.placeholders.title} />
          </label>
          <label>
            <span>{copy.prompt.fields.target}</span>
            <input value={fields.target} onChange={(event) => update('target', event.target.value)} placeholder={copy.prompt.placeholders.target} />
          </label>
          <label>
            <span>{copy.prompt.fields.input}</span>
            <select value={fields.input} onChange={(event) => update('input', event.target.value as PromptFields['input'])}>
              {copy.prompt.inputs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="developer-prompt-wide">
            <span>{copy.prompt.fields.interaction}</span>
            <textarea rows={3} value={fields.interaction} onChange={(event) => update('interaction', event.target.value)} placeholder={copy.prompt.placeholders.interaction} />
          </label>
          <label className="developer-prompt-wide">
            <span>{copy.prompt.fields.session}</span>
            <textarea rows={2} value={fields.session} onChange={(event) => update('session', event.target.value)} placeholder={copy.prompt.placeholders.session} />
          </label>
          <label className="developer-prompt-wide">
            <span>{copy.prompt.fields.metrics}</span>
            <textarea rows={2} value={fields.metrics} onChange={(event) => update('metrics', event.target.value)} placeholder={copy.prompt.placeholders.metrics} />
          </label>
          <label className="developer-prompt-wide">
            <span>{copy.prompt.fields.evidence}</span>
            <textarea rows={3} value={fields.evidence} onChange={(event) => update('evidence', event.target.value)} placeholder={copy.prompt.placeholders.evidence} />
          </label>
        </form>
        <div className="developer-prompt-output">
          <div>
            <span>{copy.prompt.outputLabel}</span>
            <button onClick={() => void copyPrompt()} type="button">
              <span className="developer-native-icon" aria-hidden="true">⧉</span>
              {copied ? copy.prompt.copied : copy.prompt.copy}
            </button>
          </div>
          <pre tabIndex={0}><code>{prompt}</code></pre>
        </div>
      </div>
    </section>
  );
}

function BuildAgentPrompt(fields: PromptFields, language: HubLanguage): string {
  const empty = language === 'en' ? '[Confirm before implementation]' : '【實作前確認】';
  const value = (input: string) => input.trim() || empty;
  const route = fields.route === 'built-in'
    ? (language === 'en' ? 'Repository built-in game' : '倉庫內建遊戲')
    : (language === 'en' ? 'Third-party HTML/ZIP submission' : '第三方 HTML／ZIP 投稿');
  const input = fields.input === 'both'
    ? (language === 'en' ? 'Pointer/touch and keyboard' : '滑鼠／觸控與鍵盤')
    : fields.input === 'keyboard'
      ? (language === 'en' ? 'Keyboard' : '鍵盤')
      : (language === 'en' ? 'Pointer/touch' : '滑鼠／觸控');
  const routeContract = fields.route === 'built-in'
    ? (language === 'en'
      ? `Create an isolated module at apps/rehabtrainerhub/games/{gameId}/. It must own its runtime and include settings.json and score.json, import both in main.tsx, and register both with OfficialGameShell. Do not move renderer or game-loop state into shared packages.`
      : `在 apps/rehabtrainerhub/games/{gameId}/ 建立獨立模組。模組自行擁有 runtime，必須包含 settings.json 與 score.json，在 main.tsx 匯入兩者並向 OfficialGameShell 註冊。不得把 renderer 或 game-loop 長生命週期狀態移入共用 package。`)
    : (language === 'en'
      ? `Create readable, unminified index.html, settings.json, source, styles, and local assets at the package root. Use platform jsPsych 8.2.3 and Game SDK 0.1.0 from /runtime/. Run the timeline through RunTrainerHubJsPsychGame(). Do not create score.json, a manifest, or a service worker and do not bundle jsPsych or the SDK.`
      : `在套件根目錄建立可閱讀、未壓縮的 index.html、settings.json、原始碼、樣式與本地資產。從 /runtime/ 使用平台 jsPsych 8.2.3 與 Game SDK 0.1.0，並以 RunTrainerHubJsPsychGame() 執行 timeline。不要建立 score.json、manifest 或 service worker，也不要自行打包 jsPsych 或 SDK。`);

  if (language === 'en') {
    return `# Role
Act as a senior web RD and a research-literate occupational-therapy collaborator. Read AGENTS.md and inspect the repository's real schemas and tests before editing.

# Goal
Build "${value(fields.title)}" as a ${route}.

# Activity specification
- Primary task demands: ${value(fields.target)}
- Trial interaction: ${value(fields.interaction)}
- Input: ${input}
- Trials and timing: ${value(fields.session)}
- Aggregate metrics: ${value(fields.metrics)}
- Evidence and limitations: ${value(fields.evidence)}

# Non-negotiable platform contract
${routeContract}
- settings.json uses schemaVersion 1, exact gameId, and bilingual zh-TW/en text. Use only slider, list, checkbox, or color fields. The game must not duplicate the Hub settings screen.
- Keep the game self-contained. Do not use network APIs, external URLs, cookies, navigation, forms, nested frames, dynamic code evaluation, workers, camera, microphone, geolocation, or personal data.
- Return or project only finite numeric/boolean/null aggregates. Never include raw trials, free text, identifiers, images, audio, or motion traces.

# Research and content rules
- Separate primary task demands from secondary device, sensory, attention, and movement demands.
- Document every metric's formula, unit, denominator, missing-value rule, and likely confounds.
- Use practice/activity/session-record language. Do not claim diagnosis, treatment, functional recovery, clinical-grade validity, or guaranteed effects.
- If evidence is missing, label the limitation; do not invent citations or equivalence to a published instrument.

# Accessibility
Use semantic HTML, visible keyboard focus, 44×44 CSS-pixel targets, keyboard equivalence, reduced-motion support, and instructions shown before interaction. Provide a reliable exit and release every listener/renderer resource.

# Deliverables
1. First report assumptions, missing decisions, inspected contracts, and an implementation plan.
2. Implement all complete files without placeholders.
3. Explain the file structure, settings, scoring/results, lifecycle cleanup, and research limitations.
4. Run the smallest relevant tests, then the required repository gates for the selected route. Report exact commands and results.
5. Review the final diff for security, i18n, accessibility, sensitive fields, and unsupported medical claims.`;
  }

  return `# 角色
你是一名資深 Web RD，並具備職能治療活動分析與學術研究素養。修改前先完整閱讀 AGENTS.md，並檢查倉庫目前實際 schema、SDK 與測試，不依賴臆測或舊文件。

# 目標
以「${value(fields.title)}」為名稱，製作${route}。

# 活動規格
- 主要活動需求：${value(fields.target)}
- 每回合互動：${value(fields.interaction)}
- 輸入方式：${input}
- 回合與時間：${value(fields.session)}
- 彙總指標：${value(fields.metrics)}
- 參考依據與限制：${value(fields.evidence)}

# 不可違反的平台契約
${routeContract}
- settings.json 使用 schemaVersion 1、完全一致的 gameId 與 zh-TW／en 雙語文字，只能使用 slider、list、checkbox、color；遊戲內不可複製 Hub 設定畫面。
- 套件必須自足。禁止網路 API、外部 URL、Cookie、導頁、表單、巢狀 frame、動態執行程式碼、worker、攝影機、麥克風、定位與個資。
- 只回傳或投影有限數值、布林與 null 的彙總資料；禁止原始 trial、自由文字、識別碼、影像、聲音或動作軌跡。

# 研究與文案規則
- 分開描述主要活動需求，以及裝置、感覺、注意力與動作等次要需求。
- 說明每個指標的公式、單位、分母、遺漏值處理與可能混淆因素。
- 使用「練習、活動、當次紀錄」等用語；不得宣稱診斷、治療、恢復功能、臨床級效度或保證效果。
- 缺少證據時清楚標示限制；不得虛構引用或宣稱與已發表工具具同等效度。

# 可及性
使用語意 HTML、清楚焦點、至少 44×44 CSS px 操作目標、鍵盤等效操作、減少動態支援，並在互動前顯示指示。提供可靠離開方式，釋放所有 listener 與 renderer 資源。

# 交付要求
1. 先回報假設、缺少決策、已查核契約與實作計畫。
2. 完整實作所有檔案，不可留下 placeholder。
3. 說明檔案結構、settings、分數／結果、生命週期清理與研究限制。
4. 先跑最小相關測試，再跑此開發路徑要求的倉庫 gate；列出完整命令與結果。
5. 最後審查 diff 的安全、i18n、可及性、敏感欄位與不當醫療宣稱。`;
}
