import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '隱私權政策 Privacy Policy',
  description: 'RehabTrainerHub 登入、匿名基本資料、訓練紀錄與本機 IndexedDB 儲存說明。 Usage instructions for login, anonymous data, and training records.',
  alternates: {
    canonical: '/privacy',
  },
};

const sections = [
  {
    titleZh: '我們蒐集哪些資料',
    titleEn: 'What Data We Collect',
    items: [
      {
        zh: '使用 Google 登入時，系統會使用 Google 提供的帳號識別資訊、顯示名稱、電子郵件與頭像建立登入狀態。',
        en: 'When signing in with Google, the system uses the account identifier, display name, email, and avatar provided by Google to create your login state.',
      },
      {
        zh: '登入後會請你填寫匿名基本資料，包含年齡、性別、國籍等。',
        en: 'After signing in, you will be asked to fill in anonymous basic information, including age, gender, and nationality.',
      },
      {
        zh: '登入後會請你填寫是否有醫師診斷的慢性病類別，包含中樞神經疾患、新陳代謝疾患、發展性疾患、精神病與精神官能症。',
        en: 'After signing in, you will be asked to indicate any physician-diagnosed chronic condition categories, including central nervous system disorders, metabolic disorders, developmental disorders, and psychiatric or neurotic disorders.',
      },
      {
        zh: '登入後會請你填寫抽菸與喝酒習慣，選項包含無、有、已經戒掉；若選擇有，會記錄每週或每月的數量與單位。',
        en: 'After signing in, you will be asked to fill in your smoking and drinking habits. Options include none, yes, or quit; if "yes" is selected, the weekly or monthly quantity and unit will be recorded.',
      },
      {
        zh: '訓練紀錄可能包含使用的工具、模組、難度、訓練時間、分數、互動結果與瀏覽器送出的紀錄內容。',
        en: 'Training records may include the tools used, modules, difficulty levels, training duration, scores, interaction results, and any record content sent by the browser.',
      },
    ],
  },
  {
    titleZh: '我們如何使用資料',
    titleEn: 'How We Use the Data',
    items: [
      {
        zh: '登入資料只用於建立登入狀態、辨識同一位使用者與同步訓練紀錄。',
        en: 'Login data is solely used to establish the login state, identify the same user, and synchronize training records.',
      },
      {
        zh: '匿名基本資料、慢性病類別、抽菸與喝酒習慣用於分組分析復健工具的使用情形與改善服務。',
        en: 'Anonymous basic information, chronic condition categories, and smoking and drinking habits are used for group analysis of rehabilitation tool usage and to improve our services.',
      },
      {
        zh: '本平台不提供醫療診斷，也不會依填寫內容提供個別醫療建議。',
        en: 'This platform does not provide medical diagnoses, nor does it provide individual medical advice based on the information provided.',
      },
      {
        zh: '慢性病欄位只應填寫醫師已診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
        en: 'The chronic condition fields should only be filled with conditions diagnosed by a physician; if you have not been diagnosed by a physician, please do not guess.',
      },
    ],
  },
  {
    titleZh: '資料儲存位置',
    titleEn: 'Data Storage Location',
    items: [
      {
        zh: '登入使用時，匿名基本資料與訓練紀錄會儲存在 RehabTrainerHub 的 Cloudflare D1 database。',
        en: "When using the service while signed in, anonymous basic information and training records are stored in RehabTrainerHub's Cloudflare D1 database.",
      },
      {
        zh: '未登入使用時，訓練紀錄只會儲存在目前瀏覽器的 IndexedDB，不會同步到 D1 database。',
        en: "When using the service without signing in, training records are only stored in the current browser's IndexedDB and will not be synchronized to the D1 database.",
      },
      {
        zh: 'StrokeTrainer 與 VisionTrainer 的登入流程會連到 RehabTrainerHub 的登入 API，並使用同一份登入狀態。',
        en: "The login processes for StrokeTrainer and VisionTrainer connect to RehabTrainerHub's login API and use the same login state.",
      },
    ],
  },
  {
    titleZh: '攝影機與本機推論',
    titleEn: 'Camera and Local Inference',
    items: [
      {
        zh: '部分 trainer 功能可能使用攝影機或本機 AI 推論進行即時訓練判斷。',
        en: 'Some trainer features may use a camera or local AI inference for real-time training assessment.',
      },
      {
        zh: '除非頁面功能另有明確說明，本平台不會上傳或保存攝影機影像。',
        en: 'Unless explicitly stated otherwise on the page, this platform does not upload or save camera images.',
      },
      {
        zh: '若你不想使用攝影機功能，可以不授權攝影機權限，或改用不需要攝影機的訓練項目。',
        en: 'If you do not wish to use camera features, you can decline camera permissions or switch to training items that do not require a camera.',
      },
    ],
  },
  {
    titleZh: '你的選擇',
    titleEn: 'Your Choices',
    items: [
      {
        zh: '你可以選擇不登入並繼續使用支援本機紀錄的功能。',
        en: 'You can choose not to sign in and continue using features that support local records.',
      },
      {
        zh: '你可以在任一主頁或 trainer 頁面登出；登出後新的紀錄會回到本機 IndexedDB 儲存。',
        en: 'You can sign out on any homepage or trainer page; after signing out, new records will revert to being stored in local IndexedDB.',
      },
      {
        zh: '你可以使用瀏覽器設定清除 IndexedDB 本機紀錄。',
        en: 'You can use your browser settings to clear local IndexedDB records.',
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Privacy Policy</small>
          </span>
        </Link>
        <nav className="header-actions" aria-label="RehabTrainerHub navigation">
          <Link className="nav-link" href="/#apps-title">復健工具</Link>
          <Link className="nav-link" href="/#care-title">安全提醒</Link>
          <Link className="nav-link" href="/education/">衛教資訊</Link>
          <Link className="nav-link" href="/links/">相關連結</Link>
          <Link className="nav-link" href="/collaborate/">合作投稿</Link>
        </nav>
      </header>

      <nav className="bottom-nav" aria-label="RehabTrainerHub navigation">
        <Link href="/#apps-title">復健工具</Link>
        <Link href="/#care-title">安全提醒</Link>
        <Link href="/education/">衛教資訊</Link>
        <Link href="/links/">相關連結</Link>
        <Link href="/collaborate/">合作投稿</Link>
      </nav>

      <section className="content-page">
        <p className="eyebrow">隱私權政策 / Privacy Policy</p>
        <h1 style={{ lineHeight: 1.4 }}>
          登入、匿名資料與訓練紀錄的使用說明。
          <span style={{ display: 'block', fontSize: '0.65em', color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 'var(--fw-medium, 500)' }}>
            Usage instructions for login, anonymous data, and training records.
          </span>
        </h1>
        <p>
          本政策適用於 RehabTrainerHub、StrokeTrainer 與 VisionTrainer 的登入、基本資料填寫與訓練紀錄儲存。
          <span style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            This policy applies to login, basic data entry, and training record storage for RehabTrainerHub, StrokeTrainer, and VisionTrainer.
          </span>
        </p>
        <p>
          本平台以居家復健練習與流程原型為目的，不取代醫師、治療師或其他專業人員的評估。
          <span style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            This platform is intended for home rehabilitation practice and process prototyping, and does not replace evaluation by a physician, therapist, or other professional.
          </span>
        </p>

        <div className="education-list">
          {sections.map((section) => (
            <article key={section.titleZh}>
              <h2 style={{ lineHeight: 1.3, marginBottom: '1rem' }}>
                {section.titleZh}
                <span style={{ display: 'block', fontSize: '0.75em', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 'var(--fw-medium, 500)' }}>
                  {section.titleEn}
                </span>
              </h2>
              <ul>
                {section.items.map((item, idx) => (
                  <li key={idx} style={{ paddingBottom: '0.75rem' }}>
                    <p style={{ margin: 0 }}>{item.zh}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.95em', color: 'var(--text-secondary)' }}>{item.en}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
