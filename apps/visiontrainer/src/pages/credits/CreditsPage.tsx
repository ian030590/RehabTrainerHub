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
  },
  en: {
    title: 'References',
    subtitle: 'References used across training activities.',
    githubSection: 'GitHub Projects',
    literatureSection: 'Literature',
  },
} as const;

export function CreditsPage() {
  const { lang, t } = useT();
  const copy = labels[lang];
  const visualAssessmentModule = lang === 'en' ? 'Visual Assessment' : '視力評估';

  const githubItems: ReferenceListItem[] = [
    {
      title: 'brownhci/WebGazer',
      href: 'https://github.com/brownhci/WebGazer',
      description: t('credits.webgazer.desc'),
      modules: [
        `${visualAssessmentModule} - ${t('assess.pl.title')}`,
        t('settings.tab.webgazer'),
      ],
    },
    {
      title: 'michaelbach/FrACT10',
      href: 'https://github.com/michaelbach/FrACT10',
      description: t('credits.fract10.desc'),
      modules: [
        visualAssessmentModule,
        t('settings.tab.calibration'),
      ],
    },
    {
      title: 'styts/eye-training',
      href: 'https://github.com/styts/eye-training',
      description: t('credits.eyeTraining.desc'),
      modules: [t('home.module.movingCard.title')],
    },
    {
      title: 'Jesper-N/foveaflow',
      href: 'https://github.com/Jesper-N/foveaflow',
      description: t('credits.foveaflow.desc'),
      modules: [t('home.module.oculomotor.title')],
    },
    {
      title: 'Fordi/eyegame',
      href: 'https://github.com/Fordi/eyegame.git',
      description: t('credits.gaborPatching.desc'),
      modules: [t('home.module.gaborPatching.title')],
    },
    {
      title: 'visiontherapy/visiontherapy.github.io',
      href: 'https://github.com/visiontherapy/visiontherapy.github.io',
      description: t('credits.visiontherapy.desc'),
      modules: [t('home.module.hartChart.title')],
    },
  ];

  const literatureItems: ReferenceListItem[] = [
    {
      title: 'Schmetterer, L., Scholl, H., Garhöfer, G., Janeschitz-Kriegl, L., Corvi, F., Sadda, S. R., & Medeiros, F. A. (2023). Endpoints for clinical trials in ophthalmology. Progress in Retinal and Eye Research, 97, 101160. https://doi.org/10.1016/j.preteyeres.2022.101160',
      href: 'https://doi.org/10.1016/j.preteyeres.2022.101160',
      modules: [visualAssessmentModule],
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
