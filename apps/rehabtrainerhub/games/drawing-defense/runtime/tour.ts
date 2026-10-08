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
  overlay.style.zIndex = String(options.zIndex);
  const spotlight = document.createElement('div');
  spotlight.className = 'game-tour-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  spotlight.style.zIndex = String(options.zIndex - 1);
  spotlight.style.boxShadow = options.mask ? '0 0 0 100vmax var(--bg-overlay)' : 'none';
  spotlight.style.outlineStyle = options.ring ? 'solid' : 'none';
  const previousFocus = document.activeElement;
  const title = document.createElement('h2');
  const text = document.createElement('p');
  const next = document.createElement('button');
  const skip = document.createElement('button');
  skip.textContent = options.lang === 'en' ? 'Skip tutorial' : '略過教學';
  const position = () => {
    const rect = document.querySelector(steps[index].target)?.getBoundingClientRect();
    spotlight.hidden = !rect;
    overlay.style.boxShadow = !rect && options.mask ? '0 0 0 100vmax var(--bg-overlay)' : 'none';
    if (rect) {
      const left = Math.max(0, rect.left - 8);
      const top = Math.max(0, rect.top - 8);
      Object.assign(spotlight.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${Math.max(0, Math.min(window.innerWidth, rect.right + 8) - left)}px`,
        height: `${Math.max(0, Math.min(window.innerHeight, rect.bottom + 8) - top)}px`,
      });
    }
    const panel = overlay.getBoundingClientRect();
    const left = rect ? rect.left + (rect.width - panel.width) / 2 : (window.innerWidth - panel.width) / 2;
    let top = (window.innerHeight - panel.height) / 2;
    if (rect) {
      const above = rect.top - 20 - panel.height;
      const below = rect.bottom + 20;
      const candidates = steps[index].place === 'bottom' ? [below, above] : [above, below];
      top = candidates.find(value => value >= 8 && value + panel.height <= window.innerHeight - 8) ?? top;
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
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    overlay.remove();
    spotlight.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  const finish = (event: string) => { dispose(); options.onEvent(event); };
  next.onclick = () => { if (index === steps.length - 1) finish('tour_done'); else { index++; render(); } };
  skip.onclick = () => finish('tour_skip');
  overlay.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); finish('tour_skip'); }
    if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === next ? skip : next).focus(); }
  };
  overlay.append(title, text, next, skip);
  document.body.append(spotlight, overlay);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  render();
  next.focus();
  return dispose;
}
