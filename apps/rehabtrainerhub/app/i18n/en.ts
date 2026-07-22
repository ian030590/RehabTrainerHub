import { hubName } from '../hubBrand';

export const en = {
  hub: {
    documentLanguage: 'en',
    navigationLabel: 'Rehab Trainer Hub navigation',
    toggleMenuLabel: 'Toggle menu',
    nav: {
      programs: 'Rehab Tools',
      care: 'Safety Notes',
      education: 'Education',
      links: 'Education Videos',
      references: 'References',
      submit: 'Collaboration',
    },
    footer: {
      hub: 'Home',
      privacy: 'Privacy',
      repo: 'GitHub',
      disclaimer: 'For home rehabilitation practice and workflow prototyping, not medical advice. Consult a physician or therapist before use.',
      rights: 'All rights reserved.',
      navigation: 'Footer navigation',
    },
    controls: {
      settingsLabel: 'Reading settings',
      settingsButton: 'Reading',
      settingsClose: 'Close settings',
      languageLabel: 'Interface language',
      zh: '繁中',
      en: 'EN',
      fontLabel: 'Font size',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: 'Color mode',
      light: 'Light',
      dark: 'Dark',
      contrast: 'High contrast',
    },
  },
  home: {
    documentLanguage: 'en',
    brandSubtitle: 'Home rehabilitation hub',
    navigationLabel: `${hubName} navigation`,
    hero: {
      eyebrow: 'Home rehabilitation hub',
      title: 'Home rehabilitation tools developed by occupational therapists',
      body: 'Practice home rehabilitation through the website on a computer, phone, or tablet at home. Use it under therapist guidance.',
      primaryAction: 'Choose a tool',
      secondaryAction: 'View safety notes',
      visualLabel: `${hubName} tool selection preview`,
      checklist: ['Stroke practice', 'Vision training', 'Larger text'],
    },
    programs: {
      eyebrow: 'Choose a rehabilitation item',
      title: 'What do you want to practice now?',
      intro: 'Choose rehabilitation items based on your needs and occupational therapist guidance.',
    },
    care: {
      eyebrow: 'How to use',
      title: 'How do I use this website?',
      quote: 'Pay close attention to your physical condition during practice. If you feel unwell, stop practicing immediately.',
      body: 'The website provides tools and guidance, not diagnosis. Use it under therapist guidance to avoid danger.',
    },
    education: {
      eyebrow: 'Education',
      title: 'Rehabilitation education information for reference',
      intro: 'How does rehabilitation work? How can you train at home?',
      educationLink: 'Read education',
      linksLink: 'Education videos',
    },
    apps: [
      {
        id: 'motor',
        title: 'MotorTrainer',
        localTitle: 'Motor rehabilitation practice',
        name: 'MotorTrainer',
        bestFor: 'Good for upper-limb, lower-limb, and coordination practice',
        description: 'Turns therapist-directed goals into short motor practice tasks at home.',
        points: ['Upper limb', 'Lower limb', 'Coordination'],
        action: 'Open MotorTrainer',
        logoAlt: 'MotorTrainer logo',
      },
      {
        id: 'vision',
        title: 'VisionTrainer',
        localTitle: 'Vision training practice',
        name: 'VisionTrainer',
        bestFor: 'Good for seeing text, reading, and eye movement practice',
        description: 'Provides visual search, reading eye movement, and contrast practice for professional-guided use.',
        points: ['Visual search', 'Reading eye movement', 'Contrast'],
        action: 'Open VisionTrainer',
        logoAlt: 'VisionTrainer logo',
      },
      {
        id: 'brain',
        title: 'BrainTrainer',
        localTitle: 'Cognitive training practice',
        name: 'BrainTrainer',
        bestFor: 'Good for attention, memory, and thinking practice',
        description: 'Provides attention, memory, and thinking practice, including main-concept work and reasoning or strategy games.',
        points: ['Attention training', 'Memory training', 'Thinking training'],
        action: 'Open BrainTrainer',
        logoAlt: 'BrainTrainer logo',
      },
      {
        id: 'mouth',
        title: 'MouthTrainer',
        localTitle: 'Speech and oral training practice',
        name: 'MouthTrainer',
        bestFor: 'Good for speech, comprehension, and oral movement practice',
        description: 'Provides guided speech recognition and tongue-movement practice, with a prepared space for comprehension exercises.',
        points: ['Speech training', 'Comprehension training', 'Oral movement'],
        action: 'Open MouthTrainer',
        logoAlt: 'MouthTrainer logo',
      },
    ],
    safetySteps: [
      {
        title: 'Check pain status',
        text: 'If there is pain or discomfort, stop practicing and seek medical advice.',
      },
      {
        title: 'Have family support for safety',
        text: 'For practice that involves walking or balance, ask a family member to assist nearby and keep it safe.',
      },
      {
        title: 'Keep practicing consistently',
        text: 'Rehabilitation is a marathon. You only see results by staying consistent.',
      },
      {
        title: 'Improve with people around you',
        text: 'The website provides leaderboards so you can see how other users are doing and keep improving together.',
      },
    ],
  },
  pages: {
    education: {
      eyebrow: 'Education',
      title: 'Before practicing at home, read these 4 things first.',
      intro: 'If you are not sure whether you can do a practice, ask your physician or therapist first.',
      sections: [
        {
          title: 'Can I start practicing?',
          items: [
            'First confirm that your physician or therapist agrees you can practice at home.',
            'The first time you use it, ask a family member or caregiver to assist nearby.',
            'Use it in a well-lit place with a stable chair.',
          ],
        },
        {
          title: 'When should I stop?',
          items: [
            'Stop immediately if you feel dizzy, painful, short of breath, or nauseated.',
            'Also stop first if you are too tired or cannot understand the steps.',
            'If discomfort does not improve, contact your physician or therapist.',
          ],
        },
        {
          title: 'What can stroke rehabilitation train?',
          items: [
            'Motor practice: hand-eye coordination, tracing, and gesture control.',
            'Cognitive practice: attention, reaction speed, and memory.',
            'Speech practice: articulation, oral movement, and listening tasks.',
          ],
        },
        {
          title: 'What can vision training train?',
          items: [
            'Visual search: finding targets and sustaining attention.',
            'Reading eye movement: seeing text, tracking, and shifting gaze.',
            'Contrast recognition: distinguishing differences in shade and clarity.',
          ],
        },
      ],
    },
    videos: {
      eyebrow: 'Education Videos',
      title: 'Watch rehabilitation and home practice videos.',
      intro: 'This page loads the latest education videos from the YouTube channel. Before watching, still choose content according to your physician or therapist guidance.',
      loading: 'Loading videos',
      error: 'Videos cannot be loaded right now. Please try again later.',
      empty: 'There are no videos to show right now.',
      action: 'Open on YouTube',
      published: 'Published',
      noDescription: 'This video does not include a text description.',
    },
    collaborate: {
      eyebrow: 'Collaboration',
      title: 'Share your theraputic activity ideas.',
      intro: 'You can share your idea with text or upload a single HTML demo file.',
      rulesLabel: 'Submission rules',
      rules: [
        'HTML can be vibe coded, but has to be functional.',
        'Not limited to therapists only.',
        'The therapeutic value and feasibility of the activity will be evaluated by the team.',
        'If your application is approved, we will contact you regarding the name you would like to be published.',
      ],
    },
    privacy: {
      eyebrow: 'Privacy Policy',
      title: 'How login, anonymous data, and training records are used.',
      intro: [
        'This policy applies to login, basic profile entry, and training record storage for Rehab Trainer Hub, MotorTrainer, VisionTrainer, BrainTrainer, and MouthTrainer.',
        'This platform is intended for home rehabilitation practice and workflow prototyping, and does not replace evaluation by a physician, therapist, or other professional.',
      ],
      sections: [
        {
          title: 'What data we collect',
          items: [
            'When signing in with Google, the system uses the account identifier, display name, email, and avatar provided by Google to create your login state.',
            'After signing in, you will be asked to fill in anonymous basic information, including age, gender, and nationality.',
            'After signing in, you will be asked to indicate any physician-diagnosed chronic condition categories, including central nervous system disorders, metabolic disorders, developmental disorders, and psychiatric or neurotic disorders.',
            'After signing in, you will be asked to fill in your smoking and drinking habits. Options include none, yes, or quit; if yes is selected, the weekly or monthly quantity and unit will be recorded.',
            'Training records may include the tools used, modules, difficulty levels, training duration, scores, interaction results, and any record content sent by the browser.',
          ],
        },
        {
          title: 'How we use the data',
          items: [
            'Login data is solely used to establish the login state, identify the same user, and synchronize training records.',
            'Anonymous basic information, chronic condition categories, and smoking and drinking habits are used for group analysis of rehabilitation tool usage and to improve our services.',
            'This platform does not provide medical diagnoses, nor does it provide individual medical advice based on the information provided.',
            'The chronic condition fields should only be filled with conditions diagnosed by a physician; if you have not been diagnosed by a physician, please do not guess.',
          ],
        },
        {
          title: 'Where data is stored',
          items: [
            'After sign-in and questionnaire completion, anonymous basic information, medical history questionnaire answers, and training records are stored in Rehab Trainer Hub Cloudflare D1 database.',
            'Trainer functions are not available without sign-in or required questionnaire completion.',
            'The login flows for MotorTrainer, VisionTrainer, BrainTrainer, and MouthTrainer connect to the Rehab Trainer Hub login API and use the same login state.',
          ],
        },
        {
          title: 'Camera and local inference',
          items: [
            'Some trainer features may use a camera or local AI inference for real-time training assessment.',
            'Unless explicitly stated otherwise on the page, this platform does not upload or save camera images.',
            'If you do not wish to use camera features, you can decline camera permissions or switch to training items that do not require a camera.',
          ],
        },
        {
          title: 'Your choices',
          items: [
            'You can choose not to provide required data; without sign-in or required questionnaire completion, trainer functions cannot start.',
            'You can sign out on any homepage or trainer page; sign-out removes the local login state and local training data.',
            'If your browser still has older local records, you can clear IndexedDB local data in browser settings.',
          ],
        },
      ],
    },
  },
} as const;
