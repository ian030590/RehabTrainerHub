'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useHubAuth } from '../HubNavigation';
import {
  FetchDeveloperGames,
  SubmitDeveloperGame,
  type DeveloperGame,
  type DeveloperReleaseStatus,
} from './developerApi';

const maximumPackageBytes = 12 * 1024 * 1024;
const platformJsPsychVersion = '8.2.3';
const platformJsPsychUrl = '/runtime/jspsych-8.2.3.js';
const platformJsPsychCssUrl = '/runtime/jspsych-8.2.3.css';
const platformGameSdkUrl = '/runtime/trainerhub-game-sdk-0.1.0.js';
const categoryOptions = [
  ['general', '一般活動'],
  ['movement', '動作練習'],
  ['vision', '視覺練習'],
  ['attention', '注意力練習'],
  ['memory', '記憶練習'],
  ['higher-cognition', '思考活動'],
  ['language', '語言活動'],
  ['oral', '口腔動作練習'],
] as const;
const capabilityOptions = [
  ['audio', '播放音效'],
  ['fullscreen', '全螢幕'],
  ['keyboard', '鍵盤輸入'],
  ['pointer', '滑鼠／觸控指標'],
] as const;
const statusCopy: Record<DeveloperReleaseStatus, string> = {
  blocked: '自動掃描阻擋',
  pending_review: '等待人工審核',
  publishing: '正在發布',
  approved: '已核准上架',
  rejected: '未通過審核',
  revoked: '已緊急下架',
};

export function DeveloperPortal() {
  const { user } = useHubAuth();
  const [games, setGames] = useState<DeveloperGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('general');
  const [version, setVersion] = useState('1.0.0');
  const [capabilities, setCapabilities] = useState<string[]>(['keyboard', 'pointer']);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);

  useEffect(() => {
    if (!user) {
      setGames([]);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    void FetchDeveloperGames(controller.signal)
      .then(setGames)
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) return;
        setError(nextError instanceof Error ? nextError.message : '目前無法載入投稿。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [loadKey, user]);

  const releaseCount = useMemo(
    () => games.reduce((count, game) => count + game.releases.length, 0),
    [games],
  );

  const toggleCapability = (capability: string) => {
    setCapabilities((current) => (
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability]
    ));
  };

  const selectPackage = (file: File | null) => {
    setError('');
    if (!file) {
      setPackageFile(null);
      return;
    }
    const extensionAllowed = /\.(?:html?|zip)$/i.test(file.name);
    if (!extensionAllowed || file.size <= 0 || file.size > maximumPackageBytes) {
      setPackageFile(null);
      setError('請選擇 12 MB 以下的 HTML 或 ZIP 檔案。');
      return;
    }
    setPackageFile(file);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!packageFile || !sourceConfirmed) {
      setError('請選擇檔案，並確認原始碼未混淆且不含外部通訊。');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await SubmitDeveloperGame({
        packageFile,
        slug: slug.trim(),
        title: title.trim(),
        developerName: developerName.trim(),
        summary: summary.trim(),
        category,
        version: version.trim(),
        jsPsychVersion: platformJsPsychVersion,
        capabilities,
      });
      setMessage(response.release.status === 'blocked'
        ? `已完成掃描，但偵測到 ${response.release.scan.blockCount ?? response.release.findings.length} 個阻擋項目。`
        : '已安全存入隔離區並送交人工審核。');
      setPackageFile(null);
      setSourceConfirmed(false);
      setLoadKey((current) => current + 1);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '目前無法送出遊戲包。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-page developer-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">Developer Portal</p>
        <h1>居家練習遊戲開發與投稿</h1>
        <p>
          居家訓練網提供開放的遊戲平台架構。開發者可使用 jsPsych 8 開發 HTML/ZIP 居家練習遊戲，
          經自動化掃描與人工審核後發布至平台，並支援使用者單獨安裝 PWA。
        </p>
      </header>

      <section className="about-site-section" aria-labelledby="developer-package-title">
        <p className="page-kicker">Portable package</p>
        <h2 id="developer-package-title">遊戲封裝規格：一個 HTML，或包含資產的 ZIP</h2>
        <p>
          開發者可提交單一 HTML 檔案，或提交根目錄含有 <code>index.html</code> 的 ZIP 壓縮檔；圖片、音效、字型與程式碼都必須放在遊戲包內。
        </p>
        <ul>
          <li><strong>檔案大小限制</strong>：上傳套件上限為 12 MB；解壓縮後總大小上限為 24 MB，單一檔案上限 8 MB。</li>
          <li><strong>ZIP 結構</strong>：必須直接以 <code>index.html</code> 為根目錄進入點，不得包在多層子資料夾內。</li>
          <li><strong>流程與生命週期</strong>：遊戲必須使用 jsPsych 8 管理實驗流程與刺激呈現，並以 <code>RunTrainerHubJsPsychGame()</code> 啟動。</li>
          <li><strong>平台 Runtime 引用</strong>：jsPsych {platformJsPsychVersion} 與 Game SDK 由隔離執行站固定提供，請直接引用 <code>{platformJsPsychUrl}</code>、<code>{platformJsPsychCssUrl}</code> 與 <code>{platformGameSdkUrl}</code>，請勿自行打包 vendor 庫。</li>
        </ul>
      </section>

      <section className="developer-security-notice" aria-labelledby="developer-rules-title">
        <h2 id="developer-rules-title">程式碼安全規範與阻擋規則</h2>
        <ul>
          <li><strong>禁止混淆程式碼</strong>：投稿必須為未經混淆（Unobfuscated）的原始碼，單行不得超過 5000 字元，逃脫字元密度需低於 5%。</li>
          <li><strong>阻斷外部通訊</strong>：禁止使用 <code>fetch</code>、<code>XMLHttpRequest</code>、<code>WebSocket</code>、<code>EventSource</code>、<code>sendBeacon</code> 或 <code>WebRTC</code>。</li>
          <li><strong>禁止憑證與導頁操作</strong>：禁止存取 <code>document.cookie</code>、<code>window.location</code>、<code>window.top</code>、<code>window.open</code> 或使用 <code>eval</code> / <code>new Function</code>。</li>
          <li><strong>禁止多執行緒與動態腳本</strong>：禁止註冊 <code>ServiceWorker</code>、建立 <code>Worker</code> / <code>SharedWorker</code> 或動態載入外部腳本。</li>
          <li><strong>無個資蒐集</strong>：嚴格沙盒不開放相機、麥克風、定位或帳戶資料；請勿在遊戲中要求使用者輸入個資。</li>
        </ul>
      </section>

      <section className="about-site-section" aria-labelledby="developer-sandbox-title">
        <p className="page-kicker">Security architecture</p>
        <h2 id="developer-sandbox-title">第三方遊戲的隔離與審核機制</h2>
        <ul>
          <li><strong>物理隔離（Separate Domain）</strong>：核准的遊戲檔案在與帳戶平台完全獨立的網域（<code>trainerhub-user-games.pages.dev</code>）執行，完全無法讀取 <code>trainerhub.cc</code> 的 Cookie 或登入憑證。</li>
          <li><strong>沙盒機制（Strict Iframe Sandbox）</strong>：平台一律以 <code>sandbox=&quot;allow-scripts&quot;</code> iframe 載入遊戲，絕不開放 <code>allow-same-origin</code> 或 <code>allow-top-navigation</code>。</li>
          <li><strong>阻斷外連 CSP</strong>：遊戲靜態檔案套用嚴格內容安全策略（<code>connect-src 'none'; worker-src 'none'; form-action 'none'</code>），防止資料外傳。</li>
          <li><strong>安全通訊橋樑</strong>：遊戲透過 <code>MessageChannel</code> 私有通訊埠回傳非識別性的當次彙總結果，以 session nonce 與遞增序號防禦重放攻擊。</li>
          <li><strong>自動掃描與人工審核</strong>：上傳時自動掃描 18 種危險 API；審核人員會在無憑證隔離環境試玩並查核原始碼，經 3 項查核確認後始可發布。</li>
        </ul>
      </section>

      {!user ? (
        <section className="admin-tab-panel">
          <h2>登入以開始投稿</h2>
          <p>
            請先點擊右上角的帳戶頭像進行登入。登入後即可在此上傳 HTML 或 ZIP 遊戲包、查看自動掃描結果與人工審核進度。
          </p>
        </section>
      ) : (
        <div className="developer-layout">
          <section className="admin-tab-panel" aria-labelledby="developer-upload-title">
            <h2 id="developer-upload-title">上傳新版本</h2>
          <form className="developer-upload-form" onSubmit={(event) => void submit(event)}>
            <label className="admin-field">
              <span>遊戲識別碼</span>
              <input
                autoComplete="off"
                maxLength={48}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                pattern="[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?"
                placeholder="target-click"
                required
                value={slug}
              />
              <small>只能使用小寫英文字母、數字與連字號；後續版本沿用同一識別碼。</small>
            </label>

            <label className="admin-field">
              <span>顯示名稱</span>
              <input maxLength={120} minLength={2} onChange={(event) => setTitle(event.target.value)} required value={title} />
            </label>

            <label className="admin-field">
              <span>公開開發者名稱</span>
              <input maxLength={80} minLength={2} onChange={(event) => setDeveloperName(event.target.value)} required value={developerName} />
              <small>此名稱會顯示在公開遊戲大廳；不會自動公開帳戶姓名或電子郵件。</small>
            </label>

            <label className="admin-field">
              <span>內容摘要</span>
              <textarea maxLength={500} onChange={(event) => setSummary(event.target.value)} rows={4} value={summary} />
            </label>

            <div className="developer-field-row">
              <label className="admin-field">
                <span>分類</span>
                <select onChange={(event) => setCategory(event.target.value)} value={category}>
                  {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span>版本</span>
                <input
                  maxLength={64}
                  onChange={(event) => setVersion(event.target.value)}
                  pattern="(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
                  required
                  value={version}
                />
              </label>
              <label className="admin-field">
                <span>jsPsych 版本</span>
                <input aria-describedby="platform-jspsych-help" readOnly value={platformJsPsychVersion} />
                <small id="platform-jspsych-help">由隔離執行站固定提供，不需放入上傳套件。</small>
              </label>
            </div>

            <fieldset className="developer-capabilities">
              <legend>需要的基本能力</legend>
              {capabilityOptions.map(([value, label]) => (
                <label key={value}>
                  <input
                    checked={capabilities.includes(value)}
                    onChange={() => toggleCapability(value)}
                    type="checkbox"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <label className="admin-field">
              <span>HTML 或 ZIP 遊戲包</span>
              <input
                accept=".html,.htm,.zip,text/html,application/zip"
                onChange={(event) => selectPackage(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
              <small>{packageFile ? `${packageFile.name}（${FormatBytes(packageFile.size)}）` : '上限 12 MB'}</small>
            </label>

            <label className="developer-confirmation">
              <input checked={sourceConfirmed} onChange={(event) => setSourceConfirmed(event.target.checked)} required type="checkbox" />
              <span>我確認原始碼未混淆、所有依賴皆在包內，且不會嘗試對外通訊、讀取 Cookie 或蒐集個資。</span>
            </label>

            {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
            {message && <p className="admin-alert admin-alert-warning" role="status">{message}</p>}
            <button className="admin-button admin-button-primary" disabled={isSubmitting} type="submit">
              <span className="material-symbols-outlined" aria-hidden="true">upload_file</span>
              {isSubmitting ? '掃描並上傳中…' : '掃描並送審'}
            </button>
          </form>
        </section>

        <section className="admin-tab-panel" aria-labelledby="developer-releases-title">
          <div className="section-title-row">
            <div>
              <p className="page-kicker">Submissions</p>
              <h2 id="developer-releases-title">我的投稿</h2>
            </div>
            <p>{games.length} 個遊戲、{releaseCount} 個版本</p>
          </div>
          {isLoading && <p role="status">正在載入投稿…</p>}
          {!isLoading && games.length === 0 && <p>尚未投稿遊戲。</p>}
          <div className="developer-release-list">
            {games.map((game) => (
              <article className="developer-release-card" key={game.id}>
                <div>
                  <p className="page-kicker">{game.slug}</p>
                  <h3>{game.title}</h3>
                  <p>公開開發者：{game.developerName}</p>
                  {game.summary && <p>{game.summary}</p>}
                </div>
                <ul>
                  {game.releases.map((release) => (
                    <li key={release.id}>
                      <div>
                        <strong>v{release.version}</strong>
                        <span className={`release-status release-status-${release.status}`}>{statusCopy[release.status]}</span>
                      </div>
                      <small>
                        {release.fileCount} 個檔案 · {FormatBytes(release.uncompressedBytes)} · SHA-256 {release.contentSha256.slice(0, 12)}…
                      </small>
                      {release.reviewNote && <p>審核備註：{release.reviewNote}</p>}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
      )}
    </main>
  );
}

function FormatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
