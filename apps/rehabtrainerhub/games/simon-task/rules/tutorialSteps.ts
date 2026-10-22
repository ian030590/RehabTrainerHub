export function GetSimonTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.simon-stimulus', title: 'Look at the shape, not where it is', text: 'A blue circle or an orange square appears on the left or the right. Only the shape matters; the side it shows up on does not.', place: 'bottom' },
    { target: '.simon-pads', title: 'Circle left, square right', text: 'Circle: press the left button, F or the left arrow. Square: press the right button, J or the right arrow. Answer quickly and correctly, even when the shape is on the other side.', place: 'top' },
    { target: '.simon-hud', title: 'Progress and stop', text: 'The bar shows how many shapes are left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.simon-stimulus', title: '看圖形，不看位置', text: '藍色圓形或橘色方形會出現在左邊或右邊。只看是什麼圖形，不管它出現在哪一邊。', place: 'bottom' },
    { target: '.simon-pads', title: '圓形按左，方形按右', text: '圓形按左邊按鈕、F 或左方向鍵；方形按右邊按鈕、J 或右方向鍵。圖形出現在另一邊時也一樣，要快也要按對。', place: 'top' },
    { target: '.simon-hud', title: '進度與停止', text: '上方顯示還剩多少個圖形。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
