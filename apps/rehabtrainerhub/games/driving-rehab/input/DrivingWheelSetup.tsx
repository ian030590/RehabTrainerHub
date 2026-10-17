import { useT } from '../i18n/useT';
import { useDrivingInputCapabilities, useDrivingWheelCalibration } from './drivingInputCapabilities';

export function DrivingWheelSetup({ capabilities, calibration }: {
  capabilities: ReturnType<typeof useDrivingInputCapabilities>;
  calibration: ReturnType<typeof useDrivingWheelCalibration>;
}) {
  const { lang } = useT();
  const zh = lang === 'zh';
  const instructions = {
    idle: zh ? '校正方向盤及踏板後開始。' : 'Calibrate the wheel and pedals before starting.',
    neutral: zh ? '方向盤置中，放開踏板，再按「下一步」。' : 'Center the wheel and release the pedals, then select Next.',
    left: zh ? '將方向盤轉到底左側，再按「下一步」。' : 'Turn the wheel fully left, then select Next.',
    right: zh ? '將方向盤轉到底右側，再按「下一步」。' : 'Turn the wheel fully right, then select Next.',
    throttle: zh ? '踩下並放開油門，再按「下一步」。' : 'Press and release the throttle, then select Next.',
    brake: zh ? '踩下並放開煞車，再按「下一步」。' : 'Press and release the brake, then select Next.',
    error: zh ? '未能完成校正。確認装置連接，重新校正。' : 'Calibration failed. Check the connection and calibrate again.',
  };
  return (
    <section className="driving-wheel-setup">
        <p role="status">{capabilities.wheelDevice ? instructions[calibration.phase] : (zh ? '請連接方向盤，並按下裝置按鈕以讓瀏覽器辨識。' : 'Connect the wheel and press a device button so the browser can detect it.')}</p>
        {!capabilities.wheelDevice && <button type="button" onClick={capabilities.rescan}>{zh ? '重新偵測' : 'Rescan'}</button>}
        {capabilities.wheelDevice && <button type="button" onClick={calibration.phase === 'idle' || calibration.phase === 'error' ? calibration.begin : calibration.advance}>
          {calibration.phase === 'idle' || calibration.phase === 'error' ? (zh ? '校正方向盤' : 'Calibrate wheel') : (zh ? '下一步' : 'Next')}
        </button>}
    </section>
  );
}
