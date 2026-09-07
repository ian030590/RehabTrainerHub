import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  IsTourSeen,
  ResumeTour,
  StartTour,
  type TourStep,
} from '@rehab-trainer/ui/tour';
import { GetHubUiCopy } from '../i18n';

export const hubTourStorageKey = 'rehab_hub_tour_seen';

export function CreateHubTourSteps(language: 'zh' | 'en'): TourStep[] {
  const copy = GetHubUiCopy(language).tour;

  return [
    {
      target: '.hub-brand',
      icon: 'home',
      title: copy.steps.welcome.title,
      text: copy.steps.welcome.text,
      place: 'bottom',
    },
    {
      target: '.hub-nav',
      icon: 'navigation',
      title: copy.steps.navigation.title,
      text: copy.steps.navigation.text,
      place: 'bottom',
    },
    {
      target: '.module-search',
      icon: 'search',
      title: copy.steps.search.title,
      text: copy.steps.search.text,
      place: 'bottom',
    },
    {
      target: '.filter-panel',
      icon: 'tune',
      title: copy.steps.filters.title,
      text: copy.steps.filters.text,
      place: 'right',
    },
    {
      target: () => document.querySelector('.official-game-card') as HTMLElement | null
        || document.querySelector('.module-card') as HTMLElement | null,
      icon: 'sports_esports',
      title: copy.steps.activityCards.title,
      text: copy.steps.activityCards.text,
      place: 'bottom',
    },
    {
      target: '#hub-guide-button',
      icon: 'explore',
      title: copy.steps.guideHelp.title,
      text: copy.steps.guideHelp.text,
      place: 'bottom',
    },
  ];
}

export function StartHubTour(language: 'zh' | 'en', options: { force?: boolean } = {}): boolean {
  if (typeof window === 'undefined') return false;

  const copy = GetHubUiCopy(language).tour;
  const steps = CreateHubTourSteps(language);

  const tourOptions = {
    lang: language === 'en' ? 'en' : 'zh-TW',
    storageKey: hubTourStorageKey,
    zIndex: 9999,
    labels: {
      next: copy.next,
      prev: copy.prev,
      done: copy.done,
      skip: copy.skip,
    },
  };

  if (options.force) {
    return StartTour(steps, tourOptions);
  }

  return ResumeTour(steps, tourOptions);
}

export function useHubTourAutoStart(language: 'zh' | 'en') {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tourParam = searchParams.get('tour');
      if (tourParam === '1' || tourParam === 'guide') {
        const timer = window.setTimeout(() => {
          StartHubTour(language, { force: true });
        }, 300);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Ignore location search errors
    }

    // Auto-show for first-time visitors on the home lobby
    if (!IsTourSeen({ storageKey: hubTourStorageKey })) {
      const timer = window.setTimeout(() => {
        StartHubTour(language);
      }, 800);
      return () => window.clearTimeout(timer);
    }
  }, [language, pathname]);
}
