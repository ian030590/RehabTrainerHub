'use client';

import type { HubGame } from './gameCatalog';
import { GetHubUiCopy } from './i18n';
import { useHubLanguage } from './i18n/HubLanguage';
import type { PracticePlan, PracticePlanItem } from './practicePlans';
import './practicePlans.css';

export function PracticePlanDetails({ plan, games, onStart, showSettings = false }: {
  plan: PracticePlan;
  games: HubGame[];
  onStart?: (item: PracticePlanItem) => void;
  showSettings?: boolean;
}) {
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).practicePlans;
  return <>
    <p>{plan.assignedBy ? t('practicePlans.assignedBy', { name: plan.assignedBy }) : copy.assignedUnknown}</p>
    {plan.note && <p className="practice-plan-note">{plan.note}</p>}
    <p>{copy.week}<time dateTime={plan.week.start}>{FormatPlanDay(plan.week.start, locale)}</time>{copy.weekTo}<time dateTime={plan.week.end}>{FormatPlanDay(plan.week.end, locale)}</time></p>
    <ul className="practice-plan-items">
      {plan.items.map(item => {
        const game = games.find(game => game.id === item.gameId);
        const done = item.completedThisWeek >= item.weeklyTarget;
        return <li key={item.id}>
          <div>
            <h3>{game?.title ?? item.gameId}</h3>
            <p>{t('practicePlans.progress', { done: item.completedThisWeek, target: item.weeklyTarget })}</p>
            {done && <p className="practice-plan-done">{copy.done}</p>}
            {showSettings && <p>{item.settings === null ? copy.defaults
              : t('practicePlans.customSettings', { count: Object.keys(item.settings).length })}</p>}
            {!game && <p>{copy.gameUnavailable}</p>}
          </div>
          {onStart && game && <button className="admin-button admin-button-primary" type="button"
            aria-label={`${copy.start}: ${game.title}`} onClick={() => onStart(item)}>{copy.start}</button>}
        </li>;
      })}
    </ul>
    <div className="practice-plan-summary">
      <p>{plan.week.achieved ? copy.weekAchieved : copy.weekPending}</p>
      <p>{t('practicePlans.achievedWeeks', { count: plan.achievedWeeks })}</p>
      <p>{t('practicePlans.streak', { count: plan.currentStreak })}</p>
      {plan.titles.some(title => title.id === 'six-week-streak')
        ? <strong className="practice-plan-badge">{copy.titleBadge}</strong>
        : <p>{t('practicePlans.weeksLeft', { count: plan.weeksToTitle })}</p>}
    </div>
  </>;
}

// Week bounds are calendar dates; formatting them in UTC keeps the day from shifting.
function FormatPlanDay(dateKey: string, locale: string | undefined) {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateKey}T00:00:00Z`));
}
