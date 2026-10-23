export function GetEveryBallTutorialSteps(lang: string, inputMode: string, level: number) {
  const en = lang === 'en';
  const rules = en ? {
    1: { title: 'Clap for every basketball', text: 'This level shows basketballs only. Clap once as soon as a basketball appears.' },
    2: { title: 'Clap for basketballs only', text: 'Clap when a basketball appears. Hold still for soccer, tennis and beach balls. Clapping and holding still both count toward accuracy.' },
    3: { title: 'Clap or tap your thigh', text: 'Clap for a basketball and tap your thigh for a soccer ball. Hold still for tennis and beach balls.' },
  }[level === 1 || level === 3 ? level : 2] : {
    1: { title: '看到籃球就拍手', text: '這一關只會出現籃球。籃球一出現，就盡快拍一下手。' },
    2: { title: '只有籃球要拍手', text: '看到籃球時拍手；足球、網球或海灘球出現時保持不動。拍手和不動都算進正確率。' },
    3: { title: '拍手或拍大腿', text: '籃球出現時拍手，足球出現時拍大腿；網球和海灘球出現時保持不動。' },
  }[level === 1 || level === 3 ? level : 2];
  const input = inputMode === 'microphone'
    ? en ? { target: '.every-ball-meter', title: 'Sound level', text: 'Once the microphone is on, this bar grows with sound. A sharp clap counts as a clap and a duller slap counts as a thigh tap. Sound is analyzed on this device and never recorded.', place: 'top' }
      : { target: '.every-ball-meter', title: '收音強度', text: '開啟麥克風後，這條會隨聲音變長。清脆的拍手聲算拍手，較悶的拍擊聲算拍大腿。聲音只在這台裝置上分析，不錄音。', place: 'top' }
    : en ? { target: '.every-ball-camera', title: 'Camera view', text: 'Once the camera is on, your image and the detected hands appear here. Keep your upper body, both hands and your thighs in view. The image is analyzed on this device and never recorded.', place: 'top' }
      : { target: '.every-ball-camera', title: '相機畫面', text: '開啟相機後，這裡會顯示你的畫面與偵測到的手。請讓上半身、雙手和大腿都在畫面內。影像只在這台裝置上分析，不錄影。', place: 'top' };
  return en ? [
    { target: '.every-ball-rule-cards', ...rules, place: 'bottom' },
    { target: '.every-ball-trial-preview', title: 'One trial', text: 'Each trial starts with a short wait of 1 to 3 seconds. The ball shows for 0.9 seconds, and you have 1.8 seconds from its appearance to respond. A check or a cross follows.', place: 'bottom' },
    input,
    { target: '.every-ball-actions', title: 'Buttons work too', text: 'If clapping is hard, press Clap or Tap thigh on the screen. On a keyboard, Space is a clap and the Down arrow is a thigh tap.', place: 'top' },
    { target: '.every-ball-hud', title: 'Progress and stop', text: 'The top bar shows the level and the trial number. Stop or Escape returns to the settings without saving this session.', place: 'bottom' },
  ] : [
    { target: '.every-ball-rule-cards', ...rules, place: 'bottom' },
    { target: '.every-ball-trial-preview', title: '每一題的順序', text: '每題先等待 1 到 3 秒，接著球出現 0.9 秒。從球出現起有 1.8 秒可以反應，之後顯示打勾或打叉。', place: 'bottom' },
    input,
    { target: '.every-ball-actions', title: '也可以按按鈕', text: '拍手不方便時，可以按畫面上的「拍手」「拍大腿」。用鍵盤時，空白鍵是拍手，方向鍵下是拍大腿。', place: 'top' },
    { target: '.every-ball-hud', title: '進度與停止', text: '上方顯示關卡和第幾題。按「停止」或 Esc 會回到設定，這次紀錄不保存。', place: 'bottom' },
  ];
}
