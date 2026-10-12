'use client';

import { useEffect, useRef, useState } from 'react';
import { GetSheetDetents, ResolveSheetTarget, StepSheetSpring } from '../bottomSheetMotion';

export function useBottomSheet(open: boolean, onDismiss: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controlsRef = useRef<{ setOpen: (value: boolean) => void; toggle: () => void } | null>(null);
  const onDismissRef = useRef(onDismiss);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!isMobile) {
      dialog.open = true;
      onDismissRef.current();
      return;
    }
    dialog.close();
    const content = dialog.querySelector<HTMLElement>('[data-bottom-sheet-content]');
    const page = dialog.closest<HTMLElement>('[data-bottom-sheet-page]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const getDetents = () => GetSheetDetents(window.visualViewport?.height ?? window.innerHeight,
      parseFloat(getComputedStyle(dialog).getPropertyValue('--sheet-safe-top')) || 0);
    let detents = getDetents();
    let motion = { position: 0, velocity: 0 };
    let target = detents.medium;
    let frame = 0;
    let previousTime = 0;
    let restorePage: (() => void) | null = null;
    let suppressClickUntil = 0;
    let gesture: {
      x: number; y: number; height: number; lastY: number; time: number;
      velocity: number; dragged: boolean; inContent: boolean; detent: number;
    } | null = null;

    const render = () => {
      dialog.style.setProperty('--sheet-height', `${Math.max(detents.medium, motion.position)}px`);
      dialog.style.setProperty('--sheet-offset', `${Math.max(0, detents.medium - motion.position)}px`);
      const progress = String(Math.min(1, Math.max(0, motion.position / detents.medium)));
      dialog.style.setProperty('--sheet-scrim', progress);
      if (!reducedMotion.matches) page?.style.setProperty('--sheet-page-progress', progress);
    };
    const unlock = () => {
      restorePage?.();
      restorePage = null;
    };
    const finish = () => {
      if (target !== 0) return;
      dialog.close();
      unlock();
      onDismissRef.current();
    };
    const tick = (time: number) => {
      motion = StepSheetSpring(motion, target, previousTime ? (time - previousTime) / 1000 : 1 / 60);
      previousTime = time;
      render();
      if (motion.position === target && motion.velocity === 0) {
        frame = 0;
        finish();
      } else frame = requestAnimationFrame(tick);
    };
    const settle = (nextTarget: number, velocity = 0) => {
      cancelAnimationFrame(frame);
      target = nextTarget;
      gesture = null;
      dialog.dataset.sheetDetent = target === 0 ? 'closed' : target === detents.large ? 'large' : 'medium';
      setIsExpanded(target === detents.large);
      motion.velocity = velocity * 1000;
      if (reducedMotion.matches) {
        motion = { position: target, velocity: 0 };
        render();
        finish();
      } else {
        previousTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      detents = getDetents();
      const viewport = window.visualViewport;
      dialog.style.setProperty('--sheet-bottom', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
      if (dialog.open) settle(target === 0 ? 0 : dialog.dataset.sheetDetent === 'large' ? detents.large : detents.medium);
    };
    const setOpen = (value: boolean) => {
      if (!value) {
        if (dialog.open && target !== 0) settle(0);
        return;
      }
      if (!dialog.open) {
        const body = document.body;
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const saved = {
          position: body.style.position, top: body.style.top, left: body.style.left,
          right: body.style.right, width: body.style.width, overflow: body.style.overflow,
        };
        const focus = document.activeElement as HTMLElement | null;
        const pageOrigin = page?.style.getPropertyValue('--sheet-page-origin') ?? '';
        const pageProgress = page?.style.getPropertyValue('--sheet-page-progress') ?? '';
        restorePage = () => {
          Object.assign(body.style, saved);
          for (const [name, value] of [['--sheet-page-origin', pageOrigin], ['--sheet-page-progress', pageProgress]]) {
            if (value) page?.style.setProperty(name, value);
            else page?.style.removeProperty(name);
          }
          window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
          if (focus?.isConnected) focus.focus({ preventScroll: true });
        };
        Object.assign(body.style, { position: 'fixed', top: `${-scrollY}px`, left: `${-scrollX}px`, right: '0', width: '100%', overflow: 'hidden' });
        page?.style.setProperty('--sheet-page-origin', `${scrollY}px`);
        motion = { position: 0, velocity: 0 };
        if (content) content.scrollTop = 0;
        resize();
        render();
        dialog.showModal();
      }
      settle(detents.medium);
    };
    const start = (x: number, y: number, element: EventTarget | null) => {
      if (!dialog.open || target === 0 || !(element instanceof Element)) return false;
      const grabber = element.closest('[data-bottom-sheet-grabber]');
      if (!grabber && element.closest('button, input:not([type="checkbox"]), select, textarea, a')) return false;
      const inContent = !!element.closest('[data-bottom-sheet-content]');
      if (!inContent && !element.closest('[data-bottom-sheet-drag-region]') && !grabber) return false;
      gesture = { x, y, height: motion.position, lastY: y, time: performance.now(), velocity: 0, dragged: false, inContent, detent: target };
      return true;
    };
    const move = (x: number, y: number, event: Event) => {
      if (!gesture) return;
      const distance = y - gesture.y;
      if (!gesture.dragged && Math.abs(x - gesture.x) > Math.abs(distance)) { gesture = null; return; }
      if (!gesture.dragged && Math.abs(distance) < 6) return;
      if (!gesture.dragged && gesture.inContent && motion.position >= detents.large - 1 && ((content?.scrollTop ?? 0) > 0 || distance < 0)) {
        gesture.y = y;
        gesture.lastY = y;
        gesture.time = performance.now();
        return;
      }
      if (event.cancelable) event.preventDefault();
      if (event instanceof PointerEvent && event.pointerType !== 'touch' && !dialog.hasPointerCapture(event.pointerId)) dialog.setPointerCapture(event.pointerId);
      cancelAnimationFrame(frame);
      const now = performance.now();
      gesture.velocity = (gesture.lastY - y) / Math.max(1, now - gesture.time);
      gesture.time = now;
      gesture.lastY = y;
      gesture.dragged = true;
      suppressClickUntil = now + 400;
      const height = gesture.height - distance;
      if (gesture.inContent && content) content.scrollTop = Math.max(0, height - detents.large);
      if (gesture.inContent && height > detents.large) {
        motion.position = detents.large;
      } else motion.position = height > detents.large ? detents.large + (height - detents.large) * 0.15 : Math.max(0, height);
      render();
    };
    const end = (cancelled = false) => {
      if (!gesture) return;
      if (gesture.dragged) {
        const velocity = performance.now() - gesture.time > 100 ? 0 : gesture.velocity;
        settle(cancelled ? gesture.detent : ResolveSheetTarget(motion.position, velocity, detents), cancelled ? 0 : velocity);
      } else gesture = null;
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { end(true); return; }
      start(event.touches[0].clientX, event.touches[0].clientY, event.target);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { end(true); return; }
      move(event.touches[0].clientX, event.touches[0].clientY, event);
    };
    const touchEnd = () => end();
    const cancelGesture = () => end(true);
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
      start(event.clientX, event.clientY, event.target);
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') move(event.clientX, event.clientY, event);
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      end();
      if (dialog.hasPointerCapture(event.pointerId)) dialog.releasePointerCapture(event.pointerId);
    };
    const pointerCancel = (event: PointerEvent) => { if (event.pointerType !== 'touch') end(true); };
    const cancel = (event: Event) => { event.preventDefault(); settle(0); };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right)) settle(0);
    };
    const close = () => { if (!dialog.open) { unlock(); onDismissRef.current(); } };
    controlsRef.current = {
      setOpen,
      toggle: () => { if (dialog.open && target !== 0) settle(target === detents.large ? detents.medium : detents.large); },
    };
    dialog.addEventListener('touchstart', touchStart, { passive: true });
    dialog.addEventListener('touchmove', touchMove, { passive: false });
    dialog.addEventListener('touchend', touchEnd);
    dialog.addEventListener('touchcancel', cancelGesture);
    dialog.addEventListener('pointerdown', pointerDown);
    dialog.addEventListener('pointermove', pointerMove);
    dialog.addEventListener('pointerup', pointerUp);
    dialog.addEventListener('pointercancel', pointerCancel);
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('click', click, true);
    dialog.addEventListener('close', close);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      cancelAnimationFrame(frame);
      controlsRef.current = null;
      dialog.removeEventListener('touchstart', touchStart);
      dialog.removeEventListener('touchmove', touchMove);
      dialog.removeEventListener('touchend', touchEnd);
      dialog.removeEventListener('touchcancel', cancelGesture);
      dialog.removeEventListener('pointerdown', pointerDown);
      dialog.removeEventListener('pointermove', pointerMove);
      dialog.removeEventListener('pointerup', pointerUp);
      dialog.removeEventListener('pointercancel', pointerCancel);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('click', click, true);
      dialog.removeEventListener('close', close);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      dialog.close();
      unlock();
      for (const property of ['--sheet-height', '--sheet-offset', '--sheet-scrim', '--sheet-bottom']) dialog.style.removeProperty(property);
      delete dialog.dataset.sheetDetent;
    };
  }, [isMobile]);

  useEffect(() => { controlsRef.current?.setOpen(open); }, [open, isMobile]);
  return { dialogRef, isMobile, isExpanded, toggleDetent: () => controlsRef.current?.toggle() };
}
