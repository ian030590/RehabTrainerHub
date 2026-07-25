'use client';

import { useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type PwaInstallResult = 'accepted' | 'dismissed' | 'installed' | 'unavailable';

const installStateChangedEvent = 'rehab-pwa-install-state-changed';
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;

export function IsPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function CanPromptPwaInstall(): boolean {
  return deferredInstallPrompt !== null;
}

export function SubscribeToPwaInstallState(listener: () => void): () => void {
  window.addEventListener(installStateChangedEvent, listener);
  return () => window.removeEventListener(installStateChangedEvent, listener);
}

export async function PromptPwaInstall(): Promise<PwaInstallResult> {
  if (IsPwaInstalled()) return 'installed';
  if (!deferredInstallPrompt) return 'unavailable';

  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  window.dispatchEvent(new Event(installStateChangedEvent));
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}

export function InitializePwa(): void {
  if (typeof window === 'undefined' || initialized || window.self !== window.top) return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(installStateChangedEvent));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new Event(installStateChangedEvent));
  });

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
  }
}

export function PwaRegistration() {
  useEffect(InitializePwa, []);
  return null;
}
