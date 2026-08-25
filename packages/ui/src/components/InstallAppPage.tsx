'use client';

import { useEffect, useState } from 'react';
import { GetInstallAppCopy } from '../i18n/installApp';
import {
  CanPromptPwaInstall,
  InitializePwa,
  IsPwaInstalled,
  PromptPwaInstall,
  SubscribeToPwaInstallState,
} from '../pwa';

export interface InstallAppPageProps {
  appName: string;
  guideAssetBaseUrl?: string;
  locale?: 'zh' | 'en';
}

function WithAppName(text: string, appName: string) {
  return text.replaceAll('{appName}', appName);
}

export function InstallAppPage({
  appName,
  guideAssetBaseUrl = 'https://trainerhub.cc/assets/pwa-install',
  locale = 'zh',
}: InstallAppPageProps) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState('');
  const copy = GetInstallAppCopy(locale);
  const withAppName = (text: string) => WithAppName(text, appName);
  const webDevSource = `https://web.dev/learn/pwa/installation${locale === 'zh' ? '?hl=zh-tw' : ''}`;
  const firefoxSource = locale === 'en'
    ? 'https://support.mozilla.org/en-US/kb/web-apps-firefox-windows'
    : 'https://support.mozilla.org/zh-TW/kb/web-apps-firefox-windows';
  const mdnSource = 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing';
  const appleSource = locale === 'en'
    ? 'https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios'
    : 'https://support.apple.com/zh-tw/guide/iphone/iphea86e5236/ios';

  useEffect(() => {
    InitializePwa();
    const syncInstallState = () => {
      setCanPrompt(CanPromptPwaInstall());
      setInstalled(IsPwaInstalled());
    };

    syncInstallState();
    return SubscribeToPwaInstallState(syncInstallState);
  }, []);

  const handleInstall = async () => {
    const result = await PromptPwaInstall();
    if (result === 'accepted' || result === 'installed') {
      setInstalled(true);
      setStatus(withAppName(copy.installed));
      return;
    }

    setStatus(result === 'dismissed' ? copy.dismissed : copy.unavailable);
  };

  return (
    <main className="install-app-page" id="main-content">
      <header className="install-app-hero">
        <p className="install-app-kicker">Progressive Web App</p>
        <h1>{copy.title}</h1>
        <p>{withAppName(copy.intro)}</p>
        <button className="install-app-button" disabled={installed} onClick={() => void handleInstall()} type="button">
          {installed ? copy.installedButton : canPrompt ? withAppName(copy.install) : copy.tryInstall}
        </button>
        {status && <p aria-live="polite" className="install-app-status">{status}</p>}
      </header>

      <div className="install-guide-grid">
        <section className="install-guide-card">
          <h2>{copy.desktopTitle}</h2>
          <ul>{copy.desktopSteps.map((step) => <li key={step}>{step}</li>)}</ul>
          <img alt={copy.desktopAlt} height="533" loading="lazy" src={`${guideAssetBaseUrl}/chrome-desktop.png`} width="800" />
          <SourceLink href={webDevSource} label={copy.desktopSource} prefix={copy.sourcePrefix} />
        </section>

        <section className="install-guide-card">
          <h2>{copy.firefoxTitle}</h2>
          <ol>{copy.firefoxSteps.map((step) => <li key={step}>{step}</li>)}</ol>
          <p className="install-guide-note">{copy.firefoxNote}</p>
          <img alt={copy.firefoxAlt} height="869" loading="lazy" src={`${guideAssetBaseUrl}/firefox-install.png`} width="764" />
          <SourceLink href={firefoxSource} label={copy.firefoxSource} prefix={copy.sourcePrefix} />
        </section>

        <section className="install-guide-card">
          <h2>{copy.iphoneTitle}</h2>
          <ol>{copy.iphoneSteps.map((step) => <li key={step}>{step}</li>)}</ol>
          <img alt={copy.iphoneAlt} height="421" loading="lazy" src={`${guideAssetBaseUrl}/iphone-safari.jpg`} width="794" />
          <SourceLink href={webDevSource} label={copy.iphoneWebSource} prefix={copy.sourcePrefix} />
          <SourceLink href={appleSource} label={copy.appleSource} prefix={copy.sourcePrefix} />
          <SourceLink href={mdnSource} label={copy.mdnSource} prefix={copy.sourcePrefix} />
        </section>

        <section className="install-guide-card install-guide-android">
          <h2>{copy.androidTitle}</h2>
          <p>{copy.androidBody}</p>
          <button className="install-app-button" disabled={installed} onClick={() => void handleInstall()} type="button">
            {installed ? copy.installedButton : withAppName(copy.androidInstall)}
          </button>
          <img alt={copy.androidAlt} height="417" loading="lazy" src={`${guideAssetBaseUrl}/android-install.png`} width="800" />
          <SourceLink href={webDevSource} label={copy.desktopSource} prefix={copy.sourcePrefix} />
        </section>
      </div>

      <aside className="install-attribution" aria-label={copy.attributionLabel}>
        {copy.attribution}{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/deed.zh-hant" rel="noreferrer" target="_blank">CC BY 4.0</a>
        {' '}{copy.attributionMiddle}{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.zh-hant" rel="noreferrer" target="_blank">CC BY-SA 3.0</a>
        {' '}{copy.attributionEnd}{' '}
        <a href="https://creativecommons.org/licenses/by-sa/2.5/deed.zh-hant" rel="noreferrer" target="_blank">CC BY-SA 2.5</a>
        {' '}{copy.attributionTail}
      </aside>
    </main>
  );
}

function SourceLink({ href, label, prefix }: { href: string; label: string; prefix: string }) {
  return (
    <a className="install-guide-source" href={href} rel="noreferrer" target="_blank">
      {prefix}{label}
    </a>
  );
}
