import {
  NormalizeGameSettingsValues,
  ParseGameSettingsDefinition,
  type GameSettingsDefinition,
  type GameSettingsValues,
} from '@rehab-trainer/game-settings';

// Third-party games use the Hub's settings form. The last submitted values stay in this device's
// storage; the game's own settings.json decides whether they are still valid.
const keyPrefix = 'trainerhub.package-settings/v1:';
const maximumSavedBytes = 16384;

export function DeviceStorage() {
  try { return window.localStorage; } catch { return null; }
}

/** The definition with saved values as its defaults, or the original when nothing valid is saved. */
export function ApplySavedPackageSettings(storage: Pick<Storage, 'getItem'> | null, definition: GameSettingsDefinition): GameSettingsDefinition {
  try {
    const text = storage?.getItem(keyPrefix + definition.gameId);
    if (typeof text !== 'string' || text.length > maximumSavedBytes) return definition;
    const values = NormalizeGameSettingsValues(definition, JSON.parse(text));
    return ParseGameSettingsDefinition({
      ...definition,
      sections: definition.sections.map(section => ({
        ...section,
        fields: section.fields.map(field => ({ ...field, default: values[field.key] })),
      })),
    }, definition.gameId);
  } catch { return definition; }
}

export function SavePackageSettings(storage: Pick<Storage, 'setItem'> | null, gameId: string, values: GameSettingsValues) {
  try { storage?.setItem(keyPrefix + gameId, JSON.stringify(values)); } catch { /* Blocked or full storage keeps the defaults. */ }
}
