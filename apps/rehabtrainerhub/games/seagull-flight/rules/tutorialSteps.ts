export function GetSeagullTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.seagull-preview-flap', title: 'One nod, one wing flap', place: 'bottom',
      text: 'Keep your eyes on the cross on the seagull\'s back. Raise your head, then lower it (or lower it, then raise it) past the nod angle you set. That is one nod: the seagull flaps once and climbs. Move only within a range that feels comfortable.' },
    { target: '.seagull-preview-glide', title: 'Turn your head to glide to the rings', place: 'bottom',
      text: 'Turn your head left or right and the seagull glides to that side. At the turn angle you set, it reaches the edge. Rings come on alternate sides, always within your turn range and most often at middle distances. Fly through a ring to score.' },
    { target: '.seagull-preview-sea', title: 'Flap before you reach the sea', place: 'top',
      text: 'Without flapping, the seagull sinks faster and faster. Nod when the height bar gets low. Touching the sea ends this flight. In keyboard mode, Space or the Up arrow flaps and the Left and Right arrows glide.' },
    { target: '.seagull-hud', title: 'Time and stop', place: 'bottom',
      text: 'The top bar shows the time left, the rings passed and missed, and the height. The flight ends when time runs out. Stop or Escape returns to the settings without saving this flight.' },
  ] : [
    { target: '.seagull-preview-flap', title: '點頭一次，拍一次翅膀', place: 'bottom',
      text: '眼睛看著海鷗背上的十字。頭往上抬、再往下點（或先下後上），超過設定的點頭角度就算一次，海鷗會拍一下翅膀往上飛。只在舒適、沒有不適的範圍內活動。' },
    { target: '.seagull-preview-glide', title: '左右轉頭，滑向圓環', place: 'bottom',
      text: '頭轉向左邊或右邊，海鷗就滑向那一側；轉到設定的左右轉頭角度時，海鷗會到最邊緣。圓環輪流出現在左右兩側，距離都在設定的轉頭範圍內，中間的距離最常出現。穿過圓環就得分。' },
    { target: '.seagull-preview-sea', title: '落海前記得拍翅膀', place: 'top',
      text: '不拍翅膀時，海鷗會越降越快。高度條變低時記得點頭；碰到海面就會落海，這次飛行直接結束。鍵盤模式用空白鍵或上方向鍵拍翅，左右方向鍵滑翔。' },
    { target: '.seagull-hud', title: '時間與停止', place: 'bottom',
      text: '上方顯示剩餘時間、穿過與錯過的圓環數，以及高度。時間到會自動結束；按「停止」或 Esc 會回到設定，這次紀錄不保存。' },
  ];
}
