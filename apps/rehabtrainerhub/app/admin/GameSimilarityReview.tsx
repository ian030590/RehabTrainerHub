import { useRef, useState } from 'react';
import { GetTrainingModuleCategoryLabel, trainingCatalog } from '../../games/catalog';
import {
  DeriveTagLevels,
  SimilarGames,
  ValidateRecommendationData,
  type GameFeatures,
  type Taxonomy,
} from '../../recommendation/features.js';
import gameFeaturesData from '../../recommendation/gameFeatures.json';
import taxonomyData from '../../recommendation/taxonomy.json';
import styles from './GameSimilarityReview.module.css';

const taxonomy = taxonomyData as Taxonomy;
const gameFeatures = gameFeaturesData as GameFeatures;
const catalogById = new Map(trainingCatalog.map(game => [game.runtimeId, game]));
const categories = [...new Set(trainingCatalog.map(game => game.trainer))];
const gamesByCategory = categories.map(category => trainingCatalog.filter(game => game.trainer === category));
const validation = ValidateRecommendationData(taxonomy, gameFeatures,
  trainingCatalog.map(({ runtimeId, mediaPermission }) => ({ id: runtimeId, mediaPermission })));
const levelLabels = ['確認未涉及', '次要', '主要'];
const frameworkShortNames: Readonly<Record<string, string>> = {
  icf: 'WHO ICF',
  'sohlberg-mateer': 'Sohlberg–Mateer',
  'miyake-ef': 'Miyake',
  'baddeley-wm': 'Baddeley',
  chc: 'CHC',
  'warren-vph': 'Warren',
  'leigh-zee': 'Leigh and Zee',
  gentile: 'Gentile',
  'schmidt-lee': 'Schmidt and Lee',
  donders: 'Donders',
  'wab-r': 'WAB-R',
  logemann: 'Logemann',
};

export function GameSimilarityReview() {
  const [gameId, setGameId] = useState(trainingCatalog[0]?.runtimeId ?? '');
  const pickerRef = useRef<HTMLSelectElement>(null);

  if (!validation.ok) {
    return (
      <div className={`admin-alert admin-alert-error ${styles.validation}`} role="alert">
        <h2>活動標籤資料有誤</h2>
        <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
      </div>
    );
  }

  const game = gameFeatures.games[gameId];
  if (!game) return <p className="admin-state">目前沒有可審閱的活動。</p>;

  const draftCount = Object.values(gameFeatures.games).filter(item => item.reviewStatus === 'draft').length;
  const functionLevels = DeriveTagLevels(taxonomy, game.functionTags);
  const activeTags = taxonomy.tags.filter(tag => tag.status === 'active');
  const parentIds = new Set(taxonomy.tags.map(tag => tag.parent));
  const frameworkNames = new Map(taxonomy.frameworks.map(({ id, name }) => [id, frameworkShortNames[id] ?? name]));
  const icfLabels = new Map(taxonomy.icfCodes.map(({ code, title }) => [code, `${code} ${title['zh-TW']}`]));
  const tagLabels = new Map(taxonomy.tags.map(tag => [tag.id, tag.labels['zh-TW']]));
  const capabilityLabels = new Map(taxonomy.capabilities.map(capability => [capability.id, capability.labels['zh-TW']]));
  const neighbors = SimilarGames(taxonomy, gameFeatures, gameId);
  const selectNeighbor = (id: string) => {
    setGameId(id);
    window.requestAnimationFrame(() => pickerRef.current?.focus());
  };

  return (
    <div className={styles.review}>
      <div className="admin-section-toolbar">
        <div>
          <h2>相近活動</h2>
          <p>{draftCount === 0
            ? '標籤描述活動內容，依理論框架標註並已確認。'
            : '標籤描述活動內容，草稿待確認。'}</p>
        </div>
      </div>

      <label className={`admin-field ${styles.picker}`} htmlFor="admin-similarity-game">
        <span>選擇活動</span>
        <select id="admin-similarity-game" ref={pickerRef} value={gameId}
          onChange={event => setGameId(event.target.value)}>
          {gamesByCategory.map(games => (
            <optgroup key={games[0].trainer} label={GetTrainingModuleCategoryLabel(games[0], 'zh-TW')}>
              {games.map(item => <option key={item.runtimeId} value={item.runtimeId}>{item.copy['zh-TW'].title}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <dl className={styles.status}>
        <dt>審閱狀態</dt>
        <dd>{game.reviewStatus === 'draft' ? '草稿' : '已確認'}</dd>
      </dl>

      <div className={styles.columns}>
        <div className={styles.details}>
          <section>
            <h3>功能標籤</h3>
            <div className={styles.dimensions}>
              {taxonomy.dimensions.filter(dimension => dimension.group === 'function').map(dimension => {
                const dimensionTags = activeTags.filter(tag => tag.dimension === dimension.id);
                const unknown = dimensionTags.filter(tag => functionLevels[tag.id] === undefined && !parentIds.has(tag.id));
                return (
                  <section key={dimension.id}>
                    <h4>{dimension.labels['zh-TW']}</h4>
                    <p className={styles.framework} lang="en">{frameworkNames.get(dimension.frameworkId)}</p>
                    <dl className={styles.tags}>
                      {dimensionTags.map(tag => {
                        const level = functionLevels[tag.id];
                        if (level === undefined) return null;
                        const evidence = game.evidence[tag.id];
                        return (
                          <div key={tag.id}>
                            <dt>{tag.labels['zh-TW']}</dt>
                            <dd>
                              {levelLabels[level]}
                              {parentIds.has(tag.id) && '（推導）'}
                              {' · '}{icfLabels.get(tag.icfCode ?? '')}
                              {evidence && <p className={styles.evidence}>{evidence}</p>}
                            </dd>
                          </div>
                        );
                      })}
                      {unknown.length > 0 && (
                        <div>
                          <dt>尚未標註</dt>
                          <dd>{unknown.map(tag => `${tag.labels['zh-TW']}（${icfLabels.get(tag.icfCode ?? '')}）`).join('、')}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                );
              })}
            </div>
          </section>
          <section>
            <h3>任務需求</h3>
            <dl className={styles.tags}>
              {taxonomy.dimensions.filter(dimension => dimension.group === 'taskDemand').map(dimension => {
                const selected = activeTags.filter(tag => tag.dimension === dimension.id && (game.taskDemandTags[tag.id] ?? 0) > 0);
                return (
                  <div key={dimension.id}>
                    <dt>{dimension.labels['zh-TW']}</dt>
                    <dd>{selected.map(tag => tag.labels['zh-TW']).join('、') || '無'}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
          <section>
            <h3>操作所需裝置</h3>
            <p>任選一種配置，並備妥該配置列出的所有裝置。</p>
            <ul className={styles.setups}>
              {game.supportedSetups.map(setup => (
                <li key={setup.id}>{setup.allCapabilities.map(id => capabilityLabels.get(id)).join('＋')}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className={styles.neighbors}>
          <h3>相似度最高的活動</h3>
          {neighbors.length ? (
            <ol className={styles.matches}>
              {neighbors.map(neighbor => (
                <li key={neighbor.gameId}>
                  <button className={`admin-button admin-button-secondary ${styles.match}`} type="button"
                    data-game-id={neighbor.gameId} onClick={() => selectNeighbor(neighbor.gameId)}>
                    <span className={styles.matchTitle}>{catalogById.get(neighbor.gameId)?.copy['zh-TW'].title}</span>
                    <span className={styles.score}>
                      <span className="sr-only">相似度</span>
                      <span className={styles.track} aria-hidden="true">
                        <span style={{ width: `${neighbor.score * 100}%` }} />
                      </span>
                      {neighbor.score.toFixed(2)}
                    </span>
                  </button>
                  <p className={styles.sharedTags}>{neighbor.sharedTags.length
                    ? `共同標籤：${neighbor.sharedTags.map(id => tagLabels.get(id)).join('、')}`
                    : '沒有共同的主要或次要標籤。'}</p>
                </li>
              ))}
            </ol>
          ) : <p>目前沒有可比較的活動。</p>}
        </section>
      </div>
    </div>
  );
}
