/*!
 * Toutour Spotlight Onboarding Tour Engine
 * Adapted from Toutour (MIT - https://github.com/matt-ye/Toutour.git)
 *
 * Requirements:
 * - Zero external runtime dependencies.
 * - Zero emojis in icons, buttons, badges, and fallbacks.
 * - Zero gradients and zero neon effects.
 * - Max z-index context: The highest overlay z-index in RehabTrainerHub is ~210;
 *   base z-index 9999 ensures the spotlight and tooltip render cleanly above all content.
 */

export interface TourStepTextObject {
  en?: string;
  'zh-TW'?: string;
  zh?: string;
  [key: string]: string | undefined;
}

export type TourStepText = string | TourStepTextObject;

export interface TourStep {
  target: string | (() => HTMLElement | null);
  title?: TourStepText;
  text: TourStepText;
  /** Material Symbol icon name, e.g. 'explore', 'search', 'tune'. Strictly NO emoji! */
  icon?: string;
  place?: 'right' | 'left' | 'top' | 'bottom';
  when?: () => boolean;
  before?: () => void | Promise<void>;
  widen?: boolean;
  timeout?: number;
}

export interface TourLabels {
  next?: TourStepText;
  prev?: TourStepText;
  done?: TourStepText;
  skip?: TourStepText;
}

export type TourEventName =
  | 'tour_start'
  | 'tour_step'
  | 'tour_done'
  | 'tour_skip'
  | 'tour_resumed';

export interface TourOptions {
  lang?: string | (() => string);
  mask?: boolean;
  ring?: boolean;
  block?: boolean;
  storageKey?: string;
  zIndex?: number;
  labels?: TourLabels;
  allowHTML?: boolean;
  startAt?: number;
  resumeMaxMin?: number;
  onEvent?: (name: TourEventName, data: Record<string, unknown>) => void;
}

interface TourElements {
  block: HTMLDivElement;
  spot: HTMLDivElement;
  tip: HTMLDivElement;
  ico: HTMLSpanElement;
  count: HTMLSpanElement;
  title: HTMLHeadingElement;
  body: HTMLDivElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  skip: HTMLButtonElement;
}

interface TourState {
  steps: TourStep[];
  index: number;
  active: boolean;
  rafId: number;
  lastRect: { top: number; left: number; w: number; h: number } | null;
  fresh: boolean;
  waitUntil: number;
  options: TourOptions;
}

const state: TourState = {
  steps: [],
  index: 0,
  active: false,
  rafId: 0,
  lastRect: null,
  fresh: false,
  waitUntil: 0,
  options: {},
};

let tourElements: TourElements | null = null;

function ClampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function EscapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ContainsEmoji(str: string): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u.test(str);
}

function StripEmoji(str: string): string {
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
}

function EnsureElements(): TourElements {
  if (tourElements && document.body.contains(tourElements.tip)) {
    return tourElements;
  }

  const CreateElement = <T extends HTMLElement>(tag: string, id: string): T => {
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }
    const element = document.createElement(tag) as T;
    element.id = id;
    document.body.appendChild(element);
    return element;
  };

  const block = CreateElement<HTMLDivElement>('div', 'ttBlock');
  const spot = CreateElement<HTMLDivElement>('div', 'ttSpot');
  const tip = CreateElement<HTMLDivElement>('div', 'ttTip');

  tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-label', 'Tour step');
  tip.setAttribute('aria-live', 'polite');

  tip.innerHTML = `
    <div class="tt-head">
      <span class="tt-ico" id="ttIco"></span>
      <span class="tt-count" id="ttCount"></span>
    </div>
    <h3 class="tt-title" id="ttTitle"></h3>
    <div class="tt-body" id="ttBody"></div>
    <div class="tt-foot">
      <button type="button" class="tt-btn" id="ttPrev"></button>
      <button type="button" class="tt-btn tt-btn-primary" id="ttNext"></button>
    </div>
    <button type="button" class="tt-skip" id="ttSkip"></button>
  `;

  tourElements = {
    block,
    spot,
    tip,
    ico: tip.querySelector('#ttIco') as HTMLSpanElement,
    count: tip.querySelector('#ttCount') as HTMLSpanElement,
    title: tip.querySelector('#ttTitle') as HTMLHeadingElement,
    body: tip.querySelector('#ttBody') as HTMLDivElement,
    prev: tip.querySelector('#ttPrev') as HTMLButtonElement,
    next: tip.querySelector('#ttNext') as HTMLButtonElement,
    skip: tip.querySelector('#ttSkip') as HTMLButtonElement,
  };

  tourElements.prev.addEventListener('click', () => {
    PrevStep();
  });
  tourElements.next.addEventListener('click', () => {
    NextStep();
  });
  tourElements.skip.addEventListener('click', () => {
    EndTour(false);
  });

  return tourElements;
}

function ResolveLanguage(): string {
  const lang = state.options.lang;
  return typeof lang === 'function' ? lang() : (lang || 'zh-TW');
}

function ResolveCopy(value: TourStepText | undefined, currentLanguage: string): string {
  if (!value) return '';
  if (typeof value === 'string') return StripEmoji(value);
  const localized = (currentLanguage === 'zh-TW' ? value['zh-TW'] : undefined)
    ?? (currentLanguage.startsWith('zh') ? (value['zh-TW'] ?? value.zh) : undefined)
    ?? value[currentLanguage]
    ?? value.zh
    ?? value['zh-TW']
    ?? value.en
    ?? Object.values(value)[0]
    ?? '';
  return StripEmoji(localized);
}

function ResolveLabel(key: keyof TourLabels): string {
  const currentLanguage = ResolveLanguage();
  const isZh = currentLanguage.startsWith('zh');
  const defaults: Record<keyof TourLabels, string> = {
    next: isZh ? '下一步' : 'Next',
    prev: isZh ? '上一步' : 'Back',
    done: isZh ? '完成' : 'Done',
    skip: isZh ? '跳過導覽' : 'Skip tour',
  };

  const configured = state.options.labels?.[key];
  return ResolveCopy(configured, currentLanguage) || defaults[key];
}

function EmitTourEvent(name: TourEventName, data: Record<string, unknown> = {}) {
  try {
    state.options.onEvent?.(name, data);
  } catch {
    // Ignore analytics errors
  }
}

function ResolveTarget(step: TourStep): HTMLElement | null {
  const selector = typeof step.target === 'function' ? step.target() : step.target;
  let element = typeof selector === 'string'
    ? document.querySelector<HTMLElement>(selector)
    : selector;

  if (!element) return null;

  // A bare input is too small a spotlight - widen to label or field container
  if (step.widen !== false && element.tagName === 'INPUT') {
    element = element.closest('label')
      || element.closest<HTMLElement>('[class*="field"],[class*="row"],[class*="block"]')
      || element;
  }
  return element;
}

function PositionSpotlight(element: HTMLElement, rect: { top: number; left: number; w: number; h: number }) {
  if (!tourElements) return;
  const spotStyle = tourElements.spot.style;

  if (state.fresh) {
    tourElements.spot.classList.add('no-anim');
  }

  spotStyle.top = `${rect.top}px`;
  spotStyle.left = `${rect.left}px`;
  spotStyle.width = `${rect.w}px`;
  spotStyle.height = `${rect.h}px`;

  let computedBorderRadius = '';
  try {
    computedBorderRadius = window.getComputedStyle(element).borderRadius;
  } catch {
    // Keep fallback
  }

  spotStyle.borderRadius = computedBorderRadius && computedBorderRadius !== '0px'
    ? computedBorderRadius
    : '8px';

  if (state.fresh) {
    state.fresh = false;
    requestAnimationFrame(() => {
      tourElements?.spot.classList.remove('no-anim');
    });
  }
}

function PlaceTooltip(rect: { top: number; left: number; w: number; h: number }, step: TourStep) {
  if (!tourElements) return;
  const tip = tourElements.tip;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 12;
  const margin = 10;
  const tipWidth = tip.offsetWidth;
  const tipHeight = tip.offsetHeight;

  const spaces: Record<string, number> = {
    right: viewportWidth - (rect.left + rect.w) - gap - margin,
    left: rect.left - gap - margin,
    bottom: viewportHeight - (rect.top + rect.h) - gap - margin,
    top: rect.top - gap - margin,
  };

  const isMobile = viewportWidth <= 768;
  let order = isMobile
    ? ['bottom', 'top', 'right', 'left']
    : ['bottom', 'right', 'left', 'top'];

  if (step.place) {
    order = [step.place, ...order.filter((side) => side !== step.place)];
  }

  let chosenSide: string | null = null;
  for (const side of order) {
    const needed = (side === 'left' || side === 'right') ? tipWidth : tipHeight;
    if (spaces[side] >= needed) {
      chosenSide = side;
      break;
    }
  }

  tip.classList.remove('tip-left', 'tip-right', 'tip-top', 'tip-bottom');

  if (!chosenSide) {
    // Target dominates the screen - pin to bottom or top freer edge
    const centerX = ClampValue((viewportWidth - tipWidth) / 2, margin, Math.max(margin, viewportWidth - tipWidth - margin));
    const centerY = rect.top + rect.h / 2 > viewportHeight / 2
      ? margin
      : viewportHeight - tipHeight - margin;
    tip.style.left = `${centerX}px`;
    tip.style.top = `${centerY}px`;
    return;
  }

  const centerX = rect.left + rect.w / 2;
  const centerY = rect.top + rect.h / 2;
  let tipX = 0;
  let tipY = 0;

  if (chosenSide === 'right') {
    tipX = rect.left + rect.w + gap;
    tipY = ClampValue(centerY - tipHeight / 2, margin, viewportHeight - tipHeight - margin);
  } else if (chosenSide === 'left') {
    tipX = rect.left - gap - tipWidth;
    tipY = ClampValue(centerY - tipHeight / 2, margin, viewportHeight - tipHeight - margin);
  } else if (chosenSide === 'bottom') {
    tipY = rect.top + rect.h + gap;
    tipX = ClampValue(centerX - tipWidth / 2, margin, viewportWidth - tipWidth - margin);
  } else if (chosenSide === 'top') {
    tipY = rect.top - gap - tipHeight;
    tipX = ClampValue(centerX - tipWidth / 2, margin, viewportWidth - tipWidth - margin);
  }

  tip.classList.add(`tip-${chosenSide}`);
  const arrowOffset = chosenSide === 'left' || chosenSide === 'right'
    ? ClampValue(centerY - tipY - 5, 14, tipHeight - 20)
    : ClampValue(centerX - tipX - 5, 14, tipWidth - 20);

  tip.style.setProperty('--tt-arrow-off', `${arrowOffset}px`);
  tip.style.left = `${tipX}px`;
  tip.style.top = `${tipY}px`;
}

function TickAnimation() {
  if (!state.active) {
    state.rafId = 0;
    return;
  }

  state.rafId = requestAnimationFrame(TickAnimation);
  const currentStep = state.steps[state.index];
  const targetElement = currentStep ? ResolveTarget(currentStep) : null;
  const clientRect = targetElement?.getBoundingClientRect();

  if (!targetElement || !clientRect || (!clientRect.width && !clientRect.height)) {
    if (performance.now() > state.waitUntil) {
      if (state.index < state.steps.length - 1) {
        ShowStep(state.index + 1);
      } else {
        EndTour(true);
      }
    }
    return;
  }

  const padding = 6;
  const currentRect = {
    top: clientRect.top - padding,
    left: clientRect.left - padding,
    w: clientRect.width + padding * 2,
    h: clientRect.height + padding * 2,
  };

  const previous = state.lastRect;
  if (previous
    && Math.abs(previous.top - currentRect.top) < 0.5
    && Math.abs(previous.left - currentRect.left) < 0.5
    && Math.abs(previous.w - currentRect.w) < 0.5
    && Math.abs(previous.h - currentRect.h) < 0.5) {
    return;
  }

  state.lastRect = currentRect;
  PositionSpotlight(targetElement, currentRect);
  PlaceTooltip(currentRect, currentStep);
}

function RenderStep(step: TourStep, index: number) {
  if (!tourElements) return;
  const currentLanguage = ResolveLanguage();

  // Render icon using Material Symbols - strictly NO emojis!
  if (step.icon && !ContainsEmoji(step.icon)) {
    tourElements.ico.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${EscapeHtml(step.icon)}</span>`;
    tourElements.ico.style.display = 'inline-flex';
  } else {
    tourElements.ico.innerHTML = '';
    tourElements.ico.style.display = 'none';
  }

  tourElements.count.textContent = `${index + 1} / ${state.steps.length}`;

  const titleText = ResolveCopy(step.title, currentLanguage);
  if (titleText) {
    tourElements.title.textContent = titleText;
    tourElements.title.style.display = 'block';
  } else {
    tourElements.title.textContent = '';
    tourElements.title.style.display = 'none';
  }

  const bodyText = ResolveCopy(step.text, currentLanguage);
  if (state.options.allowHTML) {
    tourElements.body.innerHTML = bodyText;
  } else {
    tourElements.body.textContent = bodyText;
  }

  tourElements.prev.style.visibility = index === 0 ? 'hidden' : 'visible';
  tourElements.prev.textContent = ResolveLabel('prev');
  tourElements.next.textContent = index === state.steps.length - 1
    ? ResolveLabel('done')
    : ResolveLabel('next');
  tourElements.skip.textContent = ResolveLabel('skip');

  try {
    tourElements.next.focus({ preventScroll: true });
  } catch {
    // Ignore focus error in headless/test environments
  }
}

function ShowStep(index: number) {
  state.index = index;
  state.lastRect = null;
  const step = state.steps[index];
  if (!step) return;

  state.waitUntil = performance.now() + (step.timeout || 4000);

  try {
    if (step.before) {
      step.before();
    }
  } catch {
    // Ignore step.before error
  }

  RenderStep(step, index);
  SavePosition(index);
  EmitTourEvent('tour_step', { step: index + 1, total: state.steps.length });

  setTimeout(() => {
    const element = ResolveTarget(step);
    if (element && state.active) {
      try {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        element.scrollIntoView();
      }
    }
  }, 50);

  if (!state.rafId) {
    TickAnimation();
  }
}

function NextStep() {
  if (state.index < state.steps.length - 1) {
    ShowStep(state.index + 1);
  } else {
    EndTour(true);
  }
}

function PrevStep() {
  if (state.index > 0) {
    ShowStep(state.index - 1);
  }
}

function HandleKeyDown(event: KeyboardEvent) {
  if (!state.active) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    EndTour(false);
  } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
    event.preventDefault();
    NextStep();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    PrevStep();
  }
}

function GetStorageKey(options?: TourOptions): string {
  return (options && options.storageKey) || 'toutour_seen';
}

function GetStoragePosKey(options?: TourOptions): string {
  return `${GetStorageKey(options)}:pos`;
}

function SavePosition(index: number) {
  try {
    localStorage.setItem(
      GetStoragePosKey(state.options),
      JSON.stringify({ step: index + 1, at: Date.now() }),
    );
  } catch {
    // Ignore localStorage errors in private browsing
  }
}

function ClearPosition(options?: TourOptions) {
  try {
    localStorage.removeItem(GetStoragePosKey(options));
  } catch {
    // Ignore
  }
}

export function IsTourSeen(options?: TourOptions): boolean {
  try {
    return Boolean(localStorage.getItem(GetStorageKey(options)));
  } catch {
    return false;
  }
}

export function MarkTourSeen(options?: TourOptions) {
  try {
    localStorage.setItem(GetStorageKey(options), '1');
  } catch {
    // Ignore
  }
}

export function ResetTourSeen(options?: TourOptions) {
  try {
    localStorage.removeItem(GetStorageKey(options));
    localStorage.removeItem(GetStoragePosKey(options));
  } catch {
    // Ignore
  }
}

export function IsTourActive(): boolean {
  return state.active;
}

export function EndTour(done: boolean = false) {
  if (!state.active) return;
  state.active = false;
  cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  state.lastRect = null;

  if (tourElements) {
    tourElements.block.classList.remove('show');
    tourElements.spot.classList.remove('show');
    tourElements.tip.classList.remove('show');
  }

  document.removeEventListener('keydown', HandleKeyDown, true);
  MarkTourSeen(state.options);
  ClearPosition(state.options);
  EmitTourEvent(done ? 'tour_done' : 'tour_skip', {
    step: state.index + 1,
    total: state.steps.length,
  });
}

export function StartTour(steps: TourStep[], options?: TourOptions): boolean {
  if (state.active) {
    EndTour(false);
  }

  state.options = options || {};
  const elements = EnsureElements();

  // Filter valid steps whose targets resolve
  state.steps = (steps || []).filter((st) => (!st.when || st.when()) && Boolean(ResolveTarget(st)));
  if (state.steps.length === 0) {
    return false;
  }

  state.active = true;
  state.fresh = true;

  // Max z-index in Hub is ~210; 9999 sits comfortably on top
  const baseZIndex = state.options.zIndex || 9999;
  elements.block.style.zIndex = `${baseZIndex - 1}`;
  elements.spot.style.zIndex = `${baseZIndex}`;
  elements.tip.style.zIndex = `${baseZIndex + 10}`;

  elements.block.classList.toggle('show', state.options.block !== false);
  elements.spot.classList.add('show');
  elements.spot.classList.toggle('tt-mask-off', state.options.mask === false);
  elements.spot.classList.toggle('tt-ring-off', state.options.ring === false);
  elements.tip.classList.add('show');

  document.addEventListener('keydown', HandleKeyDown, true);
  EmitTourEvent('tour_start', { steps: state.steps.length });

  const initialStep = Math.min(
    Math.max(1, +(state.options.startAt || 1)),
    state.steps.length,
  ) - 1;

  ShowStep(initialStep);
  return true;
}

export function ResumeTour(steps: TourStep[], options?: TourOptions): boolean {
  const mergedOptions = options || {};
  let savedPos: { step: number; at: number } | null = null;
  try {
    const raw = localStorage.getItem(GetStoragePosKey(mergedOptions));
    if (raw) {
      savedPos = JSON.parse(raw);
    }
  } catch {
    // Ignore
  }

  const maxAgeMs = (mergedOptions.resumeMaxMin || 30) * 60000;
  if (savedPos && savedPos.step > 1 && Date.now() - (savedPos.at || 0) < maxAgeMs) {
    const resumeOptions = { ...mergedOptions, startAt: savedPos.step };
    const started = StartTour(steps, resumeOptions);
    if (started) {
      EmitTourEvent('tour_resumed', { step: savedPos.step });
    }
    return started;
  }

  return StartTour(steps, mergedOptions);
}
