import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useT } from '../../i18n';
import {
  clampHartScale,
  createHartChart,
  createHartDecoder,
  createHartSeed,
  parseHartSeed,
} from './hartChart';
import type {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { HartCell, HartDecoderToken } from './hartChart';
import './hart-chart.css';

type DecoderDock = 'left' | 'right' | 'top' | 'bottom';

interface DecoderDragPreview {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DECODER_DOCK_KEY = 'vision_trainer_hart_decoder_dock';
const DECODER_DOCKS: readonly DecoderDock[] = ['left', 'right', 'top', 'bottom'];

function isDecoderDock(value: string | null): value is DecoderDock {
  return value !== null && DECODER_DOCKS.includes(value as DecoderDock);
}

function getInitialDecoderDock(): DecoderDock {
  const savedDock = localStorage.getItem(DECODER_DOCK_KEY);
  if (isDecoderDock(savedDock)) return savedDock;
  return window.matchMedia('(orientation: portrait)').matches ? 'bottom' : 'right';
}

interface HartChartGridProps {
  cells: HartCell[];
  scale: number;
  hintedToken?: HartDecoderToken;
  hintsEnabled?: boolean;
  chartOnly?: boolean;
}

function HartChartGrid({
  cells,
  scale,
  hintedToken,
  hintsEnabled = false,
  chartOnly = false,
}: HartChartGridProps) {
  const hint = hintsEnabled ? hintedToken?.coordinate : undefined;
  const style = chartOnly
    ? {
        '--hart-font-min': `${20 * scale}px`,
        '--hart-font-fluid': `${5.5 * scale}vmin`,
        '--hart-font-max': `${62 * scale}px`,
      } as CSSProperties
    : {
        '--hart-font-min': `${22 * scale}px`,
        '--hart-font-fluid': `${5.1 * scale}vmin`,
        '--hart-font-max': `${47 * scale}px`,
      } as CSSProperties;

  return (
    <div
      className={`hart-chart-grid ${chartOnly ? 'hart-chart-grid-only' : ''}`}
      style={style}
      aria-label="Hart chart"
    >
      {cells.map((cell) => {
        const isAxis = hint && (cell.row === hint.row || cell.col === hint.col);
        const isTarget = hint && cell.row === hint.row && cell.col === hint.col;
        const className = [
          'hart-chart-cell',
          isAxis ? 'hart-chart-cell-axis' : '',
          isTarget ? 'hart-chart-cell-target' : '',
        ].filter(Boolean).join(' ');

        return (
          <span className={className} key={`${cell.row}-${cell.col}`}>
            {cell.char}
          </span>
        );
      })}
    </div>
  );
}

export function HartChartPage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(createHartSeed);
  const [scale, setScale] = useState(1);
  const [decoderOpen, setDecoderOpen] = useState(false);
  const [decoderDock, setDecoderDock] = useState<DecoderDock>(getInitialDecoderDock);
  const [decoderDragging, setDecoderDragging] = useState(false);
  const [decoderDragTarget, setDecoderDragTarget] = useState<DecoderDock>(decoderDock);
  const [decoderDragPreview, setDecoderDragPreview] = useState<DecoderDragPreview | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const decoderPanelRef = useRef<HTMLElement>(null);
  const decoderDragActiveRef = useRef(false);
  const decoderDragTargetRef = useRef<DecoderDock>(decoderDock);

  const chart = useMemo(() => createHartChart(seed), [seed]);
  const decoder = useMemo(() => createHartDecoder(chart, seed), [chart, seed]);
  const shareUrl = useMemo(() => {
    const baseUrl = window.location.href.split('#')[0];
    const params = new URLSearchParams({
      seed: String(seed),
      scale: String(scale),
      lang,
    });
    return `${baseUrl}#/hart-chart/display?${params.toString()}`;
  }, [lang, scale, seed]);

  const decodableIndexes = useMemo(
    () => decoder.tokens
      .map((token, index) => token.coordinate ? index : -1)
      .filter((index) => index >= 0),
    [decoder.tokens],
  );

  const complete = decodableIndexes.length > 0
    && decodableIndexes.every((index) => answers[index] === decoder.tokens[index].char);

  useEffect(() => {
    setAnswers(Array(decoder.tokens.length).fill(''));
    setActiveTokenIndex(null);
    inputRefs.current = [];
  }, [decoder]);

  useEffect(() => {
    if (!qrOpen) return;

    let cancelled = false;
    void QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [qrOpen, shareUrl]);

  useEffect(() => {
    if (!qrOpen && !instructionsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setQrOpen(false);
      setInstructionsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [instructionsOpen, qrOpen]);

  const resetChart = () => {
    setSeed(createHartSeed());
    setQrDataUrl('');
  };

  const setDock = (dock: DecoderDock) => {
    setDecoderDock(dock);
    setDecoderDragTarget(dock);
    decoderDragTargetRef.current = dock;
    localStorage.setItem(DECODER_DOCK_KEY, dock);
  };

  const getDockFromPointer = (clientX: number, clientY: number): DecoderDock => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return decoderDock;

    const distances: Record<DecoderDock, number> = {
      left: Math.abs(clientX - rect.left),
      right: Math.abs(rect.right - clientX),
      top: Math.abs(clientY - rect.top),
      bottom: Math.abs(rect.bottom - clientY),
    };

    return DECODER_DOCKS.reduce((nearest, dock) => (
      distances[dock] < distances[nearest] ? dock : nearest
    ), 'right');
  };

  const handleDecoderDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    const panelRect = decoderPanelRef.current?.getBoundingClientRect();
    if (!panelRect) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    decoderDragActiveRef.current = true;
    decoderDragTargetRef.current = decoderDock;
    setDecoderDragTarget(decoderDock);
    setDecoderDragging(true);

    const width = Math.min(panelRect.width, 440, window.innerWidth - 16);
    const height = Math.min(panelRect.height, 500, window.innerHeight - 16);
    setDecoderDragPreview({
      x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - width / 2)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - 28)),
      width,
      height,
    });
  };

  const handleDecoderDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!decoderDragActiveRef.current) return;

    event.preventDefault();
    const dock = getDockFromPointer(event.clientX, event.clientY);
    decoderDragTargetRef.current = dock;
    setDecoderDragTarget(dock);
    setDecoderDragPreview((current) => current ? {
      ...current,
      x: Math.max(8, Math.min(window.innerWidth - current.width - 8, event.clientX - current.width / 2)),
      y: Math.max(8, Math.min(window.innerHeight - current.height - 8, event.clientY - 28)),
    } : null);
  };

  const finishDecoderDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!decoderDragActiveRef.current) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    decoderDragActiveRef.current = false;
    setDock(decoderDragTargetRef.current);
    setDecoderDragging(false);
    setDecoderDragPreview(null);
  };

  const handleDecoderDockKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const dockByKey: Partial<Record<string, DecoderDock>> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'top',
      ArrowDown: 'bottom',
    };
    const dock = dockByKey[event.key];
    if (!dock) return;

    event.preventDefault();
    setDock(dock);
  };

  const handleAnswer = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase();
    const nextAnswers = [...answers];
    nextAnswers[index] = value;
    setAnswers(nextAnswers);

    if (value !== decoder.tokens[index].char) return;

    const nextIndex = decodableIndexes.find((candidate) => (
      candidate > index && nextAnswers[candidate] !== decoder.tokens[candidate].char
    ));

    if (nextIndex !== undefined) {
      window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
    } else {
      event.target.blur();
    }
  };

  return (
    <main className={`hart-page ${decoderOpen ? `hart-page-decoder-open hart-decoder-dock-${decoderDock}` : ''}`}>
      <header className="hart-topbar">
        <div className="hart-topbar-leading">
          <button className="btn btn-ghost hart-back-button" type="button" onClick={() => navigate('/')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {t('common.back')}
          </button>
          <div className="hart-title-block">
            <h1>{t('hart.title')}</h1>
            <p>{t('hart.subtitle')}</p>
          </div>
        </div>

        <div className="hart-topbar-controls">
          <label className="hart-scale-control">
            <span>{t('hart.fontSize')}</span>
            <input
              type="range"
              min="0.65"
              max="1.45"
              step="0.05"
              value={scale}
              onChange={(event) => setScale(clampHartScale(Number(event.target.value)))}
            />
            <output>{Math.round(scale * 100)}%</output>
          </label>

          <button
            className={`btn btn-secondary hart-tool-button ${decoderOpen ? 'active' : ''}`}
            type="button"
            aria-pressed={decoderOpen}
            onClick={() => {
              setDecoderOpen((open) => !open);
              setActiveTokenIndex(null);
            }}
          >
            {t('hart.decoder')}
          </button>
          <button className="btn btn-secondary hart-tool-button" type="button" onClick={() => setInstructionsOpen(true)}>
            {t('hart.instructionsButton')}
          </button>
          <button className="btn btn-secondary hart-tool-button" type="button" onClick={() => setQrOpen(true)}>
            {t('hart.openQr')}
          </button>
          <button className="btn btn-primary hart-tool-button" type="button" onClick={resetChart}>
            {t('hart.reset')}
          </button>
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`hart-workspace ${decoderDragging ? 'hart-workspace-is-dragging' : ''}`}
      >
        <section className="hart-chart-stage">
          <HartChartGrid
            cells={chart}
            scale={scale}
            hintsEnabled={showHints}
            hintedToken={activeTokenIndex === null ? undefined : decoder.tokens[activeTokenIndex]}
          />
        </section>

        {decoderOpen && (
          <aside
            ref={decoderPanelRef}
            className={`hart-decoder-panel ${decoderDragging ? 'hart-decoder-panel-dragging' : ''}`}
            style={decoderDragPreview ? {
              left: decoderDragPreview.x,
              top: decoderDragPreview.y,
              width: decoderDragPreview.width,
              height: decoderDragPreview.height,
            } : undefined}
          >
            <div className="hart-decoder-header">
              <button
                className="hart-decoder-drag-handle"
                type="button"
                aria-label={t('hart.dragDecoderHint')}
                title={t('hart.dragDecoderHint')}
                onPointerDown={handleDecoderDragStart}
                onPointerMove={handleDecoderDragMove}
                onPointerUp={finishDecoderDrag}
                onPointerCancel={finishDecoderDrag}
                onKeyDown={handleDecoderDockKeyDown}
              >
                <span className="hart-drag-grip" aria-hidden="true">
                  <i /><i /><i /><i /><i /><i />
                </span>
                <span>
                  <strong>{t('hart.decoder')}</strong>
                  <small>{t('hart.dragDecoder')}</small>
                </span>
              </button>
              <label className="hart-hints-toggle">
                <input
                  type="checkbox"
                  checked={showHints}
                  onChange={(event) => setShowHints(event.target.checked)}
                />
                {t('hart.showHints')}
              </label>
            </div>

            <div className="hart-decoder-scroll">
              <div
                className={`hart-code-output ${complete ? 'hart-code-output-complete' : ''}`}
                aria-label={t('hart.decoder')}
              >
                {decoder.tokens.map((token, index) => {
                  if (!token.coordinate) {
                    return (
                      <span className="hart-code-static" key={`${index}-${token.char}`}>
                        {token.char === ' ' ? '\u00A0' : token.char}
                      </span>
                    );
                  }

                  const isCorrect = answers[index] === token.char;
                  return (
                    <input
                      key={`${index}-${token.char}`}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      className={`hart-code-input ${isCorrect ? 'is-correct' : ''}`}
                      value={answers[index] ?? ''}
                      placeholder={`[${token.coordinate.row},${token.coordinate.col}]`}
                      aria-label={`${t('hart.coordinate')} ${token.coordinate.row}, ${token.coordinate.col}`}
                      maxLength={1}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => handleAnswer(index, event)}
                      onFocus={() => setActiveTokenIndex(index)}
                      onBlur={() => setActiveTokenIndex((current) => current === index ? null : current)}
                      onMouseEnter={() => setActiveTokenIndex(index)}
                      onMouseLeave={() => {
                        if (document.activeElement !== inputRefs.current[index]) {
                          setActiveTokenIndex(null);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <p className="hart-decoder-status" aria-live="polite">
              {complete ? `${t('hart.decoderComplete')} ${decoder.phrase}` : t('hart.decoderPrompt')}
            </p>
          </aside>
        )}

        {decoderDragging && (
          <div className="hart-dock-zones" aria-hidden="true">
            {DECODER_DOCKS.map((dock) => (
              <div
                key={dock}
                className={`hart-dock-zone hart-dock-zone-${dock} ${decoderDragTarget === dock ? 'active' : ''}`}
              >
                <span>{t(`hart.dock.${dock}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {instructionsOpen && (
        <div className="hart-modal-overlay" role="presentation" onClick={() => setInstructionsOpen(false)}>
          <section
            className="hart-instructions-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hart-instructions-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hart-dialog-header">
              <h2 id="hart-instructions-title">{t('hart.instructionsTitle')}</h2>
              <button
                className="hart-dialog-close"
                type="button"
                aria-label={t('hart.close')}
                onClick={() => setInstructionsOpen(false)}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="hart-instructions-content">
              <ol>
                <li>{t('hart.instructions.1')}</li>
                <li>{t('hart.instructions.2')}</li>
                <li>{t('hart.instructions.3')}</li>
                <li>{t('hart.instructions.4')}</li>
                <li>{t('hart.instructions.5')}</li>
                <li>{t('hart.instructions.6')}</li>
                <li>{t('hart.instructions.7')}</li>
              </ol>
              <p className="hart-instructions-note"><strong>{t('hart.rememberLabel')}</strong> {t('hart.remember')}</p>

              <h3>{t('hart.decoderInstructionsTitle')}</h3>
              <ol>
                <li>{t('hart.decoderInstructions.1')}</li>
                <li>{t('hart.decoderInstructions.2')}</li>
                <li>{t('hart.decoderInstructions.3')}</li>
                <li>{t('hart.decoderInstructions.4')}</li>
                <li>{t('hart.decoderInstructions.5')}</li>
              </ol>
            </div>
          </section>
        </div>
      )}

      {qrOpen && (
        <div className="hart-modal-overlay" role="presentation" onClick={() => setQrOpen(false)}>
          <div
            className="hart-qr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hart-qr-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="hart-qr-title">{t('hart.qrTitle')}</h2>
            <p>{t('hart.qrDescription')}</p>
            {qrDataUrl ? <img src={qrDataUrl} alt={t('hart.qrAlt')} /> : <div className="hart-qr-loading" />}
            <a href={shareUrl} target="_blank" rel="noreferrer">{t('hart.openDisplay')}</a>
            <button className="btn btn-primary" type="button" onClick={() => setQrOpen(false)}>
              {t('hart.close')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export function HartChartDisplayPage() {
  const [searchParams] = useSearchParams();
  const seed = useMemo(() => parseHartSeed(searchParams.get('seed')), [searchParams]);
  const scale = clampHartScale(Number(searchParams.get('scale') ?? '1'));
  const chart = useMemo(() => createHartChart(seed), [seed]);

  useEffect(() => {
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().catch(() => undefined);
      }
      window.removeEventListener('pointerdown', enterFullscreen);
    };

    window.addEventListener('pointerdown', enterFullscreen, { once: true });
    return () => window.removeEventListener('pointerdown', enterFullscreen);
  }, []);

  return (
    <main className="hart-display-page">
      <HartChartGrid cells={chart} scale={scale} chartOnly />
    </main>
  );
}
