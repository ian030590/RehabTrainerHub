'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  FetchRehabProgress,
  type RehabAchievement,
  type RehabProgress,
} from '@rehab-trainer/ui/auth/authClient';
import {
  BuildHubTrainingHref,
  GetTrainingModuleCopy,
  GetTrainingModuleTheme,
  trainingCatalog,
} from '@rehab-trainer/hub-modules/catalog';
import { useHubAuth } from '../HubNavigation';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { siteUrls } from '../siteUrls';
import { BuildTrainingThemeStyle } from '../trainingThemeStyle';
import { TrophyIcon } from '../TrophyIcon';

const emptyAchievements: RehabAchievement[] = [
  ['streak-7-days', '連續訓練 7 天', 7],
  ['streak-14-days', '連續訓練 14 天', 14],
  ['streak-21-days', '連續訓練 21 天', 21],
  ['streak-1-month', '連續訓練 1 個月', 30],
  ['streak-2-months', '連續訓練 2 個月', 60],
  ['streak-3-months', '連續訓練 3 個月', 90],
  ['streak-4-months', '連續訓練 4 個月', 120],
  ['streak-5-months', '連續訓練 5 個月', 150],
  ['streak-6-months', '連續訓練 6 個月', 180],
  ['streak-1-year', '連續訓練 1 年', 365],
  ['streak-2-years', '連續訓練 2 年', 730],
  ['streak-3-years', '連續訓練 3 年', 1095],
  ['streak-4-years', '連續訓練 4 年', 1460],
  ['streak-5-years', '連續訓練 5 年', 1825],
].map(([id, title, requiredDays]) => ({
  id: String(id),
  title: String(title),
  requiredDays: Number(requiredDays),
  achieved: false,
}));

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function ProgressDashboard() {
  const { user } = useHubAuth();
  const { language, locale, t } = useHubLanguage();
  const [progress, setProgress] = useState<RehabProgress | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const copy = GetHubUiCopy(language).progress;

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setProgress(null);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    void FetchRehabProgress(siteUrls.hub)
      .then((nextProgress) => {
        if (cancelled) return;
        setProgress(nextProgress);
        setStatus(nextProgress ? 'ready' : 'idle');
      })
      .catch((error) => {
        console.warn('Unable to load rehabilitation progress.', error);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const achievements = progress?.achievements ?? emptyAchievements;
  const recentModules = (progress?.recentModules ?? [])
    .map((recentModule) => trainingCatalog.find((module) => module.runtimeId === recentModule.moduleId))
    .filter((module): module is (typeof trainingCatalog)[number] => Boolean(module));
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="progress-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
      </header>

      {!user && (
        <section className="progress-notice" aria-live="polite">
          <span className="material-symbols-outlined" aria-hidden="true">lock</span>
          <div>
            <h2>{copy.signInTitle}</h2>
            <p>{copy.signInBody}</p>
          </div>
        </section>
      )}

      {status === 'error' && (
        <p className="progress-error" role="alert">{copy.loadError}</p>
      )}

      <section className="progress-metrics" aria-label={copy.rehabilitationDays}>
        <article>
          <span>{copy.daysSinceStart}</span>
          <strong>{status === 'loading' ? '—' : progress?.daysSinceStart ?? 0}</strong>
          <small>{copy.days}</small>
          <p>
            {progress?.startedOn
              ? t('progress.startedOn', { date: dateFormatter.format(new Date(`${progress.startedOn}T00:00:00+08:00`)) })
              : copy.noRecords}
          </p>
        </article>
        <article>
          <span>{copy.rehabilitationDays}</span>
          <strong>{status === 'loading' ? '—' : progress?.rehabilitationDays ?? 0}</strong>
          <small>{copy.days}</small>
          <p>{copy.streakNote}</p>
        </article>
      </section>

      <section className="daily-section" aria-labelledby="daily-title">
        <header className="section-title-row">
          <div>
            <p className="page-kicker">{copy.today}</p>
            <h2 id="daily-title">{copy.dailyTasks}</h2>
          </div>
          {progress && (
            <time dateTime={progress.serverDate}>
              {dateFormatter.format(new Date(`${progress.serverDate}T00:00:00+08:00`))}
            </time>
          )}
        </header>

        <div className="daily-task-list">
          {(progress?.dailyTasks ?? [
            { id: 'complete-one', title: '完成 1 次訓練', current: 0, target: 1, completed: false },
            { id: 'complete-three', title: '完成 3 次訓練', current: 0, target: 3, completed: false },
            { id: 'use-two-modules', title: '完成 2 種不同模組', current: 0, target: 2, completed: false },
          ]).map((task) => (
            <article className={task.completed ? 'is-complete' : ''} key={task.id}>
              <span className="material-symbols-outlined" aria-hidden="true">
                {task.completed ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <div>
                <h3>{copy.dailyTaskTitles[task.id as keyof typeof copy.dailyTaskTitles] ?? task.title}</h3>
                <div
                  aria-label={`${task.current} / ${task.target}`}
                  aria-valuemax={task.target}
                  aria-valuemin={0}
                  aria-valuenow={task.current}
                  className="task-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${(task.current / task.target) * 100}%` }} />
                </div>
              </div>
              <strong>{task.current}/{task.target}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="recent-module-section" aria-labelledby="recent-modules-title">
        <header className="section-title-row">
          <div>
            <p className="page-kicker">{copy.recentlyPlayed}</p>
            <h2 id="recent-modules-title">{copy.recentlyPlayed}</h2>
          </div>
        </header>

        {status === 'loading' ? (
          <div
            aria-label={copy.loadingRecent}
            className="recent-module-empty"
            role="status"
          >
            <span className="minimal-loading-spinner" aria-hidden="true" />
          </div>
        ) : recentModules.length > 0 ? (
          <div className="recent-module-grid">
            {recentModules.map((module) => {
              const moduleCopy = GetTrainingModuleCopy(module, locale);
              const theme = GetTrainingModuleTheme(module);

              return (
                <article
                  className="recent-module-card"
                  key={module.catalogId}
                  style={BuildTrainingThemeStyle(theme)}
                >
                  <span>{language === 'en' ? theme.label.en : theme.label['zh-TW']}</span>
                  <h3>{moduleCopy.title}</h3>
                  <Link href={BuildHubTrainingHref(module)}>
                    {copy.start}
                    <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="recent-module-empty">{copy.noRecent}</p>
        )}
      </section>

      <section className="achievement-section" aria-labelledby="achievement-title">
        <header className="section-title-row">
          <div>
            <p className="page-kicker">{copy.milestones}</p>
            <h2 id="achievement-title">{copy.achievements}</h2>
          </div>
          <p>{t('progress.achievedCount', {
            current: achievements.filter((achievement) => achievement.achieved).length,
            total: achievements.length,
          })}</p>
        </header>

        <div className="achievement-grid">
          {achievements.map((achievement) => (
            <article className={achievement.achieved ? 'is-achieved' : ''} key={achievement.id}>
              <div className="trophy-mark">
                <TrophyIcon />
              </div>
              <h3>{t('progress.achievementTitle', { days: achievement.requiredDays })}</h3>
              <p>{achievement.achieved ? copy.achieved : t('progress.daysToGo', {
                days: Math.max(0, achievement.requiredDays - (progress?.rehabilitationDays ?? 0)),
              })}</p>
            </article>
          ))}
        </div>
      </section>

      {progress && (
        <p className="server-date-note">{t('progress.serverDate', { timeZone: progress.timeZone })}</p>
      )}
    </main>
  );
}
