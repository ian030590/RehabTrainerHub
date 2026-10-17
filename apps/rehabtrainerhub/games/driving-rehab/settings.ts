export interface DrivingSettings {
  difficulty: 'easy' | 'medium' | 'hard';
  renderQuality: 'high' | 'medium' | 'low';
  controlMode: 'arrow' | 'wasd' | 'wheel' | 'touch';
  redFlashEnabled: boolean;
}
export const defaultSettings: DrivingSettings = {
  difficulty: 'medium', renderQuality: 'high', controlMode: 'arrow', redFlashEnabled: true,
};
export function ValidateSettings(settings: DrivingSettings) {
  return ['easy', 'medium', 'hard'].includes(settings.difficulty)
    && ['high', 'medium', 'low'].includes(settings.renderQuality)
    && ['arrow', 'wasd', 'wheel', 'touch'].includes(settings.controlMode)
    && typeof settings.redFlashEnabled === 'boolean';
}
