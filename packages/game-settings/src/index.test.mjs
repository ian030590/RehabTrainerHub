import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GetGameSettingsDefaults,
  IsGameSettingsDefinition,
  NormalizeGameSettingsValues,
  ParseGameSettingsDefinition,
} from './index.js';

const definition = {
  schemaVersion: 1,
  gameId: 'sample-game',
  sections: [{
    id: 'training',
    title: { 'zh-TW': '活動設定', en: 'Session settings' },
    fields: [
      {
        key: 'rounds',
        type: 'slider',
        label: { 'zh-TW': '回合數', en: 'Rounds' },
        default: 10,
        min: 5,
        max: 20,
        step: 5,
      },
      {
        key: 'mode',
        type: 'list',
        label: { 'zh-TW': '模式', en: 'Mode' },
        default: 'practice',
        options: [
          { value: 'practice', label: { 'zh-TW': '練習', en: 'Practice' } },
          { value: 'formal', label: { 'zh-TW': '正式', en: 'Formal' } },
        ],
      },
      {
        key: 'soundEnabled',
        type: 'checkbox',
        label: { 'zh-TW': '聲音', en: 'Sound' },
        default: true,
      },
      {
        key: 'targetColor',
        type: 'color',
        label: { 'zh-TW': '目標顏色', en: 'Target color' },
        default: '#76d900',
      },
    ],
  }],
};

test('validates settings.json and creates complete defaults', () => {
  assert.equal(IsGameSettingsDefinition(definition, 'sample-game'), true);
  assert.equal(ParseGameSettingsDefinition(definition, 'sample-game'), definition);
  assert.deepEqual(GetGameSettingsDefaults(definition), {
    rounds: 10,
    mode: 'practice',
    soundEnabled: true,
    targetColor: '#76d900',
  });
});

test('normalizes selected values and rejects unknown or out-of-range values', () => {
  assert.deepEqual(NormalizeGameSettingsValues(definition, {
    rounds: 20,
    mode: 'formal',
    soundEnabled: false,
    targetColor: '#ffcc00',
  }), {
    rounds: 20,
    mode: 'formal',
    soundEnabled: false,
    targetColor: '#ffcc00',
  });
  assert.throws(() => NormalizeGameSettingsValues(definition, { rounds: 7 }));
  assert.throws(() => NormalizeGameSettingsValues(definition, { targetColor: 'red' }));
  assert.throws(() => NormalizeGameSettingsValues(definition, { unexpected: true }));
});

test('rejects mismatched game IDs and free-text field types', () => {
  assert.equal(IsGameSettingsDefinition(definition, 'another-game'), false);
  assert.equal(IsGameSettingsDefinition({
    ...definition,
    sections: [{
      ...definition.sections[0],
      fields: [{ key: 'notes', type: 'text', label: { 'zh-TW': '備註', en: 'Notes' }, default: '' }],
    }],
  }), false);
  assert.equal(IsGameSettingsDefinition({
    ...definition,
    sections: [{
      ...definition.sections[0],
      fields: [{ ...definition.sections[0].fields[0], key: 'authToken' }],
    }],
  }), false);
});
