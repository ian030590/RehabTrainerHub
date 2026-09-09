import { useState, type ReactNode } from 'react';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { useDrivingInputCapabilities, useDrivingWheelCalibration } from './drivingInputCapabilities';

export function DrivingWheelSetup({ children }: { children: ReactNode }) {
  if (GetHostedGameSetting<string>('controlMode') !== 'wheel') return children;
  return <WheelCalibration>{children}</WheelCalibration>;
}

function WheelCalibration({ children }: { children: ReactNode }) {
  const { lang } = useT();
  const zh = lang === 'zh';
  const capabilities = useDrivingInputCapabilities();
  const calibration = useDrivingWheelCalibration(capabilities.wheelDevice);
  const [ready, setReady] = useState(false);
  if (ready) return children;
  const instructions = {
    idle: zh ? '校正方向盤及踏板後開始。' : 'Calibrate the wheel and pedals before starting.',
    neutral: zh ? '方向盤置中，放開踏板，再按「下一步」。' : 'Center the wheel and release the pedals, then select Next.',
    left: zh ? '將方向盤轉到底左側，再按「下一步」。' : 'Turn the wheel fully left, then select Next.',
    right: zh ? '將方向盤轉到底右側，再按「下一步」。' : 'Turn the wheel fully right, then select Next.',
    throttle: zh ? '踩下並放開油門，再按「下一步」。' : 'Press and release the throttle, then select Next.',
    brake: zh ? '踩下並放開煞車，再按「下一步」。' : 'Press and release the brake, then select Next.',
    error: zh ? '未能完成校正。確認装置連接，重新校正。' : 'Calibration failed. Check the connection and calibrate again.',
  };
  return <TrainingRulesPanel
    title={zh ? '方向盤校正' : 'Wheel calibration'}
    startLabel={zh ? '開始活動' : 'Start activity'}
    backLabel={zh ? '返回設定' : 'Back to settings'}
    onBack={() => RequestHubTrainingConfiguration()}
    onStart={() => setReady(true)}
    startDisabled={!calibration.calibrated}
  >
    <p role="status">{capabilities.wheelDevice ? instructions[calibration.phase] : (zh ? '請連接方向盤，並按下裝置按鈕以讓瀏覽器辨識。' : 'Connect the wheel and press a device button so the browser can detect it.')}</p>
    {!capabilities.wheelDevice && <button type="button" onClick={capabilities.rescan}>{zh ? '重新偵測' : 'Rescan'}</button>}
    {capabilities.wheelDevice && <button type="button" onClick={calibration.phase === 'idle' || calibration.phase === 'error' ? calibration.begin : calibration.advance}>
      {calibration.phase === 'idle' || calibration.phase === 'error' ? (zh ? '校正方向盤' : 'Calibrate wheel') : (zh ? '下一步' : 'Next')}
    </button>}
  </TrainingRulesPanel>;
}
