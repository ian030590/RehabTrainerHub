import { useEffect, type ReactNode } from 'react';
import { CloudflareWebAnalytics } from './CloudflareWebAnalytics';
import {
  DevicePerformanceNotice,
  type DevicePerformanceNoticeLocale,
} from './DevicePerformanceNotice';
import { IsEmbeddedHubTraining } from '../embeddedTraining';
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
  const isEmbeddedHubTraining = IsEmbeddedHubTraining();

  useEffect(() => {
    if (!isEmbeddedHubTraining) return;

    document.documentElement.dataset.trainingEmbed = 'hub';
    document.body.dataset.trainingEmbed = 'hub';
    return () => {
      delete document.documentElement.dataset.trainingEmbed;
      delete document.body.dataset.trainingEmbed;
    };
  }, [isEmbeddedHubTraining]);

  return (
    <div className={`app-layout ${isEmbeddedHubTraining ? 'app-layout-embedded-hub' : ''}`.trim()}>
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
