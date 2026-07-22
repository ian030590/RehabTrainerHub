import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { NumberPresetSelector } from '@rehab-trainer/ui/components/NumberPresetSelector';
import { SelectionCard } from '@rehab-trainer/ui/components/SelectionCard';
import { DetectDisplayDeviceKind } from '@rehab-trainer/ui/displayTiming';
import { EnterFullscreenFromUserGesture } from '@rehab-trainer/ui/fullscreen';
import { useT } from '../../i18n';
import { IsAssessmentCalibrationAtDefaults } from '../../utils/settings';
import { useAppSetting } from '../../utils/useAppSetting';
import { assessments } from './assessmentDefinitions';
import type { AssessmentId } from './assessmentDefinitions';
import type { TestType } from './logic/optotypeRenderer';
import type { SubtestId, UfovRunMode } from './ufov/UfovPage';

export function AssessmentPage() {
  const { lang, t } = useT();
  const navigate = useNavigate();
  const [distanceCM] = useAppSetting('distanceInCM');

  const [expandedTest, setExpandedTest] = useState<TestType | null>(null);
  const [isUfovConfigOpen, setIsUfovConfigOpen] = useState(false);
  const [selectedUfovSubtest, setSelectedUfovSubtest] = useState<SubtestId>(1);
  const [selectedUfovMode, setSelectedUfovMode] = useState<UfovRunMode>('formal');
  const [localTrials, setLocalTrials] = useState<number>(18);
  const [customTrialsInput, setCustomTrialsInput] = useState('');
  const [showCalibrationWarning, setShowCalibrationWarning] = useState(false);
  const [plInputMode, setPlInputMode] = useAppSetting('preferentialLookingInputMode');
  const ufovLabels = GetUfovConfigLabels(lang);
  const isSmallScreenDevice = IsMobileOrTabletDevice(DetectDisplayDeviceKind());

  const handleCardClick = (testId: AssessmentId) => {
    const assessment = assessments.find((item) => item.id === testId)!;
    if (testId === 'ufov') {
      setExpandedTest(null);
      setIsUfovConfigOpen((current) => !current);
      return;
    }
    const testType = testId as TestType;
    setIsUfovConfigOpen(false);
    if (expandedTest === testType) {
      setExpandedTest(null);
    } else {
      setExpandedTest(testType);
      setLocalTrials(assessment.defaultTrialCount ?? 18);
      setCustomTrialsInput('');
    }
  };

  const getAssessmentUrl = (trialMode: boolean) => {
    if (!expandedTest) return '';
    const params = new URLSearchParams({
      type: expandedTest,
      trials: localTrials.toString(),
    });
    if (expandedTest === 'gratings') {
      params.set('responseMode', plInputMode);
    }
    if (trialMode) params.set('trialMode', 'true');

    return expandedTest === 'contrast'
      ? `/contrast-test?${params.toString()}`
      : `/acuity-test?${params.toString()}`;
  };

  const handleStartTest = async () => {
    if (!expandedTest) return;
    if (IsAssessmentCalibrationAtDefaults()) {
      setShowCalibrationWarning(true);
      return;
    }

    await EnterFullscreenFromUserGesture(document.documentElement);
    navigate(getAssessmentUrl(false));
  };

  const handleCalibrateNow = () => {
    navigate('/settings');
  };

  const handleTryAnyway = async () => {
    setShowCalibrationWarning(false);
    await EnterFullscreenFromUserGesture(document.documentElement);
    navigate(getAssessmentUrl(true));
  };

  const handleStartUfov = async () => {
    const subtestId = isSmallScreenDevice ? 1 : selectedUfovSubtest;
    await EnterFullscreenFromUserGesture(document.documentElement);
    setIsUfovConfigOpen(false);
    navigate(`/assessment/ufov?${new URLSearchParams({
      subtest: String(subtestId),
      mode: selectedUfovMode,
      start: '1',
    }).toString()}`);
  };

  const handlePLInputMode = (mode: 'keyboard' | 'webgazer') => {
    setPlInputMode(mode);
  };

  const handleTrialsPreset = (n: number) => {
    setLocalTrials(n);
    setCustomTrialsInput('');
  };

  const handleCustomTrials = (val: string) => {
    setCustomTrialsInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      setLocalTrials(num);
    }
  };

  const expandedAssessment = assessments.find((item) => item.id === expandedTest);
  const trialsPresets = [12, 18, 24, 36];

  return (
    <main className="page-content" id="main-content">
      {/* Disclaimer */}
      <div className="assessment-disclaimer fade-in">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{t('assess.disclaimer')}</span>
      </div>

      <h1 className="section-title fade-in-up">{t('nav.assessment')}</h1>
      <p className="section-subtitle fade-in-up">
        {t('assess.subtitle')}
      </p>

      {/* Test Cards Grid */}
      <div className="selection-grid">
        {assessments.map((assessment, index) => (
          <SelectionCard
            key={assessment.id}
            title={t(assessment.titleKey)}
            description={t(assessment.descriptionKey)}
            index={index + 1}
            isSelected={assessment.id === 'ufov' ? isUfovConfigOpen : expandedTest === assessment.id}
            actionLabel={(assessment.id === 'ufov' ? isUfovConfigOpen : expandedTest === assessment.id) ? t('btn.collapseSettings') : t('btn.selectTest')}
            meta={assessment.optionCount && assessment.defaultTrialCount ? (
              <>
                <span>{assessment.optionCount} {t('assess.options')}</span>
                <span aria-hidden="true">·</span>
                <span>{t('assess.defaultTrials').replace('{n}', assessment.defaultTrialCount.toString())}</span>
              </>
            ) : undefined}
            onSelect={() => handleCardClick(assessment.id)}
          />
        ))}
      </div>

      {/* Config Panel */}
      {expandedTest && expandedAssessment && (
        <ConfigDialog
          ariaLabel={t(expandedAssessment.titleKey)}
          onClose={() => setExpandedTest(null)}
          summaryItems={[
            { value: localTrials },
            { value: `${distanceCM} cm` },
          ]}
        >
            <div className="config-section">
              <div className="config-label">{t('assess.trialsLabel')}</div>
              <NumberPresetSelector
                value={localTrials}
                customValue={customTrialsInput}
                presets={trialsPresets}
                min={1}
                max={100}
                placeholder={t('home.config.custom')}
                onPresetSelect={handleTrialsPreset}
                onCustomChange={handleCustomTrials}
              />
            </div>

            {expandedTest === 'gratings' && (
              <div className="config-section">
                <div className="config-label">{t('assess.plMethodTitle')}</div>
                <div className="difficulty-selector">
                  <button
                    className={`diff-btn ${plInputMode === 'keyboard' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePLInputMode('keyboard');
                    }}
                  >
                    <span className="diff-btn-label">{t('assess.kbMode')}</span>
                    <span className="diff-btn-desc">{t('assess.kbModeDesc')}</span>
                  </button>
                  <button
                    className={`diff-btn ${plInputMode === 'webgazer' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePLInputMode('webgazer');
                    }}
                  >
                    <span className="diff-btn-label">{t('assess.wgMode')}</span>
                    <span className="diff-btn-desc">{t('assess.wgModeDesc')}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="config-actions">
              <button
                className="btn btn-primary btn-lg config-start-btn"
                onClick={(e) => { e.stopPropagation(); void handleStartTest(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {t('btn.startTest')}
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={(e) => { e.stopPropagation(); setExpandedTest(null); }}
              >
                {t('btn.cancel')}
              </button>
            </div>

        </ConfigDialog>
      )}

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
              {ufovSubtests.map((subtestId) => {
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
              {ufovRunModes.map((mode) => (
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

      {showCalibrationWarning && (
        <ConfigDialog
          ariaLabel={t('assess.calibrationWarning.title')}
          onClose={() => setShowCalibrationWarning(false)}
        >
            <div className="config-section">
              <div className="config-label">{t('assess.calibrationWarning.title')}</div>
              <p className="calibration-warning-message">
                {t('assess.calibrationWarning.message')}
              </p>
            </div>
            <div className="config-actions">
              <button className="btn btn-primary btn-lg" onClick={handleCalibrateNow}>
                {t('assess.calibrationWarning.calibrateNow')}
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => void handleTryAnyway()}>
                {t('assess.calibrationWarning.tryAnyway')}
              </button>
            </div>
        </ConfigDialog>
      )}
    </main>
  );
}

const ufovSubtests: SubtestId[] = [1, 2, 3];
const ufovRunModes: UfovRunMode[] = ['instruction', 'practice', 'formal'];

function IsMobileOrTabletDevice(deviceKind: ReturnType<typeof DetectDisplayDeviceKind>) {
  return deviceKind === 'phone' || deviceKind === 'tablet';
}

function GetUfovConfigLabels(lang: 'zh' | 'en') {
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
