'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function PrivacyContent() {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).privacy;

  return (
    <main className="policy-page" id="main-content">
      <h1>{copy.title}</h1>
      <p>{copy.intro}</p>

      <section>
        <h2>{copy.collected}</h2>
        <ul>
          {copy.collectedItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section>
        <h2>{copy.use}</h2>
        <p>{copy.useBody}</p>
      </section>

      <section>
        <h2>{copy.permissions}</h2>
        <p>{copy.permissionsBody}</p>
      </section>
    </main>
  );
}
