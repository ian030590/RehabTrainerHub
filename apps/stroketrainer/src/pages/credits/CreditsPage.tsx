import { ReferenceListPage, type ReferenceListItem } from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../../i18n';

const labels = {
  zh: {
    title: '參考資料',
    subtitle: '本頁整理各訓練活動使用的參考資料。',
    githubSection: 'GitHub 專案',
    literatureSection: '文獻',
    emptyLabel: '這裡目前沒有資料。',
  },
  en: {
    title: 'References',
    subtitle: 'References used across training activities.',
    githubSection: 'GitHub Projects',
    literatureSection: 'Literature',
    emptyLabel: 'No references here yet.',
  },
} as const;

export function CreditsPage() {
  const { lang, t } = useT();
  const copy = labels[lang];
  const cognitiveModule = t('home.module.cognitive.title');
  const speechModule = t('home.module.speech.title');

  const githubItems: ReferenceListItem[] = [
    {
      title: 'muthuspark/javascript-games',
      href: 'https://github.com/muthuspark/javascript-games',
      description: t('credits.javascriptGames.desc'),
      modules: [
        lang === 'en'
          ? `${cognitiveModule} - reference mini-games`
          : `${cognitiveModule} - 參考認知小遊戲`,
      ],
    },
    {
      title: 'antfu/vue-minesweeper',
      href: 'https://github.com/antfu/vue-minesweeper',
      description: t('credits.vueMinesweeper.desc'),
      modules: [
        lang === 'en'
          ? `${cognitiveModule} - Minesweeper`
          : `${cognitiveModule} - 踩地雷`,
      ],
    },
    {
      title: 'ccoreilly/vosk-browser',
      href: 'https://github.com/ccoreilly/vosk-browser',
      description: lang === 'en'
        ? 'Used as the browser speech-recognition runtime for local Vosk model inference.'
        : '作為瀏覽器端語音辨識 runtime，支援本機 Vosk 模型推論。',
      modules: [
        lang === 'en'
          ? `${speechModule} - Voice Defender`
          : `${speechModule} - 語音防衛者`,
      ],
    },
  ];

  return (
    <ReferenceListPage
      githubItems={githubItems}
      labels={copy}
      subtitle={copy.subtitle}
      title={copy.title}
    />
  );
}
