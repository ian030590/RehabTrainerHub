import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { initJsPsych } from 'jspsych';
import type { JsPsych } from 'jspsych';
import {
  DestroyPixiRuntime,
  WarmUpPixiRuntime,
  pixiRuntimeScopes,
} from '../../utils/pixiPool';
import PixiContrastSensitivityPlugin from '@rehab-trainer/hub-modules/vision/experiment/plugins/pixi-contrast-sensitivity';
import { BestPEST } from './logic/bestPest';
import { getActiveUser, GetSetting } from '../../utils/settings';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';

interface ContrastTrialRecord {
  trial: number;
  presented: number;
  response: string;
  correct: boolean;
  contrastWeber: number;
  logCSW: number;
}

function FormatAlternative(alt: number) {
  const map: Record<number, string> = {
    0: '↕',
    2: '⤢',
    4: '↔',
    6: '⤡',
  };
  return map[alt] || String(alt);
}

export function ContrastTestPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { fullscreenRootRef } = useFullscreenTrainingRoot<HTMLDivElement>();
  const containerRef = useRef<HTMLDivElement>(null);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const abortingRef = useRef(false);
  
  const [phase, setPhase] = useState<'running' | 'results'>('running');
  const [resultLogCSW, setResultLogCSW] = useState<number>(0);
  const [trialRecords, setTrialRecords] = useState<ContrastTrialRecord[]>([]);
  const [loadError, setLoadError] = useState('');

  const [searchParams] = useSearchParams();
  const totalTrials = parseInt(searchParams.get('trials') || '18', 10);
  
  const userName = getActiveUser() || t('exp.unknownUser');

  useEffect(() => {
    if (phase !== 'running') return;
    if (!containerRef.current) return;
    if (jsPsychRef.current) return;

    const setup = async () => {
      try {
        setLoadError('');
        await WarmUpPixiRuntime(pixiRuntimeScopes.contrastAssessment);
      
        const jsPsych = initJsPsych({
          display_element: containerRef.current!,
          on_finish: () => {
            if (abortingRef.current) return;
            setPhase('results');
          }
        });
        jsPsychRef.current = jsPsych;

      const pest = new BestPEST(4); // 4 alternatives for grating
      let currentTrial = 0;
      let appliedStim = 0.5;

      const records: ContrastTrialRecord[] = [];
      let currentDirection = 0;
      let currentWeber = 0;
      let currentLogCSW = 0;

      const getBackColor = () => {
        const gamma = GetSetting('gammaValue') || 2.2;
        const c = Math.round(Math.pow(0.5, 1 / gamma) * 255);
        const hex = c.toString(16).padStart(2, '0');
        return `#${hex}${hex}${hex}`;
      };

      const getContrast = () => {
        appliedStim = pest.nextStim2apply();
        const logCSWMaximal = 2.0; // Max logCS
        currentLogCSW = logCSWMaximal - logCSWMaximal * appliedStim;
        currentWeber = Math.pow(10, -currentLogCSW);
        return currentWeber;
      };

      const getDirection = () => {
        currentDirection = [0, 1, 2, 3][Math.floor(Math.random() * 4)];
        return currentDirection;
      };

      const trialNode = {
        type: PixiContrastSensitivityPlugin,
        optotype: 'grating',
        direction: getDirection,
        stroke_px: 40, // 400px patch size
        contrast: getContrast,
        back_color: getBackColor,
        on_finish: (data: any) => {
          pest.enterTrialOutcome(appliedStim, data.correct);
          records.push({
            trial: currentTrial + 1,
            presented: currentDirection,
            response: data.response,
            correct: data.correct,
            contrastWeber: currentWeber,
            logCSW: currentLogCSW,
          });
          currentTrial++;
        }
      };

      const loopNode = {
        timeline: [trialNode],
        loop_function: () => {
          return currentTrial < totalTrials;
        }
      };

        jsPsych.run([loopNode]).then(() => {
          if (abortingRef.current) return;
          const finalStim = pest.nextStim2apply();
          const logCSWMaximal = 2.0;
          const finalLogCSW = logCSWMaximal - logCSWMaximal * finalStim;
          setResultLogCSW(finalLogCSW);
          setTrialRecords(records);
          DestroyPixiRuntime(pixiRuntimeScopes.contrastAssessment);
        });
      } catch (error) {
        console.error('Contrast assessment failed to start:', error);
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    };

    setup();

    return () => {
      // cleanup on unmount
      if (jsPsychRef.current && phase === 'running') {
        DestroyPixiRuntime(pixiRuntimeScopes.contrastAssessment);
      }
    };
  }, [phase]);

  const abortTest = () => {
    abortingRef.current = true;
    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    DestroyPixiRuntime(pixiRuntimeScopes.contrastAssessment);
    navigate('/assessment');
  };

  useTrainingAbort({
    active: phase === 'running',
    onAbort: abortTest,
  });

  const wrapFullscreenRoot = (content: ReactNode) => (
    <div ref={fullscreenRootRef} className={`contrast-fullscreen-root contrast-fullscreen-root-${phase}`}>
      {content}
    </div>
  );

  if (loadError) {
    return wrapFullscreenRoot(
      <div className="experiment-container">
        <div className="experiment-instructions">
          <h1>{t('home.trainingLoadError')}</h1>
          <p>{loadError}</p>
          <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate('/assessment')}>
            {t('exp.backHome')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'results') {
     const correctCount = trialRecords.filter((r) => r.correct).length;
     
     return wrapFullscreenRoot(
       <div className="experiment-container" style={{ overflowY: 'auto' }}>
         <div className="acuity-results">
           <h1 style={{ fontSize: 32 }}>{t('acuity.done') || 'Practice Complete'}</h1>
           <p className="assessment-disclaimer">{t('assess.resultDisclaimer')}</p>

           <div className="acuity-result-cards">
             <div className="acuity-result-card">
               <div className="acuity-result-label">logCS reference (Weber)</div>
               <div className="acuity-result-value" style={{ color: 'var(--accent)' }}>{resultLogCSW.toFixed(2)}</div>
             </div>
             <div className="acuity-result-card">
               <div className="acuity-result-label">Presented contrast %</div>
               <div className="acuity-result-value">{(Math.pow(10, -resultLogCSW)*100).toFixed(2)}%</div>
             </div>
           </div>

           <div className="acuity-result-meta">
             <span>{t('assess.config.test') || 'Test'} <b>{t('assess.contrast.resultsTitle') || 'Contrast Sensitivity'}</b></span>
             <span>{t('acuity.csv.accuracy') || 'Accuracy'}: <b style={{ color: 'var(--accent)' }}>{correctCount}/{trialRecords.length}</b></span>
             <span>{t('assess.config.user') || 'User'} <b>{userName}</b></span>
           </div>

           <table className="results-table">
             <thead>
               <tr>
                 <th>{t('acuity.csv.trial') || 'Trial'}</th>
                 <th>{t('acuity.csv.presented') || 'Presented'}</th>
                 <th>{t('acuity.csv.response') || 'Response'}</th>
                 <th>{t('acuity.csv.correct') || 'Correct'}</th>
                 <th>logCS reference</th>
               </tr>
             </thead>
             <tbody>
               {trialRecords.map((r) => (
                 <tr key={r.trial}>
                   <td>{r.trial}</td>
                   <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{FormatAlternative(r.presented)}</td>
                   <td>{r.response}</td>
                   <td style={{ color: r.correct ? 'var(--success)' : 'var(--error)' }}>
                     {r.correct ? '✓' : '✗'}
                   </td>
                   <td>{r.logCSW.toFixed(2)}</td>
                 </tr>
               ))}
             </tbody>
           </table>

           <TrainingResultActions
             backLabel={t('exp.backHome')}
             onBackHome={() => navigate('/')}
             hubLabel={t('exp.backLobby')}
           />
           
           <p className="acuity-disclaimer-footer">
             {t('assess.disclaimer')}
           </p>
         </div>
       </div>
     );
  }

  return wrapFullscreenRoot(
    <div className="contrast-running-stage">
       <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
