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

  const literatureItems: ReferenceListItem[] = [
    {
      title: 'Gao, M., Huang, L., Yi, J., Zhang, T., Zhu, G., Zhang, Q., Tian, J., Zhao, R., Duan, X., & Liu, Z. (2025). The Effectiveness of Computerized Cognitive Training in Patients With Poststroke Cognitive Impairment: Systematic Review and Meta-Analysis. Journal of Medical Internet Research, 27, e73140. https://doi.org/10.2196/73140',
      href: 'https://doi.org/10.2196/73140',
      modules: [
        moduleChip(thinkingModule, t('module.thinking.mainConcept.title')),
        ...referenceCognitiveModules.map(module => moduleChip(t(cognitiveTrainingAreaTitleKeys[GetCognitiveTrainingArea(module.id)]), t(module.titleKey))),
        moduleChip(thinkingModule, t('training.minesweeper.title'))
      ],
    },
    {
      title: 'Edwards, J. D., Wadley, V. G., Vance, D. E., Wood, K., Roenker, D. L., & Ball, K. K. (2005). The reliability and validity of useful field of view test scores as administered by personal computer. Journal of Clinical and Experimental Neuropsychology, 27(5), 529–543. https://doi.org/10.1080/13803390490515432',
      href: 'https://doi.org/10.1080/13803390490515432',
      modules: [moduleChip(t('module.attention.title'), 'UFOV Test')],
    },
    {
      title: 'Nicholas, L. E., & Brookshire, R. H. (1995). Presence, completeness, and accuracy of main concepts in the connected speech of non-brain-damaged adults and adults with aphasia. Journal of Speech, Language, and Hearing Research, 38(1), 145-156. https://doi.org/10.1044/jshr.3801.145',
      href: 'https://doi.org/10.1044/jshr.3801.145',
      modules: [moduleChip(thinkingModule, t('module.thinking.mainConcept.title'))],
    },
  ];

  return (
    <ReferenceListPage
      githubItems={githubItems}
      literatureItems={literatureItems}
      labels={copy}
      subtitle={copy.subtitle}
      title={copy.title}
    />
  );
}
