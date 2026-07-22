import {
  ReferenceListPage,
  FormatReferenceModuleChip,
  type ReferenceListItem,
} from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../i18n';
import { referenceCognitiveModules } from './thinking/cognitive/constants';

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

export function ReferencesPage() {
  const { lang, t } = useT();
  const copy = labels[lang];
  const moduleChip = (tabName: string, moduleName: string) => FormatReferenceModuleChip(tabName, moduleName);
  const thinkingModule = t('module.thinking.title');

  const githubItems: ReferenceListItem[] = [
    {
      title: 'rbcavanaugh/mainConcept',
      href: 'https://github.com/rbcavanaugh/mainConcept',
      description: t('references.mainConcept.desc'),
      modules: [
        moduleChip(t('module.thinking.title'), t('module.thinking.mainConcept.title')),
      ],
    },
    {
      title: 'muthuspark/javascript-games',
      href: 'https://github.com/muthuspark/javascript-games',
      description: t('references.javascriptGames.desc'),
      modules: referenceCognitiveModules.map((module) => moduleChip(thinkingModule, t(module.titleKey))),
    },
    {
      title: 'antfu/vue-minesweeper',
      href: 'https://github.com/antfu/vue-minesweeper',
      description: t('references.vueMinesweeper.desc'),
      modules: [moduleChip(thinkingModule, t('training.minesweeper.title'))],
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
