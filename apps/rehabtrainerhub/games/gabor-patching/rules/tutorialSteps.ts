import type { TourStep } from '../runtime/tour';

export function GetGaborTutorialSteps(language: 'zh' | 'en'): TourStep[] {
  return language === 'en' ? [
    { target: '.gabor-preview-patch', title: 'Find the striped patches', place: 'bottom',
      text: 'Patches grow and become clearer. Click or tap each patch before its lifetime expires. Patterns rotate randomly.' },
    { target: '.gabor-preview-timer', title: 'Time remaining', place: 'bottom',
      text: 'The activity ends when the countdown reaches zero. The maximum patch setting limits how many patches appear at once. Select Stop or press Escape to pause; ending the activity does not save the session.' },
    { target: '.gabor-preview-score', title: 'Weighted points', place: 'bottom',
      text: 'Earlier clicks earn more points, up to 1,000 per patch. Points decrease to zero over its lifetime. Results show total points, targets clicked, configured duration and patch details.' },
  ] : [
    { target: '.gabor-preview-patch', title: '尋找條紋斑塊', place: 'bottom',
      text: '斑塊會逐漸放大並變清楚，請在存續時間內用滑鼠或手指點擊。條紋會隨機旋轉。' },
    { target: '.gabor-preview-timer', title: '剩餘時間', place: 'bottom',
      text: '倒數歸零後結束活動，最大刺激數限制同時出現的斑塊數。按「停止」或 Escape 可暫停；結束活動不會保存這次紀錄。' },
    { target: '.gabor-preview-score', title: '加權積分', place: 'bottom',
      text: '越早點擊得分越高，每塊最高 1,000 分，隨存續時間遞減至零。成果呈現總分、點擊數、設定時間與斑塊明細。' },
  ];
}
