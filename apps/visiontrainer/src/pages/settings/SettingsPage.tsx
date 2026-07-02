import React, { useRef, useState } from 'react';
import { useT } from '../../i18n';
import ReactDOM from 'react-dom';
import { initJsPsych } from 'jspsych';
import WebGazerExtension from '@jspsych/extension-webgazer';
import WebGazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import WebGazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import {
  getSetting,
  setSetting,
  isCalibrated,
  markDisplayCalibrated,
  clearDisplayCalibration,
  getMMPerPixel,
  CAL_BAR_LENGTH_PX,
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
} from '../../utils/settings';
import { pixelFromMillimeter } from '../../utils/spatialUtils';

type Tab = 'general' | 'calibration' | 'webgazer' | 'gamma' | 'crowding';

export function SettingsPage() {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const tabs: { label: string; tab: Tab }[] = [
    { label: t('settings.tab.general'), tab: 'general' },
    { label: t('settings.tab.calibration'), tab: 'calibration' },
    { label: t('settings.tab.webgazer'), tab: 'webgazer' },
    { label: t('settings.tab.gamma'), tab: 'gamma' },
    { label: t('settings.tab.crowding'), tab: 'crowding' },
  ];

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('settings.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('settings.subtitle')}</p>

      <div className="settings-container">
        {/* Tabs */}
        <div className="settings-tabs">
          {tabs.map((t) => (
            <button
              key={t.tab}
              className={`settings-tab ${activeTab === t.tab ? 'active' : ''}`}
              onClick={() => setActiveTab(t.tab)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'general' && <GeneralTab refresh={refresh} />}
        {activeTab === 'calibration' && <CalibrationTab refresh={refresh} />}
        {activeTab === 'webgazer' && <WebGazerCalibrationTab refresh={refresh} />}
        {activeTab === 'gamma' && <GammaTab refresh={refresh} />}
        {activeTab === 'crowding' && <CrowdingTab refresh={refresh} />}
      </div>
    </div>
  );
}

/* ── General Tab ── */
function GeneralTab({ refresh }: { refresh: () => void }) {
  const { t, lang, setLang } = useT();

  return (
    <div className="fade-in">
      {/* Language Toggle */}
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.language.title')}</h3>
          <p>{t('settings.language.desc')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLang('zh'); refresh(); }}
          >
            {lang === 'zh' ? '中文' : 'Chinese'}
          </button>
          <button
            className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLang('en'); refresh(); }}
          >
            {lang === 'zh' ? '英文' : 'English'}
          </button>
        </div>
      </div>

      {/* Viewing Distance */}
      <SettingRow
        title={t('settings.distance.title')}
        desc={t('settings.distance.desc')}
        value={`${getSetting('distanceInCM')} cm`}
        onEdit={(val) => {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num >= 10 && num <= 500) {
            setSetting('distanceInCM', num);
            markDisplayCalibrated();
            refresh();
          }
        }}
        editPlaceholder="60"
      />      {/* Sound Toggle */}
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.sound.title')}</h3>
          <p>{t('settings.sound.desc')}</p>
        </div>
        <button
          className={`btn btn-sm ${getSetting('auditoryFeedbackEnabled') ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setSetting('auditoryFeedbackEnabled', !getSetting('auditoryFeedbackEnabled'));
            refresh();
          }}
        >
          {getSetting('auditoryFeedbackEnabled') ? t('settings.sound.on') : t('settings.sound.off')}
        </button>
      </div>

      {/* Download Prefix */}
      <SettingRow
        title={t('settings.prefix.title')}
        desc={t('settings.prefix.desc')}
        value={getSetting('downloadDirectory') || t('settings.prefix.notSet')}
        onEdit={(val) => {
          setSetting('downloadDirectory', val);
          refresh();
        }}
        editPlaceholder={t('settings.prefix.placeholder')}
      />
    </div>
  );
}

/* ── Calibration Tab ── */
function CalibrationTab({ refresh }: { refresh: () => void }) {
  const { t } = useT();
  const [calMode, setCalMode] = useState<'ruler' | 'card'>('ruler');
  const calibrated = isCalibrated();
  const mmPerPx = getMMPerPixel();

  return (
    <div className="fade-in">
      {/* Mode Switch */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          className={`btn btn-sm ${calMode === 'ruler' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setCalMode('ruler')}
        >
          {t('settings.cal.rulerMode')}
        </button>
        <button
          className={`btn btn-sm ${calMode === 'card' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setCalMode('card')}
        >
          {t('settings.cal.cardMode')}
        </button>
      </div>

      {calMode === 'ruler' ? (
        <RulerCalibration refresh={refresh} />
      ) : (
        <CardCalibration refresh={refresh} />
      )}

      {/* Info */}
      <div className="cal-info" style={{ color: calibrated ? 'var(--success)' : 'var(--warning)' }}>
        <p>{t('settings.cal.resolution')} {mmPerPx.toFixed(3)} mm/px ({(1 / mmPerPx).toFixed(2)} px/mm)</p>
        <p style={{ fontWeight: 600, marginTop: 4 }}>
          {calibrated ? t('settings.cal.done') : t('settings.cal.notDone')}
        </p>
      </div>
    </div>
  );
}

function RulerCalibration({ refresh }: { refresh: () => void }) {
  const { t } = useT();
  const [inputVal, setInputVal] = useState('');
  const rulerBarPx = 500;

  const handleApply = () => {
    const val = parseFloat(inputVal);
    if (!isNaN(val) && val > 0 && val <= 10000) {
      setSetting('rulerLengthInMM', val);
      const pxPerMM = rulerBarPx / val;
      const newCalBarMM = CAL_BAR_LENGTH_PX / pxPerMM;
      setSetting('calBarLengthInMM', newCalBarMM);
      markDisplayCalibrated();
      refresh();
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.8 }}>
        {t('settings.cal.rulerInst1')}<br />
        {t('settings.cal.rulerInst2')}
      </p>
      <div className="cal-ruler-bar" style={{ width: rulerBarPx }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <input
          className="input"
          style={{ width: 160 }}
          type="number"
          placeholder={t('settings.cal.rulerPlaceholder')}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleApply}>{t('btn.confirm')}</button>
      </div>
    </div>
  );
}

function CardCalibration({ refresh }: { refresh: () => void }) {
  const { t } = useT();
  const wPx = pixelFromMillimeter(CARD_WIDTH_MM);
  const hPx = pixelFromMillimeter(CARD_HEIGHT_MM);
  const factors = [1.1, 1.01, 1.0 / 1.01, 1.0 / 1.1];
  const labels = ['− −', '−', '+', '+ +'];

  const handleAdjust = (factor: number) => {
    const current = getSetting('calBarLengthInMM');
    setSetting('calBarLengthInMM', current * factor);
    markDisplayCalibrated();
    refresh();
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.8 }}>
        {t('settings.cal.cardInst1')}<br />
        {t('settings.cal.cardInst2')}
      </p>
      <div
        className="cal-card-outline"
        style={{ width: wPx, height: hPx }}
      >
        <span style={{
          position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
          fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
        }}>
          {CARD_WIDTH_MM}mm × {CARD_HEIGHT_MM}mm
        </span>
      </div>
      <div className="cal-controls" style={{ marginTop: 36 }}>
        {labels.map((label, i) => (
          <button
            key={label}
            className="btn btn-secondary btn-sm"
            onClick={() => handleAdjust(factors[i])}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        className="btn btn-danger btn-sm"
        style={{ marginTop: 16 }}
        onClick={() => { setSetting('calBarLengthInMM', 149); clearDisplayCalibration(); refresh(); }}
      >
        {t('settings.cal.resetBtn')}
      </button>
    </div>
  );
}

/* ── WebGazer Calibration Tab ── */
function WebGazerCalibrationTab({ refresh }: { refresh: () => void }) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const jsPsychRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const calibratedAt = getSetting('webGazerCalibrationAt');

  // Cleanup jsPsych on unmount
  React.useEffect(() => {
    return () => {
      if (jsPsychRef.current) {
        try {
          jsPsychRef.current.endExperiment?.();
        } catch {
          // Ignore cleanup errors
        }
        jsPsychRef.current = null;
      }
    };
  }, []);

  // ESC key to cancel calibration
  React.useEffect(() => {
    if (status !== 'running') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelCalibration();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  // Override the dynamically injected #webgazer-center-style from jsPsych plugin
  // so that the webcam video is horizontally centered at the top of the viewport.
  React.useEffect(() => {
    if (status !== 'running') return;
    const overrideStyle = (el: HTMLElement) => {
      if (el.id === 'webgazer-center-style' && el.tagName === 'STYLE') {
        (el as HTMLStyleElement).textContent =
          '#webgazerVideoContainer { top: 20px !important; left: 50% !important; transform: translateX(-50%) !important; }';
      }
    };
    // If it already exists, override immediately
    const existing = document.querySelector('#webgazer-center-style');
    if (existing) overrideStyle(existing as HTMLElement);
    // Watch for it being injected
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) overrideStyle(node);
        }
      }
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [status]);

  const runCalibration = () => {
    // Check if webgazer.js is loaded
    if (!(window as any).webgazer) {
      setStatus('error');
      setMessage(t('settings.wg.errorNotLoaded'));
      return;
    }

    setStatus('running');
    setMessage(t('settings.wg.startingCam'));

    // Wait for the overlay to render, then init jsPsych inside it
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        setStatus('error');
        setMessage(t('settings.wg.errorContainer'));
        return;
      }
      container.innerHTML = '';

      try {
        const jsPsych = initJsPsych({
          display_element: container,
          extensions: [
            { type: WebGazerExtension },
          ] as any,
          on_finish: () => {
            setSetting('webGazerCalibrationAt', new Date().toISOString());
            jsPsychRef.current = null;
            setStatus('done');
            setMessage(t('settings.wg.done'));
            refresh();
          },
        });

        jsPsychRef.current = jsPsych;

        jsPsych.run([
          {
            type: WebGazerInitCameraPlugin,
            instructions: `
              <div class="webgazer-jspsych-instructions">
                <h2>${t('settings.wg.title')}</h2>
                <p>${t('settings.wg.inst1')}</p>
                <p>${t('settings.wg.inst2')}</p>
                <p>${t('settings.wg.inst3')}</p>
              </div>
            `,
            button_text: t('settings.wg.startBtn'),
          },
          {
            type: WebGazerCalibratePlugin,
            calibration_points: [
              [10, 10], [50, 10], [90, 10],
              [10, 50], [50, 50], [90, 50],
              [10, 90], [50, 90], [90, 90],
            ],
            calibration_mode: 'click',
            repetitions_per_point: 2,
            randomize_calibration_order: true,
            point_size: 24,
          },
        ] as any);
      } catch (error) {
        jsPsychRef.current = null;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : t('settings.wg.errorFail'));
      }
    });
  };

  const cancelCalibration = () => {
    if (jsPsychRef.current) {
      try {
        jsPsychRef.current.endExperiment?.();
      } catch {
        // Ignore cleanup errors
      }
      jsPsychRef.current = null;
    }
    setStatus('idle');
    setMessage('');
  };

  const clearCalibrationStatus = () => {
    try {
      (window as any).webgazer?.clearData?.();
    } catch {
      // Clearing the saved status should still work if WebGazer is not active.
    }
    setSetting('webGazerCalibrationAt', '');
    setStatus('idle');
    setMessage('');
    refresh();
  };

  return (
    <div className="fade-in">
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.wg.title')}</h3>
          <p>{t('settings.wg.desc')}</p>
        </div>
        <span className="setting-value" style={{ fontSize: 14 }}>
          {calibratedAt ? new Date(calibratedAt).toLocaleString() : t('settings.wg.notCalibrated')}
        </span>
      </div>

      <div className="webgazer-calibration-panel">
        <div className="webgazer-calibration-steps">
          <h4>{t('settings.wg.howToTitle')}</h4>
          <ol>
            <li>{t('settings.wg.step1')}</li>
            <li>{t('settings.wg.step2')}</li>
            <li>{t('settings.wg.step3')}</li>
            <li>{t('settings.wg.step4')}</li>
          </ol>
        </div>
        {status !== 'running' && (
          <div className="webgazer-calibration-actions">
            <button className="btn btn-primary btn-sm" onClick={runCalibration}>
              {calibratedAt ? t('settings.wg.recalibrateBtn') : t('settings.wg.startBtn')}
            </button>
            {calibratedAt && (
              <button className="btn btn-ghost btn-sm" onClick={clearCalibrationStatus}>
                {t('settings.wg.clearBtn')}
              </button>
            )}
          </div>
        )}
        {message && (
          <p className={`webgazer-calibration-message ${status === 'error' ? 'error' : ''}`}>
            {message}
          </p>
        )}
      </div>


      {/* Full-screen overlay for calibration – rendered via Portal on document.body
          so it is completely independent of the app layout and Navbar */}
      {status === 'running' &&
        ReactDOM.createPortal(
          <div className="webgazer-fullscreen-overlay">
            <div ref={containerRef} className="webgazer-fullscreen-stage" />
            <button
              className="webgazer-cancel-btn"
              onClick={cancelCalibration}
              title={t('settings.wg.cancelTitle')}
            >
              {t('settings.wg.cancelBtn')}
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

/* ── Gamma Tab ── */
function GammaTab({ refresh }: { refresh: () => void }) {
  const { t } = useT();
  const gammaVal = getSetting('gammaValue');
  const deltas = [
    { label: '− 0.1', delta: -0.1 },
    { label: '− 0.01', delta: -0.01 },
    { label: '+ 0.01', delta: 0.01 },
    { label: '+ 0.1', delta: 0.1 },
  ];

  // Calculate gamma-corrected gray
  const gray50 = Math.pow(0.5, 1.0 / gammaVal);
  const grayHex = Math.round(gray50 * 255).toString(16).padStart(2, '0');
  const grayColor = `#${grayHex}${grayHex}${grayHex}`;

  return (
    <div className="fade-in" style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.8 }}>
        {t('settings.gamma.inst')}
      </p>

      <div style={{
        width: 300,
        height: 300,
        background: grayColor,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-m)',
      }}>
        <GammaCheckerboard gammaVal={gammaVal} size={100} />
      </div>

      <div style={{ marginTop: 20, fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
        {t('settings.tab.gamma')}: {gammaVal.toFixed(2)}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        {deltas.map((b) => (
          <button
            key={b.label}
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const nv = Math.round((gammaVal + b.delta) * 100) / 100;
              if (nv >= 0.8 && nv <= 4.0) {
                setSetting('gammaValue', nv);
                refresh();
              }
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GammaCheckerboard({ gammaVal, size }: { gammaVal: number; size: number }) {
  const cellSize = 4;
  const gPlus = Math.pow(0.05, 1.0 / gammaVal);
  const gMinus = Math.pow(0.95, 1.0 / gammaVal);

  const toHex = (v: number) => {
    const h = Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${h}${h}${h}`;
  };

  const darkColor = toHex(gPlus);
  const lightColor = toHex(gMinus);

  // Use an inline SVG pattern for the checkerboard
  const cells: React.ReactElement[] = [];
  for (let y = 0; y < size; y += cellSize) {
    for (let x = 0; x < size; x += cellSize) {
      const isEven = ((x / cellSize + y / cellSize) % 2) === 0;
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={cellSize}
          height={cellSize}
          fill={isEven ? darkColor : lightColor}
        />
      );
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells}
    </svg>
  );
}

/* ── Crowding Tab ── */
function CrowdingTab({ refresh }: { refresh: () => void }) {
  const { t } = useT();
  const crowdTypes = [
    t('settings.crowd.type0'), t('settings.crowd.type1'), t('settings.crowd.type2'),
    t('settings.crowd.type3'), t('settings.crowd.type4'), t('settings.crowd.type5'),
    t('settings.crowd.type6')
  ];
  const distTypes = [
    t('settings.crowd.dist0'), t('settings.crowd.dist1'),
    t('settings.crowd.dist2'), t('settings.crowd.dist3')
  ];

  return (
    <div className="fade-in">
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.crowd.typeTitle')}</h3>
          <p>{t('settings.crowd.typeDesc')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="setting-value" style={{ fontSize: 14 }}>
            {crowdTypes[getSetting('crowdingType')]}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSetting('crowdingType', ((getSetting('crowdingType') + 1) % 7) as number);
              refresh();
            }}
          >
            {t('btn.switch')}
          </button>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.crowd.distTitle')}</h3>
          <p>{t('settings.crowd.distDesc')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="setting-value" style={{ fontSize: 14 }}>
            {distTypes[getSetting('crowdingDistanceType')]}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSetting('crowdingDistanceType', ((getSetting('crowdingDistanceType') + 1) % 4) as number);
              refresh();
            }}
          >
            {t('btn.switch')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Setting Row with Edit ── */
function SettingRow({
  title,
  desc,
  value,
  onEdit,
  editPlaceholder,
}: {
  title: string;
  desc: string;
  value: string;
  onEdit: (val: string) => void;
  editPlaceholder: string;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const handleStartEdit = () => {
    setInputVal('');
    setEditing(true);
  };

  const handleConfirm = () => {
    onEdit(inputVal);
    setEditing(false);
  };

  return (
    <div className="setting-row">
      <div className="setting-info">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ width: 120 }}
            placeholder={editPlaceholder}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleConfirm}>{t('btn.confirm')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('btn.cancel')}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="setting-value">{value}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleStartEdit}>{t('btn.edit')}</button>
        </div>
      )}
    </div>
  );
}
