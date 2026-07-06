import { HUB_NAME } from '../hubBrand';

export const zhTW = {
  hub: {
    documentLanguage: 'zh-Hant-TW',
    navigationLabel: 'Rehab Trainer Hub 導覽',
    toggleMenuLabel: '切換選單',
    nav: {
      programs: '復健工具',
      care: '安全提醒',
      education: '衛教資訊',
      links: '衛教影片',
      submit: '合作投稿',
    },
    footer: {
      hub: '首頁',
      privacy: '隱私權政策',
      repo: 'GitHub',
      disclaimer: '本平台用於居家復健練習與流程原型展示，不提供醫療診斷或治療建議。使用前請諮詢醫師或治療師。',
      rights: '保留所有權利。',
      navigation: '頁尾導覽',
    },
    controls: {
      settingsLabel: '閱讀設定',
      settingsButton: '閱讀設定',
      settingsClose: '關閉設定',
      languageLabel: '介面語言',
      zh: '繁中',
      en: 'EN',
      fontLabel: '字體大小',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: '色彩模式',
      light: '淺色',
      dark: '深色',
      contrast: '高對比',
    },
  },
  home: {
    documentLanguage: 'zh-Hant-TW',
    brandSubtitle: '居家復健入口',
    navigationLabel: `${HUB_NAME} 導覽`,
    hero: {
      eyebrow: '居家復健入口',
      title: '職能治療師開發的居家復健工具',
      body: '透過網頁，在家中使用電腦、手機或平板進行居家復健練習。請在治療師的指導下使用。',
      primaryAction: '選擇工具',
      secondaryAction: '查看安全提醒',
      visualLabel: `${HUB_NAME} 工具選擇示意`,
      checklist: ['中風練習', '視覺訓練', '字體可放大'],
    },
    programs: {
      eyebrow: '選擇復健項目',
      title: '你現在想練什麼？',
      intro: '請根據自己的需求以及職能治療師的指導下選擇復健項目。',
    },
    care: {
      eyebrow: '使用方法',
      title: '如何使用這個網站？',
      quote: '練習時請密切關注自己的身體狀況，若有不適請立即停止練習。',
      body: '網站提供工具與指引，並非診斷。請務必在治療師的指導下使用，以免發生危險。',
    },
    education: {
      eyebrow: '衛教資訊',
      title: '復健相關衛教資訊，歡迎參考',
      intro: '了解復健如何進行？自己在家可以如何訓練？',
      educationLink: '閱讀衛教',
      linksLink: '衛教影片',
    },
    apps: [
      {
        id: 'stroke',
        title: 'StrokeTrainer',
        localTitle: '中風復健練習',
        name: 'StrokeTrainer',
        bestFor: '適合：動作、認知、說話練習',
        description: '將治療師交代的方向，整理成適合在家短時間練習的任務。',
        points: ['動作協調', '注意力記憶', '口腔語音'],
        action: '開啟中風復健',
        logoAlt: 'StrokeTrainer 標誌',
      },
      {
        id: 'vision',
        title: 'VisionTrainer',
        localTitle: '視覺訓練練習',
        name: 'VisionTrainer',
        bestFor: '適合：看字、閱讀、眼動練習',
        description: '提供視覺搜尋、閱讀眼動與對比辨識練習，適合依專業建議使用。',
        points: ['視覺搜尋', '閱讀眼動', '對比辨識'],
        action: '開啟視覺訓練',
        logoAlt: 'VisionTrainer 標誌',
      },
    ],
    safetySteps: [
      {
        title: '確認疼痛狀況',
        text: '若是疼痛或不適，請務必停止練習，並尋求醫療建議。',
      },
      {
        title: '家人安全陪同',
        text: '進行需要走動、平衡的練習時，建議有家人在旁協助。確保安全性。',
      },
      {
        title: '持續不斷練習',
        text: '復健是一場馬拉松，只有堅持才能看到效果。',
      },
      {
        title: '與身邊人一起進步',
        text: '網站提供評分榜，讓你能夠看到其他使用者進行的狀況，一起努力進步。',
      },
    ],
  },
  pages: {
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
    videos: {
      eyebrow: '衛教影片',
      title: '觀看復健與居家練習影片。',
      intro: '這裡會從 YouTube 頻道載入最新衛教影片。觀看前仍請依醫師或治療師建議選擇內容。',
      loading: '正在載入影片',
      error: '影片暫時無法載入，請稍後再試。',
      empty: '目前沒有可顯示的影片。',
      action: '在 YouTube 開啟',
      published: '發布日期',
      noDescription: '此影片未提供文字說明。',
    },
    collaborate: {
      eyebrow: '合作投稿',
      title: '希望網頁增加活動種類嗎？',
      intro: '你可以透過文字說明想法，也可以直接上傳單一 HTML 檔案。',
      rulesLabel: '投稿規則',
      rules: [
        'HTML可以透過Vibe Coding完成，但需要可以執行',
        '不限治療師皆可參與',
        '活動可行性與治療性會由團隊審核',
        '審核通過者將會透過聯絡方式詢問您期望被網站提起的名稱',
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
} as const;
