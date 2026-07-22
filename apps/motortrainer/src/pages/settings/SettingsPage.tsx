import { useState } from 'react';
import { SettingsTabs } from '@rehab-trainer/ui/components/SettingsTabs';
import { useT } from '../../i18n';
import { GeneralTab } from './GeneralTab';
import { CalibrationTab } from './CalibrationTab';

type Tab = 'general' | 'calibration';

export function SettingsPage() {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [, setTick] = useState(0);
  const refresh = () => setTick((previousTick) => previousTick + 1);

  const tabs: { label: string; tab: Tab }[] = [
    { label: t('settings.tab.general'), tab: 'general' },
    { label: t('settings.tab.calibration'), tab: 'calibration' }
  ];

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('settings.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('settings.subtitle')}</p>

      <div className="settings-container">
        <SettingsTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'general' && <GeneralTab refresh={refresh} />}
        {activeTab === 'calibration' && <CalibrationTab refresh={refresh} />}
      </div>
    </div>
  );
}
