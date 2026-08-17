import type { Metadata } from 'next';
import Link from 'next/link';
import { hubFullName } from '../hubBrand';
import { CreateSeoMetadata, gamePlatformDescription } from '../seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: '居家練習遊戲平台與獨立安裝',
  description: gamePlatformDescription,
  path: '/games',
});

export default function GamesPage() {
  return (
    <main className="qa-page games-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">Game library</p>
        <h1>居家練習遊戲平台</h1>
        <p>
          {gamePlatformDescription}
          {' '}{hubFullName} 提供一般居家練習工具與衛教資訊，不提供個別評估、診斷或治療。
        </p>
      </header>

      <section className="about-site-section" aria-labelledby="games-library-title">
        <p className="page-kicker">Play and install</p>
        <h2 id="games-library-title">在遊戲大廳開始，或單獨安裝遊戲</h2>
        <p>
          遊戲大廳集中顯示居家訓練網內建遊戲，以及完成自動掃描與人工審核的開發者遊戲。
          你可以直接在平台內遊玩，也可以開啟該遊戲的安裝頁，透過 PWA 將單一遊戲安裝到支援的電腦、手機或平板。
          每個遊戲都有自己的啟動路徑、manifest、離線快取範圍與版本，不會把其他遊戲一併安裝。
        </p>
        <p>
          內建遊戲會共用所屬 Trainer 的啟動殼，但只鎖定並載入所選遊戲；首次使用仍需連線取得該遊戲實際需要的程式與資產。
          已載入的同來源資產會存入該遊戲自己的快取；需要外部模型或即時瀏覽器能力的項目，不保證可在完全離線時啟動。
        </p>
        <p><Link href="/">前往居家練習遊戲大廳</Link></p>
      </section>

      <section className="about-site-section" aria-labelledby="games-package-title">
        <p className="page-kicker">Portable package</p>
        <h2 id="games-package-title">一個 HTML，或包含資產的 ZIP</h2>
        <p>
          開發者可提交單一 HTML，或提交根目錄含有 <code>index.html</code> 的 ZIP；圖片、音效、字型與程式碼都必須放在遊戲包內。
          遊戲需使用 jsPsych 8 管理流程與生命週期，並以平台 bridge 回報通關狀態、分數或其他非識別性的當次彙總結果。
          投稿原始碼不得混淆，也不得包含外部通訊、Cookie 存取、導頁或動態執行程式碼。
        </p>
        <p><Link href="/developer/">登入後前往開發者投稿</Link></p>
      </section>

      <section className="developer-security-notice" aria-labelledby="games-security-title">
        <h2 id="games-security-title">第三方遊戲的隔離與審核</h2>
        <ul>
          <li>核准的遊戲檔案在與帳戶平台完全獨立的網域執行，不能讀取 trainerhub.cc 的 Cookie 或登入憑證。</li>
          <li>平台只以 <code>sandbox=&quot;allow-scripts&quot;</code> iframe 載入遊戲，不開放 same-origin 或頂層導頁權限。</li>
          <li>遊戲回應套用內容安全策略，阻擋 fetch 類連線、表單送出、外部腳本與其他未核准的瀏覽器能力。</li>
          <li>遊戲只能用具 session nonce 與遞增序號的 postMessage bridge 回報有限的當次彙總結果；不會取得帳戶或 API token。</li>
          <li>自動掃描會阻擋敏感程式碼、可疑混淆與不安全封裝；通過初篩後仍須人工審核才會上架。</li>
          <li>瀏覽器無法絕對阻止任意程式在首次載入前嘗試自行導頁；請勿在第三方遊戲輸入姓名、帳密、帳戶資料或聯絡方式。</li>
        </ul>
      </section>
    </main>
  );
}
