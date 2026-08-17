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

  if (!user) {
    return (
      <main className="admin-page" id="main-content">
        <header className="page-heading">
          <p className="page-kicker">Developer</p>
          <h1>開發者投稿</h1>
          <p>請先使用右上角帳戶選單登入，再上傳 HTML 或 ZIP 遊戲包。</p>
        </header>
      </main>
    );
  }

  return (
    <main className="admin-page developer-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">Developer</p>
        <h1>開發者遊戲投稿</h1>
        <p>
          上傳未混淆的 HTML，或含本機圖片、音效與程式碼的 ZIP。遊戲必須使用平台提供的
          jsPsych 8 與 Game SDK 管理流程，並透過 bridge 回報非識別性的當次結果。
        </p>
      </header>

      <section className="developer-security-notice" aria-labelledby="developer-security-title">
        <h2 id="developer-security-title">執行與審核規則</h2>
        <ul>
          <li>ZIP 根目錄必須有 <code>index.html</code>；圖片、音效與遊戲自己的程式碼都必須包含在遊戲包內。</li>
          <li>
            jsPsych {platformJsPsychVersion} 與 Game SDK 由隔離執行站提供；請引用
            <code>{platformJsPsychUrl}</code>、<code>{platformJsPsychCssUrl}</code> 與 <code>{platformGameSdkUrl}</code>，
            不要把這兩套 vendor 程式碼放進 HTML 或 ZIP。
          </li>
          <li>請以 <code>RunTrainerHubJsPsychGame()</code> 啟動 timeline。</li>
          <li>禁止 fetch、XMLHttpRequest、WebSocket、Cookie、導頁、Worker、eval 與外部網址。</li>
          <li>程式碼不得壓縮或混淆；自動掃描只是初篩，通過後仍須人工試玩與審閱。</li>
          <li>核准版本會在完全獨立的遊戲網域，以 <code>sandbox=&quot;allow-scripts&quot;</code> 執行。</li>
          <li>嚴格沙盒不開放相機、麥克風、定位或帳戶資料；請勿要求或蒐集個資。</li>
        </ul>
      </section>

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
    </main>
  );
}

function FormatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
