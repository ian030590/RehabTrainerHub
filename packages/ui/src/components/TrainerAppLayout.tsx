import type { ReactNode } from 'react';
import { CloudflareWebAnalytics } from './CloudflareWebAnalytics';
import {
  DevicePerformanceNotice,
  type DevicePerformanceNoticeLocale,
} from './DevicePerformanceNotice';
import { RehabFooter, type RehabFooterProps } from './RehabFooter';

export interface TrainerAppLayoutProps {
  analyticsToken?: string;
  children: ReactNode;
  footer: RehabFooterProps;
  locale?: DevicePerformanceNoticeLocale;
  navbar: ReactNode;
  skipLinkLabel?: string;
  skipLinkHref?: string;
}

function IsHubOrigin(url: string): boolean {
  try {
    const { hostname, origin, protocol } = new URL(url);
    return origin === 'https://trainerhub.cc'
      || origin === 'https://rehabtrainerhub.pages.dev'
      || (protocol === 'https:' && hostname.endsWith('.rehabtrainerhub.pages.dev'))
      || (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

export function TrainerAppLayout({
  analyticsToken,
  children,
  footer,
  locale = 'zh-TW',
  navbar,
  skipLinkLabel,
  skipLinkHref = '#main-content',
}: TrainerAppLayoutProps) {
  const isEmbeddedHubTraining = typeof window !== 'undefined'
    && window.self !== window.top
    && new URLSearchParams(window.location.search).get('embed') === 'hub'
    && IsHubOrigin(document.referrer);

  return (
    <div className="app-layout">
      {skipLinkLabel && (
        <a className="skip-link" href={skipLinkHref}>
          {skipLinkLabel}
        </a>
      )}
      {!isEmbeddedHubTraining && navbar}
      {!isEmbeddedHubTraining && <DevicePerformanceNotice locale={locale} />}
      {children}
      {!isEmbeddedHubTraining && <RehabFooter {...footer} />}
      <CloudflareWebAnalytics token={analyticsToken} />
    </div>
  );
}
