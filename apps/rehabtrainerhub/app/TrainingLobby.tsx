'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  BuildTrainingModuleHref,
  GetTrainingModuleCopy,
  GetTrainingPurpose,
  trainingCatalog,
  trainingPurposes,
  type TrainerCatalogId,
  type TrainingPurposeId,
} from '@rehab-trainer/ui/trainingCatalog';

const trainerVisuals: Record<TrainerCatalogId, {
  name: string;
  logo: string;
  logoAlt: string;
}> = {
  motor: {
    name: 'MotorTrainer',
    logo: '/assets/motor-logo.svg',
    logoAlt: 'MotorTrainer',
  },
  vision: {
    name: 'VisionTrainer',
    logo: '/assets/vision-logo.svg',
    logoAlt: 'VisionTrainer',
  },
  brain: {
    name: 'BrainTrainer',
    logo: '/assets/brain-logo.svg',
    logoAlt: 'BrainTrainer',
  },
  mouth: {
    name: 'MouthTrainer',
    logo: '/assets/mouth-logo.svg',
    logoAlt: 'MouthTrainer',
  },
};

export function TrainingLobby() {
  const [query, setQuery] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<TrainingPurposeId[]>([]);
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');

  const purposeCounts = useMemo(() => new Map(
    trainingPurposes.map((purpose) => [
      purpose.id,
      trainingCatalog.filter((module) => module.purpose === purpose.id).length,
    ]),
  ), []);

  const visibleModules = useMemo(() => trainingCatalog.filter((module) => {
    const title = GetTrainingModuleCopy(module, 'zh-TW').title.toLocaleLowerCase('zh-TW');
    const matchesSearch = !normalizedQuery || title.includes(normalizedQuery);
    const matchesPurpose = selectedPurposes.length === 0
      || selectedPurposes.includes(module.purpose);
    return matchesSearch && matchesPurpose;
  }), [normalizedQuery, selectedPurposes]);

  const togglePurpose = (purposeId: TrainingPurposeId) => {
    setSelectedPurposes((current) => (
      current.includes(purposeId)
        ? current.filter((id) => id !== purposeId)
        : [...current, purposeId]
    ));
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedPurposes([]);
  };

  return (
    <main className="lobby-page" id="main-content">
      <section className="lobby-heading" aria-labelledby="lobby-title">
        <div>
          <p className="page-kicker">Rehab Trainer Hub</p>
          <h1 id="lobby-title">訓練大廳</h1>
          <p>選擇訓練目的，或直接搜尋模組名稱。</p>
        </div>

        <label className="module-search">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <span className="sr-only">搜尋模組名稱</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋訓練模組"
            type="search"
            value={query}
          />
        </label>
      </section>

      <div className="lobby-layout">
        <aside className="filter-panel" aria-labelledby="filter-title">
          <div className="filter-heading">
            <h2 id="filter-title">Filters</h2>
            {(selectedPurposes.length > 0 || query) && (
              <button onClick={clearFilters} type="button">清除</button>
            )}
          </div>

          <fieldset>
            <legend className="sr-only">訓練目的</legend>
            {trainingPurposes.map((purpose) => (
              <label className="filter-option" key={purpose.id}>
                <input
                  checked={selectedPurposes.includes(purpose.id)}
                  onChange={() => togglePurpose(purpose.id)}
                  type="checkbox"
                />
                <span>{purpose.label}</span>
                <small>{purposeCounts.get(purpose.id) ?? 0}</small>
              </label>
            ))}
          </fieldset>
        </aside>

        <section className="module-results" aria-labelledby="result-title">
          <div className="result-heading">
            <h2 id="result-title">所有訓練模組</h2>
            <p aria-live="polite">共 {visibleModules.length} 個模組</p>
          </div>

          {visibleModules.length > 0 ? (
            <div className="module-grid">
              {visibleModules.map((module) => {
                const copy = GetTrainingModuleCopy(module, 'zh-TW');
                const purpose = GetTrainingPurpose(module.purpose);
                const trainer = trainerVisuals[module.trainer];

                return (
                  <article className={`module-card trainer-${module.trainer}`} key={module.catalogId}>
                    <div className="module-card-meta">
                      <span>{purpose.label}</span>
                      <Image
                        src={trainer.logo}
                        alt={trainer.logoAlt}
                        width={52}
                        height={36}
                      />
                    </div>
                    <h3>{copy.title}</h3>
                    <p>{copy.description}</p>
                    <div className="module-card-footer">
                      <span>{trainer.name}</span>
                      <a href={BuildTrainingModuleHref(module)}>
                        開始訓練
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-results">
              <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
              <h3>找不到符合條件的模組</h3>
              <button onClick={clearFilters} type="button">清除篩選條件</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
