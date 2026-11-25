'use client';

import type { TrainingCatalogModule } from '@rehab-trainer/hub-modules/catalog';
import { Fragment } from 'react';
import type { ActivityLink } from '../activityLinks';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import type { HubLabel, HubLocale } from '../i18n/types';
import type { GetReviewedActivityDetails } from './activityFeatures';
import styles from './Activities.module.css';

function ActivityList({ activities, locale }: { activities: ActivityLink[]; locale: HubLocale }) {
  return (
    <ul className={styles.list} role="list">
      {activities.map(({ id, title, href }) => <li key={id}><a href={href}>{title[locale]}</a></li>)}
    </ul>
  );
}

export function ActivityDirectory({ groups }: {
  groups: { id: string; label: HubLabel; activities: ActivityLink[] }[];
}) {
  const { language, locale } = useHubLanguage();
  const copy = GetHubUiCopy(language).activities;
  return (
    <main className={`qa-page ${styles.page}`} id="main-content">
      <header><h1>{copy.title}</h1><p>{copy.description}</p></header>
      {groups.map(({ id, label, activities }) => (
        <section key={id} aria-labelledby={id}>
          <h2 id={id}>{label[locale]}</h2>
          <ActivityList activities={activities} locale={locale} />
        </section>
      ))}
    </main>
  );
}

export function ActivityDetails({ copy, category, primaryTags, reviewed, mediaPermission, neighbors, startHref, installHref }: {
  copy: TrainingCatalogModule['copy'];
  category: HubLabel;
  primaryTags: HubLabel[];
  reviewed: ReturnType<typeof GetReviewedActivityDetails>;
  mediaPermission: TrainingCatalogModule['mediaPermission'];
  neighbors: ActivityLink[];
  startHref: string;
  installHref: string;
}) {
  const { language, locale } = useHubLanguage();
  const { activities, activityMap, lobby, navigation } = GetHubUiCopy(language);
  const { title, description } = copy[locale];
  return (
    <main className={`qa-page ${styles.page}`} id="main-content">
      <nav aria-label={activities.breadcrumbs}>
        <ol className={styles.breadcrumbs} role="list">
          <li><a href="/">{navigation.navigationItems[0]}</a></li>
          <li><a href="/activities/">{activities.title}</a></li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <header><h1>{title}</h1><p>{description}</p></header>
      <dl className={styles.facts}>
        <dt>{activities.category}</dt><dd>{category[locale]}</dd>
        <dt>{activityMap.primaryTags}</dt>
        <dd>{primaryTags.map(tag => tag[locale]).join(activityMap.tagSeparator) || activityMap.none}</dd>
        <dt>{activities.equipment}</dt><dd>{lobby.requirements[mediaPermission]}</dd>
      </dl>
      <div className={styles.actions}>
        <a className={styles.start} href={startHref}>{activities.start}</a>
        <a href={installHref}>{activities.install}</a>
      </div>
      {reviewed && <>
        <section aria-labelledby="activity-content">
          <h2 id="activity-content">{activities.features.content}</h2>
          <dl className={styles.facts}>
            {reviewed.content.map(({ label, text }) => (
              <Fragment key={label.en}><dt>{label[locale]}</dt><dd>{text[locale]}</dd></Fragment>
            ))}
          </dl>
        </section>
        <section aria-labelledby="activity-characteristics">
          <h2 id="activity-characteristics">{activities.features.characteristics}</h2>
          <dl className={styles.facts}>
            {reviewed.demands.map(({ label, values }) => (
              <Fragment key={label.en}>
                <dt>{label[locale]}</dt><dd>{values.map(value => value[locale]).join(activityMap.tagSeparator)}</dd>
              </Fragment>
            ))}
            <dt>{activities.features.waysToPlay}</dt>
            <dd>{reviewed.setups.map(setup => setup.map(capability => capability[locale]).join(' + ')).join(activityMap.tagSeparator)}</dd>
          </dl>
        </section>
      </>}
      <section aria-labelledby="similar-activities">
        <h2 id="similar-activities">{activityMap.neighbors}</h2>
        <p>{activities.similarityNote}</p>
        <ActivityList activities={neighbors} locale={locale} />
      </section>
    </main>
  );
}
