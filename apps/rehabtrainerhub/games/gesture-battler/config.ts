export type GestureSettings = { enemyMaxHp: number; holdDurationSec: number; strictnessPercent: number; targetMode: 'free' | 'directed' };
export const defaultGestureConfig: GestureSettings = { enemyMaxHp: 10, holdDurationSec: 2, strictnessPercent: 70, targetMode: 'free' };
export function IsGestureConfig(config: GestureSettings) {
  return Number.isInteger(config.enemyMaxHp) && config.enemyMaxHp >= 1 && config.enemyMaxHp <= 100
    && Number.isFinite(config.holdDurationSec) && config.holdDurationSec >= 0.5 && config.holdDurationSec <= 10 && Number.isInteger(config.holdDurationSec * 2)
    && Number.isInteger(config.strictnessPercent) && config.strictnessPercent >= 50 && config.strictnessPercent <= 90 && config.strictnessPercent % 5 === 0
    && ['free', 'directed'].includes(config.targetMode);
}
