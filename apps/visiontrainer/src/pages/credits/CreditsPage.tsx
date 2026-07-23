import {
  ReferenceListPage,
  FormatReferenceModuleChip,
  GetDefaultReferenceListPageLabels,
  type ReferenceListItem,
} from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../../i18n';

export function CreditsPage() {
  const { lang, t } = useT();
  const copy = GetDefaultReferenceListPageLabels(lang);
  const visualTrainingTab = t('nav.trainingList');
  const visualAssessmentTab = t('nav.assessment');
  const webSettingsTab = t('nav.settings');
  const moduleChip = (tabName: string, moduleName: string) => FormatReferenceModuleChip(tabName, moduleName);

  const githubItems: ReferenceListItem[] = [
    {
      title: 'brownhci/WebGazer',
      href: 'https://github.com/brownhci/WebGazer',
      description: t('credits.webgazer.desc'),
      modules: [
        moduleChip(visualAssessmentTab, t('assess.pl.title')),
        moduleChip(webSettingsTab, t('settings.tab.webgazer')),
      ],
    },
    {
      title: 'michaelbach/FrACT10',
      href: 'https://github.com/michaelbach/FrACT10',
      description: t('credits.fract10.desc'),
      modules: [
        moduleChip(visualAssessmentTab, t('assess.pl.title')),
        moduleChip(webSettingsTab, t('settings.tab.calibration')),
      ],
    },
    {
      title: 'styts/eye-training',
      href: 'https://github.com/styts/eye-training',
      description: t('credits.eyeTraining.desc'),
      modules: [moduleChip(visualTrainingTab, t('home.module.movingCard.title'))],
    },
    {
      title: 'Jesper-N/foveaflow',
      href: 'https://github.com/Jesper-N/foveaflow',
      description: t('credits.foveaflow.desc'),
      modules: [moduleChip(visualTrainingTab, t('home.module.oculomotor.title'))],
    },
    {
      title: 'Fordi/eyegame',
      href: 'https://github.com/Fordi/eyegame.git',
      description: t('credits.gaborPatching.desc'),
      modules: [moduleChip(visualTrainingTab, t('home.module.gaborPatching.title'))],
    },
    {
      title: 'visiontherapy/visiontherapy.github.io',
      href: 'https://github.com/visiontherapy/visiontherapy.github.io',
      description: t('credits.visiontherapy.desc'),
      modules: [moduleChip(visualTrainingTab, t('home.module.hartChart.title'))],
    },
  ];

  const literatureItems: ReferenceListItem[] = [
    {
      title: 'Schmetterer, L., Scholl, H., Garhöfer, G., Janeschitz-Kriegl, L., Corvi, F., Sadda, S. R., & Medeiros, F. A. (2023). Endpoints for clinical trials in ophthalmology. Progress in Retinal and Eye Research, 97, 101160. https://doi.org/10.1016/j.preteyeres.2022.101160',
      href: 'https://doi.org/10.1016/j.preteyeres.2022.101160',
      modules: [moduleChip(visualAssessmentTab, t('assess.pl.title'))],
    },
    {
      title: 'Edwards, J. D., Wadley, V. G., Vance, D. E., Wood, K., Roenker, D. L., & Ball, K. K. (2005). The reliability and validity of useful field of view test scores as administered by personal computer. Journal of Clinical and Experimental Neuropsychology, 27(5), 529–543. https://doi.org/10.1080/13803390490515432',
      href: 'https://doi.org/10.1080/13803390490515432',
      modules: [moduleChip(visualAssessmentTab, t('assess.ufov.title'))],
    },
    {
      title: 'Bach, M. (1996). The Freiburg Visual Acuity test—automatic measurement of visual acuity. Optometry and Vision Science, 73(1), 49–53. https://doi.org/10.1097/00006324-199601000-00008',
      href: 'https://doi.org/10.1097/00006324-199601000-00008',
      modules: [
        moduleChip(visualAssessmentTab, t('assess.pl.title')),
        moduleChip(webSettingsTab, t('settings.tab.calibration')),
      ],
    },
    {
      title: 'Papoutsaki, A., Sangkloy, P., Laskey, J., Daskalova, N., Huang, J., & Hays, J. (2016). WebGazer: Scalable Webcam Eye Tracking Using User Interactions. Proceedings of the 25th International Joint Conference on Artificial Intelligence (IJCAI 2016), 3839-3845.',
      href: 'https://www.ijcai.org/Proceedings/16/Papers/542.pdf',
      modules: [
        moduleChip(visualAssessmentTab, t('assess.pl.title')),
        moduleChip(webSettingsTab, t('settings.tab.webgazer')),
      ],
    },
  ];

  return (
    <ReferenceListPage
      githubItems={githubItems}
      labels={copy}
      literatureItems={literatureItems}
      subtitle={copy.subtitle}
      title={copy.title}
    />
  );
}
