import { useEffect, useState, type CSSProperties } from 'react';
import {
  MeasureDevicePerformance,
  type DevicePerformanceInfo,
} from '../devicePerformance';

export type DevicePerformanceNoticeLocale = 'zh-TW' | 'en';

export interface DevicePerformanceNoticeProps {
  locale?: DevicePerformanceNoticeLocale;
}

const labels = {
  'zh-TW': {
    title: '裝置效能提醒',
    description:
      '系統偵測到這台裝置的效能可能較低。若訓練畫面不順，建議改用較新的手機、平板或電腦，並關閉其他分頁。',
    dismiss: '關閉效能提醒',
  },
  en: {
    title: 'Device performance notice',
    description:
      'This device may have limited performance. If training feels unresponsive, try a newer phone, tablet, or computer and close other browser tabs.',
    dismiss: 'Dismiss performance notice',
  },
} as const;

const noticeStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  width: 'min(440px, calc(100vw - 32px))',
  margin: '16px auto',
  padding: '16px 18px',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--radius-m)',
  background: 'var(--bg-elevated)',
  boxShadow: 'var(--shadow-floating)',
  color: 'var(--text-primary)',
};

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 'calc(14px * var(--ui-font-scale, 1))',
  lineHeight: 1.5,
};

export function DevicePerformanceNotice({
  locale = 'zh-TW',
}: DevicePerformanceNoticeProps) {
  const [performanceInfo, setPerformanceInfo] = useState<DevicePerformanceInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const copy = labels[locale];

  useEffect(() => {
    let cancelled = false;
    let completed = false;
    let measuring = false;

    const measure = async () => {
      if (completed || measuring || document.visibilityState !== 'visible') return;
      measuring = true;
      const result = await MeasureDevicePerformance();
      measuring = false;
      if (cancelled || result.measurementSkipped) return;
      completed = true;
      setPerformanceInfo(result);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void measure();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void measure();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (dismissed || performanceInfo?.level !== 'low') return null;

  return (
    <aside aria-live="polite" style={noticeStyle}>
      <div style={copyStyle}>
        <strong>{copy.title}</strong>
        <p style={descriptionStyle}>{copy.description}</p>
      </div>
      <button
        aria-label={copy.dismiss}
        className="btn btn-secondary btn-sm"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <span className="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </aside>
  );
}
