import { FormatReferenceModuleChip, ReferenceListPage, type ReferenceListItem } from '@rehab-trainer/ui/components/ReferenceListPage';
import '@rehab-trainer/ui/components/ReferenceListPage.css';
import { useT } from '../i18n';

export function ReferencesPage() {
  const { lang, t } = useT();
  const speech = t('mouth.speech.title');
  const oral = t('mouth.oral.title');
  const items: ReferenceListItem[] = [
    { title: 'ccoreilly/vosk-browser', href: 'https://github.com/ccoreilly/vosk-browser', description: lang === 'en' ? 'Browser speech-recognition runtime for local Vosk model inference.' : '用於本機 Vosk 語音模型推論的瀏覽器端語音辨識 runtime。', modules: [FormatReferenceModuleChip(speech, t('voice.title'))] },
    { title: 'MediaPipe Tasks Vision', href: 'https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker', description: lang === 'en' ? 'Face-landmark detection used for tongue movement calibration.' : '用於舌頭動作校正的臉部特徵點偵測。', modules: [FormatReferenceModuleChip(oral, t('tongue.title'))] },
    { title: 'TensorFlow.js KNN Classifier', href: 'https://github.com/tensorflow/tfjs-models/tree/master/knn-classifier', description: lang === 'en' ? 'K-nearest-neighbour classification used for calibrated tongue directions.' : '用於辨識校正後舌頭方向的 KNN 分類器。', modules: [FormatReferenceModuleChip(oral, t('tongue.title'))] },
  ];
  const labels = lang === 'en' ? { title: 'References', subtitle: t('mouth.references.subtitle'), githubSection: 'Projects and documentation', literatureSection: 'Literature', emptyLabel: 'No references here yet.' } : { title: '參考資料', subtitle: t('mouth.references.subtitle'), githubSection: '專案與技術文件', literatureSection: '文獻', emptyLabel: '目前沒有參考資料。' };
  return <ReferenceListPage githubItems={items} labels={labels} subtitle={labels.subtitle} title={labels.title} />;
}
