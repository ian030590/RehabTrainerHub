export function GetStroopTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.stroop-word', title: 'Answer the ink, not the word', text: 'A color word appears in red, green or blue ink. Sometimes the word and its ink match, sometimes they do not. Always answer the ink color.', place: 'bottom' },
    { target: '.stroop-pads', title: 'Three color buttons', text: 'Tap the button for the ink color, or press R, G or B. Here the word says green but the ink is blue, so the answer is Blue. Each answer shows right or wrong for a moment.', place: 'top' },
    { target: '.stroop-hud', title: 'Practice, progress and stop', text: 'Practice items come first and are not counted. The bar shows how many items are left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.stroop-word', title: '看字的顏色，不看字義', text: '畫面會出現用紅、綠或藍色寫的顏色字。字義和顏色有時相同，有時不同，一律回答字的顏色。', place: 'bottom' },
    { target: '.stroop-pads', title: '三個顏色按鈕', text: '點選字的顏色，或按 R、G、B 鍵。這裡的字是「綠」，但顏色是藍色，所以要按「藍」。每次作答後會短暫顯示對錯。', place: 'top' },
    { target: '.stroop-hud', title: '練習、進度與停止', text: '先做練習題，不列入成果。上方顯示還剩多少題。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
