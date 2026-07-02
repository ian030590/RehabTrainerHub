import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfigDialog } from '../../components/ConfigDialog';
import { NumberPresetSelector } from '../../components/NumberPresetSelector';
import { SelectionCard } from '../../components/SelectionCard';
import { UserSelector } from '../../components/UserSelector';
import { useT } from '../../i18n';
import { isAssessmentCalibrationAtDefaults } from '../../utils/settings';
import { useActiveUser } from '../../utils/useActiveUser';
import { useAppSetting } from '../../utils/useAppSetting';
import { ASSESSMENTS } from './assessmentDefinitions';
import type { TestType } from './logic/optotypeRenderer';

export function AssessmentPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const activeUser = useActiveUser();
  const [distanceCM] = useAppSetting('distanceInCM');

  const [expandedTest, setExpandedTest] = useState<TestType | null>(null);
  const [localTrials, setLocalTrials] = useState<number>(18);
  const [customTrialsInput, setCustomTrialsInput] = useState('');
  const [showCalibrationWarning, setShowCalibrationWarning] = useState(false);
  const [plInputMode, setPlInputMode] = useAppSetting('preferentialLookingInputMode');

  const handleCardClick = (testId: TestType) => {
    if (!activeUser) {
      alert(t('home.pleaseSelectUser'));
      return;
    }
    if (expandedTest === testId) {
      setExpandedTest(null);
    } else {
      setExpandedTest(testId);
      const assessment = ASSESSMENTS.find((item) => item.id === testId)!;
      setLocalTrials(assessment.defaultTrialCount);
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

  const handleStartTest = () => {
    if (!expandedTest || !activeUser) return;
    if (isAssessmentCalibrationAtDefaults()) {
      setShowCalibrationWarning(true);
      return;
    }

    navigate(getAssessmentUrl(false));
  };

  const handleCalibrateNow = () => {
    navigate('/settings');
  };

  const handleTryAnyway = () => {
    setShowCalibrationWarning(false);
    navigate(getAssessmentUrl(true));
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

  const expandedAssessment = ASSESSMENTS.find((item) => item.id === expandedTest);
  const trialsPresets = [12, 18, 24, 36];

  return (
    <div className="page-content">
      <UserSelector />

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
        {ASSESSMENTS.map((assessment) => (
          <SelectionCard
            key={assessment.id}
            title={t(assessment.titleKey)}
            description={t(assessment.descriptionKey)}
            icon={assessment.icon}
            isSelected={expandedTest === assessment.id}
            actionLabel={expandedTest === assessment.id ? t('btn.collapseSettings') : t('btn.selectTest')}
            meta={(
              <>
                <span>{assessment.optionCount} {t('assess.options')}</span>
                <span aria-hidden="true">·</span>
                <span>{t('assess.defaultTrials').replace('{n}', assessment.defaultTrialCount.toString())}</span>
              </>
            )}
            onSelect={() => handleCardClick(assessment.id)}
          />
        ))}
      </div>

      {/* Config Panel */}
      {expandedTest && expandedAssessment && (
        <ConfigDialog
          ariaLabel={t(expandedAssessment.titleKey)}
          onClose={() => setExpandedTest(null)}
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
                onClick={(e) => { e.stopPropagation(); handleStartTest(); }}
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

            <div className="config-summary">
              {t('assess.config.user')} <strong>{activeUser}</strong> ·{' '}
              {t('assess.config.test')} <strong>{t(expandedAssessment.titleKey)}</strong> ·{' '}
              {t('assess.config.trials')} <strong>{localTrials}</strong> ·{' '}
              {t('assess.config.dist')} <strong>{distanceCM} cm</strong>
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
              <button className="btn btn-secondary btn-lg" onClick={handleTryAnyway}>
                {t('assess.calibrationWarning.tryAnyway')}
              </button>
            </div>
        </ConfigDialog>
      )}
    </div>
  );
}
