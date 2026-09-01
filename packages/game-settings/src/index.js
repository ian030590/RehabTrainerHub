export const gameSettingsSchemaVersion = 1;
export const gameSettingsMaximumFields = 64;
export const gameSettingsMaximumJsonBytes = 64 * 1024;

const identifierPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const fieldKeyPattern = /^[a-z][A-Za-z0-9_.-]{0,63}$/;
const sensitiveFieldKeyPattern = /(auth|authorization|birthday|cookie|credential|dob|email|jwt|name|participant|password|phone|secret|session|token|user)/i;
const fieldTypes = new Set(['checkbox', 'list', 'slider']);

export function IsGameSettingsDefinition(value, expectedGameId) {
  try {
    ParseGameSettingsDefinition(value, expectedGameId);
    return true;
  } catch {
    return false;
  }
}

export function ParseGameSettingsDefinition(value, expectedGameId) {
  if (!IsExactObject(value, ['schemaVersion', 'gameId', 'sections'])) {
    throw new TypeError('settings.json must contain schemaVersion, gameId, and sections.');
  }
  if (value.schemaVersion !== gameSettingsSchemaVersion) {
    throw new TypeError('Unsupported settings.json schemaVersion.');
  }
  if (!IsIdentifier(value.gameId) || (expectedGameId && value.gameId !== expectedGameId)) {
    throw new TypeError('settings.json gameId is invalid.');
  }
  if (!Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 16) {
    throw new TypeError('settings.json must contain between 1 and 16 sections.');
  }
  const sectionIds = new Set();
  const fieldKeys = new Set();
  let fieldCount = 0;
  value.sections.forEach((section, sectionIndex) => {
    if (!IsExactObject(section, ['id', 'title', 'fields'], ['description'])
      || !IsIdentifier(section.id)
      || sectionIds.has(section.id)
      || !IsLocalizedText(section.title)
      || ('description' in section && !IsLocalizedText(section.description))
      || !Array.isArray(section.fields)
      || section.fields.length < 1
      || section.fields.length > 32) {
      throw new TypeError(`settings.json sections[${sectionIndex}] is invalid.`);
    }
    sectionIds.add(section.id);
    section.fields.forEach((field, fieldIndex) => {
      ValidateField(field, `${sectionIndex}].fields[${fieldIndex}`);
      if (fieldKeys.has(field.key)) throw new TypeError(`Duplicate settings key: ${field.key}`);
      fieldKeys.add(field.key);
      fieldCount += 1;
    });
  });
  if (fieldCount > gameSettingsMaximumFields) {
    throw new TypeError(`settings.json cannot exceed ${gameSettingsMaximumFields} fields.`);
  }
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > gameSettingsMaximumJsonBytes) {
    throw new TypeError(`settings.json cannot exceed ${gameSettingsMaximumJsonBytes} UTF-8 bytes.`);
  }
  return value;
}

export function GetGameSettingsDefaults(definition) {
  ParseGameSettingsDefinition(definition, definition?.gameId);
  return Object.fromEntries(definition.sections.flatMap((section) => (
    section.fields.map((field) => [field.key, field.default])
  )));
}

export function NormalizeGameSettingsValues(definition, value) {
  ParseGameSettingsDefinition(definition, definition?.gameId);
  if (!IsPlainObject(value)) throw new TypeError('Game settings values must be a plain object.');
  const fields = definition.sections.flatMap((section) => section.fields);
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  if (Reflect.ownKeys(value).some((key) => (
    typeof key !== 'string'
    || !Object.prototype.propertyIsEnumerable.call(value, key)
    || !fieldByKey.has(key)
  ))) {
    throw new TypeError('Game settings values contain an unknown key.');
  }
  return Object.fromEntries(fields.map((field) => {
    const selected = Object.prototype.hasOwnProperty.call(value, field.key)
      ? value[field.key]
      : field.default;
    if (field.type === 'checkbox' && typeof selected !== 'boolean') {
      throw new TypeError(`${field.key} must be a boolean.`);
    }
    if (field.type === 'slider'
      && (!Number.isFinite(selected)
        || selected < field.min
        || selected > field.max
        || !IsStepAligned(selected, field.min, field.step))) {
      throw new TypeError(`${field.key} is outside its slider range.`);
    }
    if (field.type === 'list'
      && !field.options.some((option) => Object.is(option.value, selected))) {
      throw new TypeError(`${field.key} is not an allowed list value.`);
    }
    return [field.key, selected];
  }));
}

export function ResolveGameSettingsText(value, locale) {
  if (!IsLocalizedText(value)) throw new TypeError('Invalid localized settings text.');
  return locale === 'en' ? value.en : value['zh-TW'];
}

function ValidateField(field, label) {
  if (!IsPlainObject(field)
    || !fieldTypes.has(field.type)
    || !fieldKeyPattern.test(field.key)
    || sensitiveFieldKeyPattern.test(field.key)
    || !IsLocalizedText(field.label)
    || ('description' in field && !IsLocalizedText(field.description))) {
    throw new TypeError(`settings.json fields[${label}] is invalid (${String(field?.key || 'unknown')}:${String(field?.type || 'unknown')}).`);
  }
  if (field.type === 'checkbox') {
    if (!IsExactObject(field, ['key', 'type', 'label', 'default'], ['description'])
      || typeof field.default !== 'boolean') {
      throw new TypeError(`${field.key || label} is not a valid checkbox.`);
    }
    return;
  }
  if (field.type === 'slider') {
    if (!IsExactObject(
      field,
      ['key', 'type', 'label', 'default', 'min', 'max', 'step'],
      ['description', 'unit'],
    )
      || ![field.default, field.min, field.max, field.step].every(Number.isFinite)
      || field.min >= field.max
      || field.step <= 0
      || field.default < field.min
      || field.default > field.max
      || !IsStepAligned(field.default, field.min, field.step)
      || ('unit' in field && !IsLocalizedText(field.unit))) {
      throw new TypeError(`${field.key || label} is not a valid slider.`);
    }
    return;
  }
  if (!IsExactObject(field, ['key', 'type', 'label', 'default', 'options'], ['description'])
    || !Array.isArray(field.options)
    || field.options.length < 2
    || field.options.length > 24) {
    throw new TypeError(`${field.key || label} is not a valid list.`);
  }
  const optionValues = new Set();
  field.options.forEach((option) => {
    if (!IsExactObject(option, ['value', 'label'], ['description'])
      || !IsOptionValue(option.value)
      || optionValues.has(`${typeof option.value}:${String(option.value)}`)
      || !IsLocalizedText(option.label)
      || ('description' in option && !IsLocalizedText(option.description))) {
      throw new TypeError(`${field.key || label} contains an invalid list option.`);
    }
    optionValues.add(`${typeof option.value}:${String(option.value)}`);
  });
  if (!field.options.some((option) => Object.is(option.value, field.default))) {
    throw new TypeError(`${field.key || label} default is not in its options.`);
  }
}

function IsStepAligned(value, minimum, step) {
  const quotient = (value - minimum) / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-8;
}

function IsIdentifier(value) {
  return typeof value === 'string' && value.length <= 64 && identifierPattern.test(value);
}

function IsOptionValue(value) {
  return (typeof value === 'string' && value.length > 0 && value.length <= 80)
    || (Number.isFinite(value) && Math.abs(value) <= 1_000_000_000);
}

function IsLocalizedText(value) {
  return IsExactObject(value, ['zh-TW', 'en'])
    && IsBoundedText(value['zh-TW'])
    && IsBoundedText(value.en);
}

function IsBoundedText(value) {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && value.length <= 300
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function IsExactObject(value, requiredKeys, optionalKeys = []) {
  if (!IsPlainObject(value)) return false;
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Reflect.ownKeys(value);
  return keys.every((key) => typeof key === 'string'
    && Object.prototype.propertyIsEnumerable.call(value, key)
    && allowedKeys.has(key))
    && requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function IsPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
