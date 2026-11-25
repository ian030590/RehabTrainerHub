'use client';

import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { GetDirectionalActivityId, GetNearestActivityId, type ActivityMapCategory, type ActivityMapEntry } from './activityMapModel';
import styles from './ActivityMap.module.css';

const plotInset = 0.09;
const plotSpan = 1 - 2 * plotInset;
const hitDiameter = 44;
const categoryShapes = {
  motor: 'M 0 -9 A 9 9 0 1 1 0 9 A 9 9 0 1 1 0 -9 Z',
  mouth: 'M -7 -7 H 7 V 7 H -7 Z',
  brain: 'M 0 -10 L 8 6 H -8 Z',
  vision: 'M 0 -10 L 10 0 L 0 10 L -10 0 Z',
} satisfies Record<ActivityMapCategory['id'], string>;

function PlotCoordinate(value: number) {
  return `${100 * (plotInset + plotSpan * value)}%`;
}

function CategorySymbol({ category }: { category: ActivityMapCategory }) {
  return (
    <svg className={styles.symbol} style={category.style} viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
      <path d={categoryShapes[category.id]} />
    </svg>
  );
}

export function ActivityMap({ activities, categories }: {
  activities: readonly ActivityMapEntry[] | null;
  categories: readonly ActivityMapCategory[];
}) {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).activityMap;
  return (
    <main className="qa-page" id="main-content">
      <header className={styles.heading}>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      {activities === null ? <p className={styles.notice} role="alert">{copy.mapError}</p>
        : activities.length === 0 ? <p className={styles.notice}>{copy.empty}</p>
          : <ActivityMapExplorer activities={activities} categories={categories} />}
    </main>
  );
}

function ActivityMapExplorer({ activities, categories }: {
  activities: readonly ActivityMapEntry[];
  categories: readonly ActivityMapCategory[];
}) {
  const { language, locale } = useHubLanguage();
  const { activityMap: copy, activities: activityCopy } = GetHubUiCopy(language);
  const [enabled, setEnabled] = useState(() => categories.map(({ id }) => id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState(activities[0].id);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const plot = useRef<HTMLDivElement>(null);
  const detailsHeading = useRef<HTMLHeadingElement>(null);

  const byId = new Map(activities.map(activity => [activity.id, activity]));
  const byCategory = new Map(categories.map(category => [category.id, category]));
  const selected = selectedId ? byId.get(selectedId) : null;
  const selectedCategory = selected ? byCategory.get(selected.category) : null;
  const neighbors = selected?.neighborIds.flatMap(id => {
    const activity = byId.get(id);
    return activity ? [activity] : [];
  }) ?? [];
  const groups = categories.filter(({ id }) => enabled.includes(id)).map(category => ({
    category, items: activities.filter(activity => activity.category === category.id),
  })).filter(({ items }) => items.length > 0);

  function SelectActivity(id: string, focusDetails = false) {
    setSelectedId(id);
    setFocusId(id);
    if (focusDetails) detailsHeading.current?.focus();
  }

  function HandleMarkerKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const next = GetDirectionalActivityId(activities, id, event.key);
    if (!next) return;
    event.preventDefault();
    markers.current.get(next)?.focus();
  }

  function FindPointerTarget(clientX: number, clientY: number) {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect?.width) return null;
    const x = ((clientX - rect.left) / rect.width - plotInset) / plotSpan;
    const y = ((clientY - rect.top) / rect.height - plotInset) / plotSpan;
    const radius = hitDiameter / (2 * rect.width * plotSpan);
    return GetNearestActivityId(activities, [x, y], radius);
  }

  function HandleMarkerClick(event: MouseEvent<HTMLButtonElement>, id: string) {
    const target = event.detail === 0 ? id : FindPointerTarget(event.clientX, event.clientY);
    if (!target) return;
    SelectActivity(target);
    markers.current.get(target)?.focus({ preventScroll: true });
  }

  function HandlePlotPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse') setHoverId(FindPointerTarget(event.clientX, event.clientY));
  }

  return (
    <>
      <fieldset className={styles.filters}>
        <legend>{copy.categories}</legend>
        <div className={styles.chips}>
          {categories.map(category => (
            <label className={styles.chip} key={category.id}>
              <input type="checkbox" data-map-filter={category.id} checked={enabled.includes(category.id)}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  setEnabled(previous => checked ? [...previous, category.id] : previous.filter(id => id !== category.id));
                }} />
              <CategorySymbol category={category} />
              {category.label[locale]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.workspace}>
        <figure className={styles.figure}>
          <p className={styles.hint} id="activity-map-instructions">{copy.keyboard}</p>
          <div ref={plot} className={styles.plot} role="group" aria-label={copy.title} aria-describedby="activity-map-instructions activity-map-caption"
            onPointerMove={HandlePlotPointer} onPointerLeave={() => setHoverId(null)}>
            <svg className={styles.svg} aria-hidden="true" focusable="false">
              <line className={styles.axes} x1={PlotCoordinate(0)} y1={PlotCoordinate(0)} x2={PlotCoordinate(0)} y2={PlotCoordinate(1)} />
              <line className={styles.axes} x1={PlotCoordinate(0)} y1={PlotCoordinate(1)} x2={PlotCoordinate(1)} y2={PlotCoordinate(1)} />
              {selected && neighbors.map(neighbor => (
                <line className={styles.line} data-map-line="" key={neighbor.id}
                  x1={PlotCoordinate(selected.point[0])} y1={PlotCoordinate(selected.point[1])}
                  x2={PlotCoordinate(neighbor.point[0])} y2={PlotCoordinate(neighbor.point[1])} />
              ))}
              {activities.map(activity => (
                <g key={activity.id} className={styles.dot} data-map-dot={activity.id} data-category={activity.category}
                  data-dimmed={!enabled.includes(activity.category)} style={{
                    ...byCategory.get(activity.category)?.style,
                    transform: `translate(${PlotCoordinate(activity.point[0])}, ${PlotCoordinate(activity.point[1])})`,
                  }}>
                  <path d={categoryShapes[activity.category]} />
                </g>
              ))}
              {activities.filter(({ id }) => id === selectedId || id === hoverId).map(({ id, point }) => (
                <circle key={id} className={id === selectedId ? styles.selectedRing : styles.hoverRing} r="12"
                  cx={PlotCoordinate(point[0])} cy={PlotCoordinate(point[1])} />
              ))}
            </svg>
            {activities.map(({ id, point, title, category }) => (
              <button type="button" key={id} data-map-marker={id} data-category={category}
                className={styles.marker} aria-label={`${title[locale]} (${byCategory.get(category)?.label[locale] ?? ''})`}
                aria-pressed={selectedId === id} tabIndex={focusId === id ? 0 : -1}
                style={{ left: PlotCoordinate(point[0]), top: PlotCoordinate(point[1]), width: hitDiameter, height: hitDiameter }}
                ref={button => { if (button) markers.current.set(id, button); else markers.current.delete(id); }}
                onFocus={() => setFocusId(id)} onKeyDown={event => HandleMarkerKey(event, id)}
                onClick={event => HandleMarkerClick(event, id)} />
            ))}
          </div>
          <figcaption className={styles.caption} id="activity-map-caption">{copy.caption}</figcaption>
        </figure>

        <section className={styles.details} data-map-details={selected?.id} aria-labelledby="activity-map-details-title">
          <h2 id="activity-map-details-title" ref={detailsHeading} tabIndex={-1}>{copy.details}</h2>
          <p className="sr-only" role="status">{selected?.title[locale]}</p>
          {selected ? (
            <>
              <h3>{selected.title[locale]}</h3>
              {selectedCategory && <p className={styles.category}><CategorySymbol category={selectedCategory} />{selectedCategory.label[locale]}</p>}
              <dl className={styles.tags}>
                <dt>{copy.primaryTags}</dt>
                <dd>{selected.primaryTags.length ? selected.primaryTags.map(label => label[locale]).join(copy.tagSeparator) : copy.none}</dd>
              </dl>
              <a className={styles.start} href={selected.href}>{activityCopy.details}</a>
              <h3>{copy.neighbors}</h3>
              {neighbors.length ? <ul className={styles.items} role="list">
                {neighbors.map(({ id, title }) => <li key={id}><button type="button" data-map-neighbor={id}
                  onClick={() => SelectActivity(id, true)}>{title[locale]}</button></li>)}
              </ul> : <p>{copy.none}</p>}
            </>
          ) : <p>{copy.selectActivity}</p>}
        </section>
      </div>

      <section className={styles.directory} aria-labelledby="activity-map-list-title">
        <h2 id="activity-map-list-title">{copy.list}</h2>
        {groups.length === 0 && <p role="status">{copy.emptyFilter}</p>}
        <div className={styles.groups}>
          {groups.map(({ category, items }) => (
            <section key={category.id} aria-labelledby={`activity-map-group-${category.id}`}>
              <h3 className={styles.category} id={`activity-map-group-${category.id}`}><CategorySymbol category={category} />{category.label[locale]}</h3>
              <ul className={styles.items} role="list">
                {items.map(({ id, title, href }) => (
                  <li className={styles.directoryItem} key={id}>
                    <button type="button" data-map-list-item={id} data-category={category.id}
                      aria-pressed={selectedId === id} onClick={() => SelectActivity(id, true)}>{title[locale]}</button>
                    <a href={href} aria-label={`${activityCopy.details}: ${title[locale]}`}>{activityCopy.details}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
