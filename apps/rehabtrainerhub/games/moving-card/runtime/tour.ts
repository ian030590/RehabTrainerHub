export interface TourStep { target: string; title: string; text: string; place: string }

// The game owns this spotlight implementation; it never imports another game.
export function StartTour(steps: TourStep[], options: {
  lang: string; onEvent: (name: string) => void; onBack: () => void;
}) {
  let index = 0;
  let disposed = false;
  const blocker = document.createElement('div');
  blocker.className = 'game-tour-blocker';
  blocker.setAttribute('aria-hidden', 'true');
  const spotlight = document.createElement('div');
  spotlight.className = 'game-tour-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  const overlay = document.createElement('section');
  overlay.className = 'game-tour';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'moving-card-tour-title');
  const previousFocus = document.activeElement;
  const title = document.createElement('h2');
  title.id = 'moving-card-tour-title';
  const text = document.createElement('p');
  const next = document.createElement('button');
  const skip = document.createElement('button');
  const back = document.createElement('button');
  for (const button of [next, skip, back]) button.type = 'button';
  skip.textContent = options.lang === 'en' ? 'Skip tutorial' : '略過教學';
  back.textContent = options.lang === 'en' ? 'Back to settings' : '返回設定';
  const position = () => {
    const rect = document.querySelector(steps[index].target)?.getBoundingClientRect();
    spotlight.hidden = !rect;
    if (rect) {
      const left = Math.max(0, rect.left - 8);
      const top = Math.max(0, rect.top - 8);
      Object.assign(spotlight.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${Math.max(0, Math.min(window.innerWidth, rect.right + 8) - left)}px`,
        height: `${Math.max(0, Math.min(window.innerHeight, rect.bottom + 8) - top)}px`,
      });
    }
    overlay.style.width = '';
    let panel = overlay.getBoundingClientRect();
    let left = rect ? rect.left + (rect.width - panel.width) / 2 : (window.innerWidth - panel.width) / 2;
    let top = (window.innerHeight - panel.height) / 2;
    if (rect) {
      const above = rect.top - 20 - panel.height;
      const below = rect.bottom + 20;
      const candidates = steps[index].place === 'bottom' ? [below, above] : [above, below];
      const vertical = candidates.find(value => value >= 8 && value + panel.height <= window.innerHeight - 8);
      if (vertical !== undefined) top = vertical;
      else {
        const rightSpace = window.innerWidth - rect.right - 28;
        const leftSpace = rect.left - 28;
        const available = Math.max(rightSpace, leftSpace);
        if (available >= 220) {
          overlay.style.width = `${Math.min(panel.width, available)}px`;
          panel = overlay.getBoundingClientRect();
          left = rightSpace >= leftSpace ? rect.right + 20 : rect.left - 20 - panel.width;
          top = rect.top + (rect.height - panel.height) / 2;
        }
      }
    }
    overlay.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.width - 8, left))}px`;
    overlay.style.top = `${Math.max(8, Math.min(window.innerHeight - panel.height - 8, top))}px`;
  };
  const render = () => {
    title.textContent = steps[index].title;
    text.textContent = steps[index].text;
    next.textContent = index === steps.length - 1 ? (options.lang === 'en' ? 'Done' : '完成') : (options.lang === 'en' ? 'Next' : '下一步');
    position();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    blocker.remove();
    overlay.remove();
    spotlight.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  const finish = (event: string) => { dispose(); options.onEvent(event); };
  next.onclick = () => { if (index === steps.length - 1) finish('tour_done'); else { index++; render(); } };
  skip.onclick = () => finish('tour_skip');
  back.onclick = () => { dispose(); options.onBack(); };
  overlay.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); finish('tour_skip'); }
    if (event.key === 'Tab') {
      event.preventDefault();
      const buttons = [next, skip, back];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(current + (event.shiftKey ? 2 : 1)) % buttons.length].focus();
    }
  };
  overlay.append(title, text, next, skip, back);
  document.body.append(blocker, spotlight, overlay);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  render();
  next.focus();
  return dispose;
}
