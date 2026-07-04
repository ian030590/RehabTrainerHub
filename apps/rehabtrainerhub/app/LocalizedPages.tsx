'use client';

import { useHubReadability } from './HubNavigation';
import { siteUrls } from './siteUrls';
import { SubmissionForm } from './collaborate/SubmissionForm';

const pageCopy = {
  'zh-TW': {
    education: {
      eyebrow: '衛教資訊',
      title: '在家練習前，先看這 4 件事。',
      intro: '如果不確定自己能不能做，請先詢問醫師或治療師。',
      sections: [
        {
          title: '我可以開始練嗎？',
          items: [
            '請先確認醫師或治療師同意你在家練習。',
            '第一次使用時，建議家人或照顧者在旁協助。',
            '請在光線足夠、椅子穩定的地方使用。',
          ],
        },
        {
          title: '什麼狀況要停止？',
          items: [
            '如果頭暈、疼痛、喘或噁心，請立刻停止。',
            '如果太累或看不懂步驟，也請先停下來。',
            '不舒服沒有改善時，請聯絡醫師或治療師。',
          ],
        },
        {
          title: '中風復健可以練什麼？',
          items: [
            '動作練習：手眼協調、描繪與手勢控制。',
            '認知練習：注意力、反應速度與記憶。',
            '語音練習：發音、口腔動作與聽辨任務。',
          ],
        },
        {
          title: '視覺訓練可以練什麼？',
          items: [
            '視覺搜尋：練習找目標與維持注意力。',
            '閱讀眼動：練習看字、追視與移動視線。',
            '對比辨識：練習分辨深淺與清楚度。',
          ],
        },
      ],
    },
    links: {
      eyebrow: '相關網站',
      title: '選擇你現在要使用的工具。',
      intro: '不確定時，可先選中風復健；如果主要困難是視覺或閱讀，再選視覺訓練。',
      sites: [
        {
          name: 'StrokeTrainer',
          title: '中風復健練習',
          description: '中風後想練動作、認知或說話，可先使用這個工具。',
          items: ['動作協調', '注意力記憶', '口腔語音'],
          action: '開啟中風復健',
          href: siteUrls.stroke,
        },
        {
          name: 'VisionTrainer',
          title: '視覺訓練練習',
          description: '如果想練看字、閱讀或眼動，可使用這個工具。',
          items: ['視覺搜尋', '閱讀眼動', '對比辨識'],
          action: '開啟視覺訓練',
          href: siteUrls.vision,
        },
      ],
    },
    collaborate: {
      eyebrow: '合作投稿',
      title: '分享治療活動想法。',
      intro: '你可以投稿文字想法，也可以上傳單一 HTML demo。HTML 通過安全檢查後才會轉送。',
      rulesLabel: '投稿規則',
      rules: [
        '活動想法會轉成 txt 送出。',
        'Demo 只接受一個 .html 檔。',
        'HTML 不可連外、要求權限或傳送資料。',
        '可疑內容會被擋下，不會轉送。',
      ],
    },
    privacy: {
      eyebrow: '隱私權政策',
      title: '登入、匿名資料與訓練紀錄的使用說明。',
      intro: [
        '本政策適用於 Rehab Trainer Hub、StrokeTrainer 與 VisionTrainer 的登入、基本資料填寫與訓練紀錄儲存。',
        '本平台以居家復健練習與流程原型為目的，不取代醫師、治療師或其他專業人員的評估。',
      ],
      sections: [
        {
          title: '我們蒐集哪些資料',
          items: [
            '使用 Google 登入時，系統會使用 Google 提供的帳號識別資訊、顯示名稱、電子郵件與頭像建立登入狀態。',
            '登入後會請你填寫匿名基本資料，包含年齡、性別、國籍等。',
            '登入後會請你填寫是否有醫師診斷的慢性病類別，包含中樞神經疾患、新陳代謝疾患、發展性疾患、精神病與精神官能症。',
            '登入後會請你填寫抽菸與喝酒習慣，選項包含無、有、已經戒掉；若選擇有，會記錄每週或每月的數量與單位。',
            '訓練紀錄可能包含使用的工具、模組、難度、訓練時間、分數、互動結果與瀏覽器送出的紀錄內容。',
          ],
        },
        {
          title: '我們如何使用資料',
          items: [
            '登入資料只用於建立登入狀態、辨識同一位使用者與同步訓練紀錄。',
            '匿名基本資料、慢性病類別、抽菸與喝酒習慣用於分組分析復健工具的使用情形與改善服務。',
            '本平台不提供醫療診斷，也不會依填寫內容提供個別醫療建議。',
            '慢性病欄位只應填寫醫師已診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
          ],
        },
        {
          title: '資料儲存位置',
          items: [
            '登入使用時，匿名基本資料與訓練紀錄會儲存在 Rehab Trainer Hub 的 Cloudflare D1 database。',
            '未登入使用時，訓練紀錄只會儲存在目前瀏覽器的 IndexedDB，不會同步到 D1 database。',
            'StrokeTrainer 與 VisionTrainer 的登入流程會連到 Rehab Trainer Hub 的登入 API，並使用同一份登入狀態。',
          ],
        },
        {
          title: '攝影機與本機推論',
          items: [
            '部分 trainer 功能可能使用攝影機或本機 AI 推論進行即時訓練判斷。',
            '除非頁面功能另有明確說明，本平台不會上傳或保存攝影機影像。',
            '若你不想使用攝影機功能，可以不授權攝影機權限，或改用不需要攝影機的訓練項目。',
          ],
        },
        {
          title: '你的選擇',
          items: [
            '你可以選擇不登入並繼續使用支援本機紀錄的功能。',
            '你可以在任一主頁或 trainer 頁面登出；登出後新的紀錄會回到本機 IndexedDB 儲存。',
            '你可以使用瀏覽器設定清除 IndexedDB 本機紀錄。',
          ],
        },
      ],
    },
  },
  en: {
    education: {
      eyebrow: 'Education',
      title: 'Read these 4 notes before practicing at home.',
      intro: 'If you are not sure whether a practice is appropriate, ask your physician or therapist first.',
      sections: [
        {
          title: 'Can I start practicing?',
          items: [
            'Confirm that your physician or therapist agrees that home practice is appropriate.',
            'Ask a family member or caregiver to help the first time.',
            'Use the tools in a well-lit area with a stable chair.',
          ],
        },
        {
          title: 'When should I stop?',
          items: [
            'Stop immediately if you feel dizzy, painful, short of breath, or nauseated.',
            'Stop if you are too tired or cannot understand the steps.',
            'Contact a physician or therapist if discomfort does not improve.',
          ],
        },
        {
          title: 'What can stroke rehabilitation practice train?',
          items: [
            'Motor practice: hand-eye coordination, tracing, and gesture control.',
            'Cognitive practice: attention, reaction speed, and memory.',
            'Speech practice: articulation, oral movement, and listening tasks.',
          ],
        },
        {
          title: 'What can vision training practice train?',
          items: [
            'Visual search: finding targets and sustaining attention.',
            'Reading eye movement: seeing text, tracking, and shifting gaze.',
            'Contrast recognition: distinguishing clarity and shade differences.',
          ],
        },
      ],
    },
    links: {
      eyebrow: 'Related Websites',
      title: 'Choose the tool you want to use now.',
      intro: 'If you are unsure, start with stroke rehabilitation. Choose vision training when the main difficulty is vision or reading.',
      sites: [
        {
          name: 'StrokeTrainer',
          title: 'Stroke rehabilitation practice',
          description: 'Use this tool for movement, cognition, or speech practice after stroke.',
          items: ['Coordination', 'Attention and memory', 'Oral speech'],
          action: 'Open StrokeTrainer',
          href: siteUrls.stroke,
        },
        {
          name: 'VisionTrainer',
          title: 'Vision training practice',
          description: 'Use this tool for text, reading, or eye movement practice.',
          items: ['Visual search', 'Reading eye movement', 'Contrast'],
          action: 'Open VisionTrainer',
          href: siteUrls.vision,
        },
      ],
    },
    collaborate: {
      eyebrow: 'Collaboration',
      title: 'Share a therapy activity idea.',
      intro: 'You can submit a written idea or upload a single HTML demo. HTML demos are forwarded only after the safety check passes.',
      rulesLabel: 'Submission Rules',
      rules: [
        'Activity ideas are sent as a txt file.',
        'Demos must be a single .html file.',
        'HTML may not connect externally, request permissions, or transmit data.',
        'Suspicious content is blocked and will not be forwarded.',
      ],
    },
    privacy: {
      eyebrow: 'Privacy Policy',
      title: 'How login, anonymous data, and training records are used.',
      intro: [
        'This policy applies to login, basic profile entry, and training record storage for Rehab Trainer Hub, StrokeTrainer, and VisionTrainer.',
        'This platform is intended for home rehabilitation practice and workflow prototyping, and does not replace evaluation by a physician, therapist, or other professional.',
      ],
      sections: [
        {
          title: 'What Data We Collect',
          items: [
            'When signing in with Google, the system uses the account identifier, display name, email, and avatar provided by Google to create your login state.',
            'After signing in, you will be asked to fill in anonymous basic information, including age, gender, and nationality.',
            'After signing in, you will be asked to indicate any physician-diagnosed chronic condition categories, including central nervous system disorders, metabolic disorders, developmental disorders, and psychiatric or neurotic disorders.',
            'After signing in, you will be asked to fill in your smoking and drinking habits. Options include none, yes, or quit; if yes is selected, the weekly or monthly quantity and unit will be recorded.',
            'Training records may include the tools used, modules, difficulty levels, training duration, scores, interaction results, and any record content sent by the browser.',
          ],
        },
        {
          title: 'How We Use the Data',
          items: [
            'Login data is solely used to establish the login state, identify the same user, and synchronize training records.',
            'Anonymous basic information, chronic condition categories, and smoking and drinking habits are used for group analysis of rehabilitation tool usage and to improve our services.',
            'This platform does not provide medical diagnoses, nor does it provide individual medical advice based on the information provided.',
            'The chronic condition fields should only be filled with conditions diagnosed by a physician; if you have not been diagnosed by a physician, please do not guess.',
          ],
        },
        {
          title: 'Data Storage Location',
          items: [
            'When using the service while signed in, anonymous basic information and training records are stored in Rehab Trainer Hub Cloudflare D1 database.',
            'When using the service without signing in, training records are only stored in the current browser IndexedDB and will not be synchronized to the D1 database.',
            'The login flows for StrokeTrainer and VisionTrainer connect to the Rehab Trainer Hub login API and use the same login state.',
          ],
        },
        {
          title: 'Camera and Local Inference',
          items: [
            'Some trainer features may use a camera or local AI inference for real-time training assessment.',
            'Unless explicitly stated otherwise on the page, this platform does not upload or save camera images.',
            'If you do not wish to use camera features, you can decline camera permissions or switch to training items that do not require a camera.',
          ],
        },
        {
          title: 'Your Choices',
          items: [
            'You can choose not to sign in and continue using features that support local records.',
            'You can sign out on any homepage or trainer page; after signing out, new records will revert to local IndexedDB storage.',
            'You can use your browser settings to clear IndexedDB local records.',
          ],
        },
      ],
    },
  },
} as const;

function CheckIcon() {
  return (
    <svg className="check-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EducationContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].education;

  return (
    <section className="content-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="content-intro">{copy.intro}</p>
      <div className="education-list">
        {copy.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LinksContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].links;

  return (
    <section className="content-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="content-intro">{copy.intro}</p>
      <div className="related-grid">
        {copy.sites.map((site) => (
          <a
            className="related-card"
            href={site.href}
            key={site.name}
            rel="noopener noreferrer"
            target="_blank"
          >
            <p>{site.name}</p>
            <h2>{site.title}</h2>
            <span>{site.description}</span>
            <ul className="related-points">
              {site.items.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <span className="related-action">{site.action}</span>
            <strong>{site.href.replace('https://', '')}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CollaborateContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].collaborate;

  return (
    <section className="content-page submission-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="content-intro">{copy.intro}</p>

      <div className="submission-layout">
        <SubmissionForm />

        <aside className="submission-rules" aria-label={copy.rulesLabel}>
          <h2>{copy.rulesLabel}</h2>
          <ul>
            {copy.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function PrivacyContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].privacy;

  return (
    <section className="content-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      {copy.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

      <div className="education-list">
        {copy.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>
                  <p>{item}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
