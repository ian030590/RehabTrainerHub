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

export function TrainerAppLayout({
  analyticsToken,
  children,
  footer,
  locale = 'zh-TW',
  navbar,
  skipLinkLabel,
  skipLinkHref = '#main-content',
}: TrainerAppLayoutProps) {
  return (
    <div className="app-layout">
      {skipLinkLabel && (
        <a className="skip-link" href={skipLinkHref}>
          {skipLinkLabel}
        </a>
      )}
      {navbar}
      <DevicePerformanceNotice locale={locale} />
      {children}
      <RehabFooter {...footer} />
      <CloudflareWebAnalytics token={analyticsToken} />
    </div>
  );
}
