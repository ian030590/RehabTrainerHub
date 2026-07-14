import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { NumberPresetSelector } from '@rehab-trainer/ui/components/NumberPresetSelector';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { detectDisplayDeviceKind } from '@rehab-trainer/ui/displayTiming';
import { enterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { useT, type TranslationKey } from '../i18n';
import type { SubtestId, UfovRunMode, UfovTargetAxis } from './ufov/UfovPage';

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
  const [selectedUfovTrialCount, setSelectedUfovTrialCount] = useState(48);
  const [customUfovTrialCountInput, setCustomUfovTrialCountInput] = useState('');
  const [selectedUfovAxes, setSelectedUfovAxes] = useState<UfovTargetAxis[]>([0, 1, 2, 3, 4, 5, 6, 7]);
  const [isUfovRulesOpen, setIsUfovRulesOpen] = useState(false);
  const ufovLabels = getUfovConfigLabels(lang);
  const isSmallScreenDevice = isMobileOrTabletDevice(detectDisplayDeviceKind());
  const effectiveUfovSubtest = isSmallScreenDevice ? 1 : selectedUfovSubtest;
  const ruleLabels = getBrainRuleLabels(lang);

  const handleStartUfov = async () => {
    await enterFullscreenFromUserGesture(document.documentElement);
    setIsUfovConfigOpen(false);
    setIsUfovRulesOpen(false);
    navigate(`/attention-training/ufov?${new URLSearchParams({
      subtest: String(effectiveUfovSubtest),
      mode: selectedUfovMode,
      trials: String(selectedUfovTrialCount),
      axes: selectedUfovAxes.join(','),
      start: '1',
    }).toString()}`);
  };

  useEffect(() => {
    if (!isUfovRulesOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUfovRulesOpen(false);
        setIsUfovConfigOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUfovRulesOpen]);

  const handleTrialPreset = (value: number) => {
    setSelectedUfovTrialCount(value);
    setCustomUfovTrialCountInput('');
  };

  const handleCustomTrialCount = (value: string) => {
    setCustomUfovTrialCountInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 240) {
      setSelectedUfovTrialCount(Math.round(parsed));
    }
  };

  const toggleTargetAxis = (axis: UfovTargetAxis) => {
    setSelectedUfovAxes((current) => {
      if (current.includes(axis)) {
        return current.length > 1 ? current.filter((item) => item !== axis) : current;
      }
      return [...current, axis].sort((left, right) => left - right);
    });
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
            { value: selectedUfovTrialCount },
            { value: `${selectedUfovAxes.length}/8` },
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
            <div className="config-label">{ufovLabels.chooseTrialCount}</div>
            <NumberPresetSelector
              value={selectedUfovTrialCount}
              customValue={customUfovTrialCountInput}
              presets={[16, 48, 60]}
              min={1}
              max={240}
              placeholder={ufovLabels.customTrialCount}
              onPresetSelect={handleTrialPreset}
              onCustomChange={handleCustomTrialCount}
            />
          </div>

          <div className="config-section">
            <div className="config-label">{ufovLabels.chooseDirections}</div>
            <div className="difficulty-selector">
              {UFOV_TARGET_AXES.map((axis) => (
                <button
                  className={`diff-btn ${selectedUfovAxes.includes(axis) ? 'active' : ''}`}
                  key={axis}
                  onClick={() => toggleTargetAxis(axis)}
                  type="button"
                >
                  <span className="diff-btn-label">{axis + 1}. {ufovLabels.directions[axis]}</span>
                </button>
              ))}
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
            <button
              className="btn btn-primary btn-lg config-start-btn"
              type="button"
              onClick={() => {
                setIsUfovConfigOpen(false);
                setIsUfovRulesOpen(true);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              {ruleLabels.next}
            </button>
            <button className="btn btn-ghost btn-lg" type="button" onClick={() => setIsUfovConfigOpen(false)}>
              {ufovLabels.cancel}
            </button>
          </div>
        </ConfigDialog>
      )}
      {isUfovRulesOpen && (
        <div
          className="config-modal-overlay fade-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsUfovRulesOpen(false);
              setIsUfovConfigOpen(true);
            }
          }}
        >
          <TrainingRulesPanel
            className="config-modal-panel"
            label={ruleLabels.label}
            title={ufovLabels.subtests[effectiveUfovSubtest]}
            summaryTitle={ruleLabels.summary}
            summaryItems={[
              { value: ufovLabels.subtests[effectiveUfovSubtest] },
              { value: ufovLabels.modes[selectedUfovMode].label },
              { value: selectedUfovTrialCount },
              { value: `${selectedUfovAxes.length}/8` },
            ]}
            sections={getUfovRuleSections(lang, ufovLabels.subtests[effectiveUfovSubtest])}
            startLabel={ruleLabels.start}
            backLabel={ruleLabels.back}
            onStart={() => void handleStartUfov()}
            onBack={() => {
              setIsUfovRulesOpen(false);
              setIsUfovConfigOpen(true);
            }}
            role="dialog"
            aria-modal
            aria-label={`${ufovLabels.subtests[effectiveUfovSubtest]} ${ruleLabels.label}`}
          />
        </div>
      )}
    </main>
  );
}

const UFOV_SUBTESTS: SubtestId[] = [1, 2, 3];
const UFOV_RUN_MODES: UfovRunMode[] = ['practice', 'formal'];
const UFOV_TARGET_AXES: UfovTargetAxis[] = [0, 1, 2, 3, 4, 5, 6, 7];

function isMobileOrTabletDevice(deviceKind: ReturnType<typeof detectDisplayDeviceKind>) {
  return deviceKind === 'phone' || deviceKind === 'tablet';
}

function getBrainRuleLabels(lang: 'zh' | 'en') {
  return lang === 'en'
    ? {
        label: 'Game Rules',
        next: 'Rules',
        start: 'Start Training',
        back: 'Back to Settings',
        summary: 'Selected Settings',
      }
    : {
        label: '遊戲規則說明',
        next: '規則說明',
        start: '開始訓練',
        back: '回設定',
        summary: '目前設定',
      };
}

function getUfovRuleSections(lang: 'zh' | 'en', subtestTitle: string) {
  return lang === 'en'
    ? [
        {
          title: 'Task Goal',
          description: `Complete ${subtestTitle} by identifying the central item and, when required, the peripheral direction.`,
          items: [
            'Look at the center first and identify whether the central vehicle is a car or truck.',
            'For divided or selective attention trials, also report the peripheral target direction.',
            'Respond as accurately as possible; practice mode gives feedback, formal mode saves the configured results.',
          ],
        },
        {
          title: 'Results',
          description: 'The result records accuracy, processing speed, direction responses, and the configured trial count.',
        },
      ]
    : [
        {
          title: '任務目標',
          description: `完成「${subtestTitle}」，辨識中央目標，必要時同時判斷周邊目標方向。`,
          items: [
            '每題先看中央刺激，判斷中央車輛是汽車或卡車。',
            '分散注意或選擇性注意題型中，還要回報周邊目標所在方向。',
            '練習模式會提供回饋；正式模式會依設定題數保存成績。',
          ],
        },
        {
          title: '成績計算',
          description: '結算會記錄正確率、處理速度、方向反應與本次設定的題數。',
        },
      ];
}

function getUfovConfigLabels(lang: 'zh' | 'en') {
  return lang === 'en'
    ? {
        settingsTitle: 'UFOV Settings',
        chooseSubtest: 'Choose Subtest',
        chooseTrialCount: 'Choose Trial Count',
        customTrialCount: 'Custom',
        chooseDirections: 'Choose Stimulus Directions',
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
        directions: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
        modes: {
          instruction: { label: 'Instructions', description: 'Show instructions only, without scoring.' },
          practice: { label: 'Practice', description: 'Run 5 fixed-speed practice trials with feedback.' },
          formal: { label: 'Formal Test', description: 'Run the configured fixed-trial test and save results.' },
        },
      }
    : {
        settingsTitle: 'UFOV 設定',
        chooseSubtest: '選擇 Subtest',
        chooseTrialCount: '選擇 Trial 數量',
        customTrialCount: '自訂',
        chooseDirections: '選擇刺激呈現方向',
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
        directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
        modes: {
          instruction: { label: '說明', description: '只顯示測驗說明，不計分。' },
          practice: { label: '練習', description: '以固定速度進行 5 題練習並顯示回饋。' },
          formal: { label: '正式測驗', description: '依設定的固定 trial 數量進行測驗並儲存結果。' },
        },
      };
}
