export function AnimateVisibleGameCards(grid: HTMLElement | null, previousIds: ReadonlySet<string>) {
  const animations: Animation[] = [];
  if (!grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  for (const card of grid.querySelectorAll<HTMLElement>('[data-runtime-id]')) {
    if (previousIds.has(card.dataset.runtimeId ?? '') || !card.animate) continue;
    const rect = card.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) continue;
    animations.push(card.animate([{ transform: 'translateY(6px)' }, { transform: 'translateY(0)' }], {
      duration: 160, delay: Math.min(animations.length * 24, 96), fill: 'backwards', easing: 'cubic-bezier(.2,.75,.25,1)',
    }));
  }
  return () => animations.forEach(animation => animation.cancel());
}

let generation = 0;
let active: { transition?: ViewTransition; cleanup: () => void } | null = null;

export function CancelHubGameTransition() {
  generation++;
  active?.transition?.skipTransition();
  active?.cleanup();
  active = null;
}

export function TransitionGameSurface(source: HTMLElement | null, update: () => HTMLElement | null) {
  CancelHubGameTransition();
  const current = generation;
  if (!source?.isConnected || !document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const previousSourceName = source.style.getPropertyValue('view-transition-name');
  let destination: HTMLElement | null = null;
  let previousDestinationName = '';
  let updated = false;
  const restoreName = (element: HTMLElement, value: string) => {
    if (value) element.style.setProperty('view-transition-name', value);
    else element.style.removeProperty('view-transition-name');
  };
  const session = { transition: undefined as ViewTransition | undefined, cleanup: () => {
    restoreName(source, previousSourceName);
    if (destination) restoreName(destination, previousDestinationName);
  } };
  source.style.setProperty('view-transition-name', 'hub-game-surface');
  active = session;
  try {
    const transition = document.startViewTransition(() => {
      if (current !== generation) return;
      restoreName(source, previousSourceName);
      updated = true;
      destination = update();
      if (destination?.isConnected) {
        previousDestinationName = destination.style.getPropertyValue('view-transition-name');
        destination.style.setProperty('view-transition-name', 'hub-game-surface');
      }
    });
    session.transition = transition;
    void transition.ready.catch(() => {});
    void transition.finished.catch(() => {}).then(() => {
      if (active !== session) return;
      session.cleanup();
      active = null;
    });
  } catch {
    session.cleanup();
    if (active === session) active = null;
    if (!updated && current === generation) update();
  }
}
