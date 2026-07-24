'use client';

import { useEffect, useState } from 'react';
import {
  FetchRehabProgress,
  type RehabAchievement,
  type RehabProgress,
} from '@rehab-trainer/ui/auth/authClient';
import { useHubAuth } from '../HubNavigation';
import { siteUrls } from '../siteUrls';
import { TrophyIcon } from '../TrophyIcon';

const emptyAchievements: RehabAchievement[] = [
  ['streak-7-days', '連續復健 7 天', 7],
  ['streak-14-days', '連續復健 14 天', 14],
  ['streak-21-days', '連續復健 21 天', 21],
  ['streak-1-month', '連續復健 1 個月', 30],
  ['streak-2-months', '連續復健 2 個月', 60],
  ['streak-3-months', '連續復健 3 個月', 90],
  ['streak-4-months', '連續復健 4 個月', 120],
  ['streak-5-months', '連續復健 5 個月', 150],
  ['streak-6-months', '連續復健 6 個月', 180],
  ['streak-1-year', '連續復健 1 年', 365],
  ['streak-2-years', '連續復健 2 年', 730],
  ['streak-3-years', '連續復健 3 年', 1095],
  ['streak-4-years', '連續復健 4 年', 1460],
  ['streak-5-years', '連續復健 5 年', 1825],
].map(([id, title, requiredDays]) => ({
  id: String(id),
  title: String(title),
  requiredDays: Number(requiredDays),
  achieved: false,
}));

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function ProgressDashboard() {
  const { user } = useHubAuth();
  const [progress, setProgress] = useState<RehabProgress | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');

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
  const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="progress-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">Rehabilitation progress</p>
        <h1>進度追蹤</h1>
      </header>

      {!user && (
        <section className="progress-notice" aria-live="polite">
          <span className="material-symbols-outlined" aria-hidden="true">lock</span>
          <div>
            <h2>登入後查看個人進度</h2>
            <p>請使用右上角帳號按鈕登入。</p>
          </div>
        </section>
      )}

      {status === 'error' && (
        <p className="progress-error" role="alert">目前無法載入進度，請稍後再試。</p>
      )}

      <section className="progress-metrics" aria-label="復健天數">
        <article>
          <span>距開始復健經過</span>
          <strong>{status === 'loading' ? '—' : progress?.daysSinceStart ?? 0}</strong>
          <small>天</small>
          <p>
            {progress?.startedOn
              ? `開始於 ${dateFormatter.format(new Date(`${progress.startedOn}T00:00:00+08:00`))}`
              : '尚無復健紀錄'}
          </p>
        </article>
        <article>
          <span>累計復健天數</span>
          <strong>{status === 'loading' ? '—' : progress?.rehabilitationDays ?? 0}</strong>
          <small>天</small>
          <p>中斷後重新起算，成就以此為準</p>
        </article>
      </section>

      <section className="daily-section" aria-labelledby="daily-title">
        <div className="section-title-row">
          <div>
            <p className="page-kicker">Today</p>
            <h2 id="daily-title">每日任務</h2>
          </div>
          {progress && (
            <time dateTime={progress.serverDate}>
              {dateFormatter.format(new Date(`${progress.serverDate}T00:00:00+08:00`))}
            </time>
          )}
        </div>

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
                <h3>{task.title}</h3>
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

      <section className="achievement-section" aria-labelledby="achievement-title">
        <div className="section-title-row">
          <div>
            <p className="page-kicker">Milestones</p>
            <h2 id="achievement-title">復健成就</h2>
          </div>
          <p>{achievements.filter((achievement) => achievement.achieved).length}/{achievements.length} 已達成</p>
        </div>

        <div className="achievement-grid">
          {achievements.map((achievement) => (
            <article className={achievement.achieved ? 'is-achieved' : ''} key={achievement.id}>
              <div className="trophy-mark">
                <TrophyIcon />
              </div>
              <h3>{achievement.title}</h3>
              <p>{achievement.achieved ? '已達成' : `尚需 ${Math.max(0, achievement.requiredDays - (progress?.rehabilitationDays ?? 0))} 天`}</p>
            </article>
          ))}
        </div>
      </section>

      {progress && (
        <p className="server-date-note">
          日期由後端依 {progress.timeZone} 驗證
        </p>
      )}
    </main>
  );
}
