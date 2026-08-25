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
  const upperLimbModule = t('home.module.upperLimb.title');
  const moduleChip = (tabName: string, moduleName: string) => FormatReferenceModuleChip(tabName, moduleName);
  const motorCortexTitle = lang === 'en' ? 'Hand Target Tracking Practice' : '手部目標追蹤練習';

  const githubItems: ReferenceListItem[] = [
    {
      title: 'eduardosamman/asteroid-attack',
      href: 'https://github.com/eduardosamman/asteroid-attack',
      description: lang === 'en'
        ? 'Arcade shield-defense game used as the reference for spaceship protection, asteroid threat tiers, durability, scoring, and rising speed pressure.'
        : '作為飛船護盾防衛、小行星威脅分級、耐久、分數與速度逐步提升的遊戲邏輯參考。',
      modules: [moduleChip(upperLimbModule, t('training.asteroidShield.title'))],
    },
    {
      title: 'Kenney Space Shooter Redux',
      href: 'https://kenney.nl/assets/space-shooter-redux',
      description: lang === 'en'
        ? 'CC0 PNG spaceship, shield, asteroid, power-up, and space background assets used for Asteroid Shield Defense.'
        : 'CC0 PNG 太空船、護盾、小行星、能量物與太空背景素材，用於小行星護盾防衛。',
      modules: [moduleChip(upperLimbModule, t('training.asteroidShield.title'))],
    },
    {
      title: 'ericosborne97/MotorCortexRehabilitationProgram',
      href: 'https://github.com/ericosborne97/MotorCortexRehabilitationProgram',
      description: lang === 'en'
        ? 'Camera-based hand-tracking program used as the reference for target-following tasks, adaptive difficulty, feedback, and session records.'
        : '攝影機手部追蹤程式，作為目標追蹤任務、難度自適應、即時回饋與練習紀錄的參考。',
      modules: [moduleChip(upperLimbModule, motorCortexTitle)],
    },
    {
      title: 'google-ai-edge/mediapipe',
      href: 'https://github.com/google-ai-edge/mediapipe',
      description: lang === 'en'
        ? 'Cross-platform, customizable ML solutions for live and streaming media. Used for real-time hand tracking.'
        : '跨平台且可自訂的即時機器學習解決方案，作為即時手部追蹤的基礎工具。',
      modules: [
        moduleChip(upperLimbModule, t('training.asteroidShield.title')),
        moduleChip(upperLimbModule, motorCortexTitle)
      ],
    },
  ];

  const literatureItems: ReferenceListItem[] = [
    {
      title: 'Ikbali Afsar, S., Mirzayev, I., Umit Yemisci, O., & Cosar Saracgil, S. N. (2018). Virtual Reality in Upper Extremity Rehabilitation of Stroke Patients: A Randomized Controlled Trial. Journal of Stroke and Cerebrovascular Diseases, 27(12), 3473–3478. https://doi.org/10.1016/j.jstrokecerebrovasdis.2018.08.007',
      href: 'https://doi.org/10.1016/j.jstrokecerebrovasdis.2018.08.007',
      modules: [
        moduleChip(upperLimbModule, t('training.asteroidShield.title')),
        moduleChip(upperLimbModule, motorCortexTitle)
      ],
    },
    {
      title: 'Zhang, F., Bazarevsky, V., Vakunov, A., Volynkin, A., Tolstikhin, I., Langer, C., ... & Grundmann, M. (2020). Mediapipe hands: On-device real-time hand tracking. arXiv preprint arXiv:2006.10214. https://doi.org/10.48550/arXiv.2006.10214',
      href: 'https://doi.org/10.48550/arXiv.2006.10214',
      modules: [
        moduleChip(upperLimbModule, t('training.asteroidShield.title')),
        moduleChip(upperLimbModule, motorCortexTitle)
      ],
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
