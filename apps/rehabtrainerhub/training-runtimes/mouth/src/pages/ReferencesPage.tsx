import {
  FormatReferenceModuleChip,
  GetDefaultReferenceListPageLabels,
  ReferenceListPage,
  type ReferenceListItem,
} from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../i18n';

export function ReferencesPage() {
  const { lang, t } = useT();
  const labels = GetDefaultReferenceListPageLabels(lang);
  const oral = t('mouth.oral.title');
  const items: ReferenceListItem[] = [
    {
      title: 'MediaPipe Tasks Vision',
      href: 'https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker',
      description: lang === 'en'
        ? 'Face-landmark detection used for tongue movement calibration.'
        : '用於舌頭動作校正的臉部特徵點偵測。',
      modules: [FormatReferenceModuleChip(oral, t('tongue.title'))],
    },
    {
      title: 'TensorFlow.js KNN Classifier',
      href: 'https://github.com/tensorflow/tfjs-models/tree/master/knn-classifier',
      description: lang === 'en'
        ? 'K-nearest-neighbour classification used for calibrated tongue directions.'
        : '用於辨識校正後舌頭方向的 KNN 分類器。',
      modules: [FormatReferenceModuleChip(oral, t('tongue.title'))],
    },
  ];

  const literatureItems: ReferenceListItem[] = [
    {
      title: 'Chiaramonte, R., Pavone, P., & Vecchio, M. (2020). Speech rehabilitation in dysarthria after stroke: a systematic review of the studies. European Journal of Physical and Rehabilitation Medicine, 56(5). https://doi.org/10.23736/s1973-9087.20.06185-7',
      href: 'https://doi.org/10.23736/s1973-9087.20.06185-7',
      modules: [FormatReferenceModuleChip(oral, t('tongue.title'))],
    },
  ];

  return (
    <ReferenceListPage
      githubItems={items}
      literatureItems={literatureItems}
      labels={labels}
      subtitle={labels.subtitle}
      title={labels.title}
    />
  );
}
