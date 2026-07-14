import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { detectDisplayDeviceKind } from '@rehab-trainer/ui/displayTiming';
import { enterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { useT, type TranslationKey } from '../i18n';
import type { SubtestId, UfovRunMode } from './ufov/UfovPage';

export type ModuleId = 'attention' | 'memory' | 'thinking';

interface ModuleDefinition {
  id: ModuleId;
  titleKey: TranslationKey;
  introKey: TranslationKey;
  cards: Array<{
    titleKey: TranslationKey;
    bodyKey: TranslationKey;
    actionKey?: TranslationKey;
    to?: string;
  }>;
}

const modules: ModuleDefinition[] = [
  {
    id: 'attention',
    titleKey: 'module.attention.title',
    introKey: 'module.attention.intro',
    cards: [
      {
        titleKey: 'module.attention.ufov.title',
        bodyKey: 'module.attention.ufov.body',
        actionKey: 'module.attention.ufov.action',
        to: '/attention-training/ufov',
      },
      { titleKey: 'module.attention.card2.title', bodyKey: 'module.attention.card2.body' },
      { titleKey: 'module.attention.card3.title', bodyKey: 'module.attention.card3.body' },
    ],
  },
  {
    id: 'memory',
    titleKey: 'module.memory.title',
    introKey: 'module.memory.intro',
    cards: [
      { titleKey: 'module.memory.card1.title', bodyKey: 'module.memory.card1.body' },
      { titleKey: 'module.memory.card2.title', bodyKey: 'module.memory.card2.body' },
      { titleKey: 'module.memory.card3.title', bodyKey: 'module.memory.card3.body' },
    ],
  },
  {
    id: 'thinking',
    titleKey: 'module.thinking.title',
    introKey: 'module.thinking.intro',
    cards: [
      {
        titleKey: 'module.thinking.mainConcept.title',
        bodyKey: 'module.thinking.mainConcept.body',
        actionKey: 'module.thinking.mainConcept.action',
        to: '/thinking-training/main-concept',
      },
      { titleKey: 'module.thinking.card2.title', bodyKey: 'module.thinking.card2.body' },
      { titleKey: 'module.thinking.card3.title', bodyKey: 'module.thinking.card3.body' },
    ],
  },
];

function getModule(moduleId: ModuleId) {
  return modules.find((module) => module.id === moduleId) ?? modules[0];
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { lang, t } = useT();
  const navigate = useNavigate();
  const module = getModule(moduleId);
  const [isUfovConfigOpen, setIsUfovConfigOpen] = useState(false);
  const [selectedUfovSubtest, setSelectedUfovSubtest] = useState<SubtestId>(1);
  const [selectedUfovMode, setSelectedUfovMode] = useState<UfovRunMode>('formal');
  const ufovLabels = getUfovConfigLabels(lang);
  const isSmallScreenDevice = isMobileOrTabletDevice(detectDisplayDeviceKind());

  const handleStartUfov = async () => {
    const subtestId = isSmallScreenDevice ? 1 : selectedUfovSubtest;
    await enterFullscreenFromUserGesture(document.documentElement);
    setIsUfovConfigOpen(false);
    navigate(`/attention-training/ufov?${new URLSearchParams({
      subtest: String(subtestId),
      mode: selectedUfovMode,
      start: '1',
    }).toString()}`);
  };

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up" id="module-title">{t(module.titleKey)}</h1>
      <p className="section-subtitle fade-in-up">{t(module.introKey)}</p>

      <section className="selection-grid content-grid-spaced" aria-label={t(module.titleKey)}>
        {module.cards.map((card, index) => {
          const isUfovCard = card.to === '/attention-training/ufov';
          return (
            <article
              className={`card selection-card ${card.to ? '' : 'placeholder-card'} fade-in-up`}
              aria-disabled={card.to ? undefined : 'true'}
              key={card.titleKey}
            >
              <span className="card-icon" aria-hidden="true">{index + 1}</span>
              <span className="card-title">{t(card.titleKey)}</span>
              <span className="card-desc">{t(card.bodyKey)}</span>
              <div className="card-action">
                {isUfovCard ? (
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => setIsUfovConfigOpen(true)}>
                    {t(card.actionKey ?? 'module.openAction')}
                  </button>
                ) : card.to ? (
                  <Link className="btn btn-primary btn-sm" to={card.to}>
                    {t(card.actionKey ?? 'module.openAction')}
                  </Link>
                ) : (
                  <button className="btn btn-secondary btn-sm" type="button" disabled>
                    {t('module.placeholderAction')}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
      {isUfovConfigOpen && (
        <ConfigDialog
          ariaLabel={ufovLabels.settingsTitle}
          onClose={() => setIsUfovConfigOpen(false)}
          summaryItems={[
            { value: ufovLabels.subtests[selectedUfovSubtest] },
            { value: ufovLabels.modes[selectedUfovMode].label },
          ]}
        >
          <div className="config-section">
            <div className="config-label">{ufovLabels.chooseSubtest}</div>
            <div className="difficulty-selector">
              {UFOV_SUBTESTS.map((subtestId) => {
                const subtestBlocked = isSmallScreenDevice && subtestId !== 1;
                return (
                  <button
                    className={`diff-btn ${selectedUfovSubtest === subtestId ? 'active' : ''}`}
                    disabled={subtestBlocked}
                    key={subtestId}
                    onClick={() => setSelectedUfovSubtest(subtestId)}
                    type="button"
                  >
                    <span className="diff-btn-label">{ufovLabels.subtests[subtestId]}</span>
                    <span className="diff-btn-desc">
                      {subtestBlocked ? ufovLabels.subtestUnavailable : ufovLabels.instructions[subtestId]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="config-section">
            <div className="config-label">{ufovLabels.chooseMode}</div>
            <div className="difficulty-selector">
              {UFOV_RUN_MODES.map((mode) => (
                <button
                  className={`diff-btn ${selectedUfovMode === mode ? 'active' : ''}`}
                  key={mode}
                  onClick={() => setSelectedUfovMode(mode)}
                  type="button"
                >
                  <span className="diff-btn-label">{ufovLabels.modes[mode].label}</span>
                  <span className="diff-btn-desc">{ufovLabels.modes[mode].description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-actions">
            <button className="btn btn-primary btn-lg config-start-btn" type="button" onClick={() => void handleStartUfov()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              {ufovLabels.start}
            </button>
            <button className="btn btn-ghost btn-lg" type="button" onClick={() => setIsUfovConfigOpen(false)}>
              {ufovLabels.cancel}
            </button>
          </div>
        </ConfigDialog>
      )}
    </main>
  );
}

const UFOV_SUBTESTS: SubtestId[] = [1, 2, 3];
const UFOV_RUN_MODES: UfovRunMode[] = ['instruction', 'practice', 'formal'];

function isMobileOrTabletDevice(deviceKind: ReturnType<typeof detectDisplayDeviceKind>) {
  return deviceKind === 'phone' || deviceKind === 'tablet';
}

function getUfovConfigLabels(lang: 'zh' | 'en') {
  return lang === 'en'
    ? {
        settingsTitle: 'UFOV Settings',
        chooseSubtest: 'Choose Subtest',
        chooseMode: 'Choose Flow',
        start: 'Start',
        cancel: 'Cancel',
        subtestUnavailable: 'This subtest is unavailable on this device',
        subtests: {
          1: 'Subtest 1 Processing Speed',
          2: 'Subtest 2 Divided Attention',
          3: 'Subtest 3 Selective Attention',
        },
        instructions: {
          1: 'Identify whether the center item is a car or truck.',
          2: 'Identify the center vehicle and the peripheral target direction.',
          3: 'Identify the center vehicle among distractors and the peripheral target direction.',
        },
        modes: {
          instruction: { label: 'Instructions', description: 'Show instructions only, without scoring.' },
          practice: { label: 'Practice', description: 'Run 5 fixed-speed practice trials with feedback.' },
          formal: { label: 'Formal Test', description: 'Run the adaptive formal test and save results.' },
        },
      }
    : {
        settingsTitle: 'UFOV 設定',
        chooseSubtest: '選擇 Subtest',
        chooseMode: '選擇流程',
        start: '開始',
        cancel: '取消',
        subtestUnavailable: '此裝置無法使用這個 subtest',
        subtests: {
          1: 'Subtest 1 處理速度',
          2: 'Subtest 2 分散注意力',
          3: 'Subtest 3 選擇性注意力',
        },
        instructions: {
          1: '辨認中央目標是汽車或卡車。',
          2: '辨認中央車輛，並指出周邊目標方向。',
          3: '在干擾物中辨認中央車輛，並指出周邊目標方向。',
        },
        modes: {
          instruction: { label: '說明', description: '只顯示測驗說明，不計分。' },
          practice: { label: '練習', description: '以固定速度進行 5 題練習並顯示回饋。' },
          formal: { label: '正式測驗', description: '進入 adaptive 正式測驗並儲存結果。' },
        },
      };
}
