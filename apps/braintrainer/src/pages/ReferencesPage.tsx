import {
  ReferenceListPage,
  FormatReferenceModuleChip,
  GetDefaultReferenceListPageLabels,
  type ReferenceListItem,
} from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../i18n';
import {
  cognitiveTrainingAreaTitleKeys,
  GetCognitiveTrainingArea,
  referenceCognitiveModules,
} from './thinking/cognitive/constants';

export function ReferencesPage() {
  const { lang, t } = useT();
  const copy = GetDefaultReferenceListPageLabels(lang);
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
      modules: referenceCognitiveModules.map((module) => {
        const area = GetCognitiveTrainingArea(module.id);
        return moduleChip(t(cognitiveTrainingAreaTitleKeys[area]), t(module.titleKey));
      }),
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
