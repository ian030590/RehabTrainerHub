'use client';

import { useEffect, useState } from 'react';
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
}

const webDevSource = 'https://web.dev/learn/pwa/installation?hl=zh-tw';
const firefoxSource = 'https://support.mozilla.org/zh-TW/kb/web-apps-firefox-windows';
const mdnSource = 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing';
const appleSource = 'https://support.apple.com/zh-tw/guide/iphone/iphea86e5236/ios';

export function InstallAppPage({
  appName,
  guideAssetBaseUrl = 'https://trainerhub.cc/assets/pwa-install',
}: InstallAppPageProps) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState('');

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
      setStatus(`${appName} 已安裝。`);
      return;
    }

    setStatus(
      result === 'dismissed'
        ? '已取消安裝。'
        : '目前瀏覽器沒有提供安裝提示，請依下方對應步驟安裝。',
    );
  };

  return (
    <main className="install-app-page" id="main-content">
      <header className="install-app-hero">
        <p className="install-app-kicker">Progressive Web App</p>
        <h1>下載程式</h1>
        <p>將 {appName} 加到裝置，之後可從主畫面或應用程式列表直接開啟。</p>
        <button
          className="install-app-button"
          disabled={installed}
          onClick={() => void handleInstall()}
          type="button"
        >
          {installed ? '已安裝' : canPrompt ? `安裝 ${appName}` : '嘗試安裝此程式'}
        </button>
        {status && <p aria-live="polite" className="install-app-status">{status}</p>}
      </header>

      <div className="install-guide-grid">
        <section className="install-guide-card">
          <h2>桌面版 Chrome</h2>
          <ul>
            <li>網址列會顯示安裝徽章（圖示），表示目前網站可供安裝。</li>
            <li>瀏覽器的下拉式選單也包含「安裝」項目。</li>
          </ul>
          <img
            alt="電腦版 Chrome 和 Edge 的 PWA 安裝選單項目"
            height="533"
            loading="lazy"
            src={`${guideAssetBaseUrl}/chrome-desktop.png`}
            width="800"
          />
          <SourceLink href={webDevSource} label="web.dev「安裝」" />
        </section>

        <section className="install-guide-card">
          <h2>Windows 版 Firefox</h2>
          <ol>
            <li>在 Firefox 中，點擊網址列中出現的網頁應用程式按鈕。</li>
            <li>Firefox 將會安裝該網站，並顯示在您的 Windows 工作列中。</li>
            <li>看到釘選通知時，點擊「是」即可保留在工作列。</li>
          </ol>
          <p className="install-guide-note">
            網頁應用程式僅適用於 Windows 版 Firefox 143 起；Microsoft Store 版本自 150 起支援。
          </p>
          <img
            alt="Firefox 提示將網站加入 Windows 工作列並以獨立視窗開啟"
            height="869"
            loading="lazy"
            src={`${guideAssetBaseUrl}/firefox-install.png`}
            width="764"
          />
          <SourceLink href={firefoxSource} label="Mozilla Support「在 Windows 版 Firefox 中使用網路應用程式」" />
        </section>

        <section className="install-guide-card">
          <h2>iPhone Safari</h2>
          <ol>
            <li>開啟瀏覽器底部或頂部的「分享」選單。</li>
            <li>按一下「新增至主畫面」。</li>
            <li>確認應用程式名稱。</li>
            <li>開啟「打開為網頁 App」，再按一下「加入」。</li>
          </ol>
          <img
            alt="iPhone 加入主畫面、安裝提示與主畫面圖示"
            height="421"
            loading="lazy"
            src={`${guideAssetBaseUrl}/iphone-safari.jpg`}
            width="794"
          />
          <SourceLink href={webDevSource} label="web.dev「iOS 和 iPadOS 安裝」" />
          <SourceLink href={appleSource} label="Apple「將網站變成 App」" />
          <SourceLink href={mdnSource} label="MDN「Installing and uninstalling web apps」圖片" />
        </section>

        <section className="install-guide-card install-guide-android">
          <h2>Android</h2>
          <p>在 Android 上，PWA 安裝提示會因裝置和瀏覽器而異，選單可能顯示「安裝」或「新增至主畫面」。</p>
          <button
            className="install-app-button"
            disabled={installed}
            onClick={() => void handleInstall()}
            type="button"
          >
            {installed ? '已安裝' : `下載 ${appName}`}
          </button>
          <img
            alt="Android 上的迷你資訊列和安裝對話方塊"
            height="417"
            loading="lazy"
            src={`${guideAssetBaseUrl}/android-install.png`}
            width="800"
          />
          <SourceLink href={webDevSource} label="web.dev「Android 安裝」" />
        </section>
      </div>

      <aside className="install-attribution" aria-label="教學素材授權">
        教學文字與 Chrome、Android 圖片改作自 web.dev，依
        {' '}
        <a href="https://creativecommons.org/licenses/by/4.0/deed.zh-hant" rel="noreferrer" target="_blank">CC BY 4.0</a>
        {' '}授權；Firefox 文字與圖片改作自 Mozilla Contributors，依
        {' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.zh-hant" rel="noreferrer" target="_blank">CC BY-SA 3.0</a>
        {' '}授權；iPhone 圖片來自 MDN Contributors，依
        {' '}
        <a href="https://creativecommons.org/licenses/by-sa/2.5/deed.zh-hant" rel="noreferrer" target="_blank">CC BY-SA 2.5</a>
        {' '}或後續版本授權。內容已配合本站名稱與版面調整。
      </aside>
    </main>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="install-guide-source" href={href} rel="noreferrer" target="_blank">
      原始說明：{label}
    </a>
  );
}
