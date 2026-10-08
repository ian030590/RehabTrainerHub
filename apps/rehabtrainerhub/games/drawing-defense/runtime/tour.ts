export interface TourStep { target: string; title: string; text: string; place: string }
export function StartTour(steps: TourStep[], options: {
  lang: string; zIndex: number; mask: boolean; ring: boolean; block: boolean;
  onEvent: (name: string) => void;
}) {
  let index = 0;
  const overlay = document.createElement('section');
  overlay.className = 'game-tour';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', options.lang === 'en' ? 'Game tutorial' : '遊戲教學');
  const previousFocus = document.activeElement;
  const title = document.createElement('h2');
  const text = document.createElement('p');
  const next = document.createElement('button');
  const skip = document.createElement('button');
  skip.textContent = options.lang === 'en' ? 'Skip tutorial' : '略過教學';
  const render = () => {
    title.textContent = steps[index].title;
    text.textContent = steps[index].text;
    next.textContent = index === steps.length - 1 ? (options.lang === 'en' ? 'Done' : '完成') : (options.lang === 'en' ? 'Next' : '下一步');
  };
  const finish = (event: string) => { overlay.remove(); options.onEvent(event); };
  next.onclick = () => { if (index === steps.length - 1) finish('tour_done'); else { index++; render(); } };
  skip.onclick = () => finish('tour_skip');
  overlay.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); finish('tour_skip'); }
    if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === next ? skip : next).focus(); }
  };
  overlay.append(title, text, next, skip);
  render();
  document.body.append(overlay);
  next.focus();
  return () => { overlay.remove(); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
}
