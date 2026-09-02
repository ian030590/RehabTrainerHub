export const gameSettingsSchemaVersion: 1;
export const gameSettingsMaximumFields: number;
export const gameSettingsMaximumJsonBytes: number;

export type GameSettingsLocale = 'zh-TW' | 'en';
export type GameSettingsLocalizedText = Record<GameSettingsLocale, string>;
export type GameSettingValue = string | number | boolean;

export interface GameSettingOption {
  value: string | number;
  label: GameSettingsLocalizedText;
  description?: GameSettingsLocalizedText;
}

interface GameSettingFieldBase {
  key: string;
  label: GameSettingsLocalizedText;
  description?: GameSettingsLocalizedText;
}

export interface GameSettingCheckboxField extends GameSettingFieldBase {
  type: 'checkbox';
  default: boolean;
}

export interface GameSettingColorField extends GameSettingFieldBase {
  type: 'color';
  default: string;
}

export interface GameSettingSliderField extends GameSettingFieldBase {
  type: 'slider';
  default: number;
  min: number;
  max: number;
  step: number;
  unit?: GameSettingsLocalizedText;
}

export interface GameSettingListField extends GameSettingFieldBase {
  type: 'list';
  default: string | number;
  options: GameSettingOption[];
}

export type GameSettingField =
  | GameSettingCheckboxField
  | GameSettingColorField
  | GameSettingSliderField
  | GameSettingListField;

export interface GameSettingsSection {
  id: string;
  title: GameSettingsLocalizedText;
  description?: GameSettingsLocalizedText;
  fields: GameSettingField[];
}

export interface GameSettingsDefinition {
  schemaVersion: typeof gameSettingsSchemaVersion;
  gameId: string;
  sections: GameSettingsSection[];
}

export type GameSettingsValues = Record<string, GameSettingValue>;

export function IsGameSettingsDefinition(value: unknown, expectedGameId?: string): value is GameSettingsDefinition;
export function ParseGameSettingsDefinition(value: unknown, expectedGameId?: string): GameSettingsDefinition;
export function GetGameSettingsDefaults(definition: GameSettingsDefinition): GameSettingsValues;
export function NormalizeGameSettingsValues(
  definition: GameSettingsDefinition,
  value: unknown,
): GameSettingsValues;
export function ResolveGameSettingsText(
  value: GameSettingsLocalizedText,
  locale: GameSettingsLocale | 'zh',
): string;
