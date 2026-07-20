import {
  ReferenceListPage,
  formatReferenceModuleChip,
  type ReferenceListItem,
} from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../../i18n';
import { REFERENCE_COGNITIVE_MODULES } from '../training/cognitive/constants';

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
  const motorModule = t('home.module.motor.title');
  const cognitiveModule = t('home.module.cognitive.title');
  const speechModule = t('home.module.speech.title');
  const moduleChip = (tabName: string, moduleName: string) => formatReferenceModuleChip(tabName, moduleName);
  const motorCortexTitle = lang === 'en' ? 'Motor Cortex Rehab' : '動作皮質復健訓練';

  const githubItems: ReferenceListItem[] = [
    {
      title: 'ericosborne97/MotorCortexRehabilitationProgram',
      href: 'https://github.com/ericosborne97/MotorCortexRehabilitationProgram',
      description: lang === 'en'
        ? 'Camera-based physical therapy companion used as the reference for hand-tracking motor rehab drills, adaptive difficulty, feedback, and session analytics.'
        : '攝影機手部追蹤物理治療工具，作為手部追蹤動作復健、難度自適應、即時回饋與訓練紀錄的參考。',
      modules: [moduleChip(motorModule, motorCortexTitle)],
    },
    {
      title: 'muthuspark/javascript-games',
      href: 'https://github.com/muthuspark/javascript-games',
      description: t('credits.javascriptGames.desc'),
      modules: REFERENCE_COGNITIVE_MODULES.map((module) => moduleChip(cognitiveModule, t(module.titleKey))),
    },
    {
      title: 'antfu/vue-minesweeper',
      href: 'https://github.com/antfu/vue-minesweeper',
      description: t('credits.vueMinesweeper.desc'),
      modules: [moduleChip(cognitiveModule, t('training.minesweeper.title'))],
    },
    {
      title: 'ccoreilly/vosk-browser',
      href: 'https://github.com/ccoreilly/vosk-browser',
      description: lang === 'en'
        ? 'Used as the browser speech-recognition runtime for local Vosk model inference.'
        : '作為瀏覽器端語音辨識 runtime，支援本機 Vosk 模型推論。',
      modules: [moduleChip(speechModule, t('voice.title'))],
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
