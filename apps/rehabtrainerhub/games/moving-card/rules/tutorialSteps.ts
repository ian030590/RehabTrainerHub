export function GetMovingCardTutorialSteps(language: 'zh' | 'en') {
  return language === 'en' ? [
    { target: '.moving-card-target', title: 'Target letters', text: 'Remember the two target letters at the top. Find the card with the same letters below.', place: 'bottom' },
    { target: '.moving-card-options', title: 'Track and select', text: 'Cards relocate regularly. Click or tap the matching card. A wrong selection flashes red; retry until you find the target.', place: 'top' },
    { target: '.moving-card-round', title: 'Rounds and results', text: 'Finding the target advances to the next round. Search completion time includes retries; results also retain selection attempts and errors. Stop exits without saving an incomplete session.', place: 'bottom' },
  ] : [
    { target: '.moving-card-target', title: '目標字母', text: '記住上方的兩個目標字母，在下方卡片中找出相同的字母組合。', place: 'bottom' },
    { target: '.moving-card-options', title: '追蹤並選擇', text: '卡片會定期移動位置，以滑鼠點擊或觸控選擇相符卡片。選錯會閃紅色，請重試直到找到目標。', place: 'top' },
    { target: '.moving-card-round', title: '回合與成果', text: '找到目標後進入下一回合。搜尋完成時間含重試，結算也保留選擇次數與錯誤次數。停止訓練會退出，不保存未完成的活動。', place: 'bottom' },
  ];
}
