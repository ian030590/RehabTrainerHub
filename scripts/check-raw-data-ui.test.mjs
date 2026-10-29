import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Hub records reviewed outgoing frames and uploads each kind before saving the result with retry state', () => {
  const source = read('apps/rehabtrainerhub/app/train/R2GameOverlay.tsx');
  assert.match(source, /CreateRawCoordinateRecorder/);
  assert.match(source, /rawRecorder\.current\?\.Record\('hand', message\)/);
  assert.match(source, /rawRecorder\.current\?\.Record\(input, message\)/);
  assert.ok(source.indexOf('await SaveRawCoordinateCsv(') < source.indexOf('await SaveRemoteTrainingRecord('));
  assert.match(source, /rawSaved\.current\.has\(file.kind\)/);
  assert.match(source, /rawSaved\.current\.add\(file.kind\)/);
  assert.match(source, /sessionRef.current !== selected \|\| portRef.current !== port/);
  assert.match(source, /rawRecorder.current\?\.Reset\(\)/);
  assert.match(source, /rawSaved.current.clear\(\)/);
  assert.match(source, /SensorAllowed\(state, input\)/);
  for (const text of ['匿名識別碼', 'pseudonymous subject ID']) assert.ok(source.includes(text));
});

test('privacy explains summary storage, private CSV archive and camera data in both languages', () => {
  const page = read('apps/rehabtrainerhub/app/privacy/PrivacyContent.tsx');
  assert.match(page, /copy\.rawStorageBody/);
  for (const language of ['en', 'zh-TW']) {
    const source = read(`apps/rehabtrainerhub/app/i18n/${language}.ts`);
    assert.match(source, /rawStorageBody:.*D1.*CSV.*pCloud/);
  }
});

test('a gaze download 404 removes its control and explains archival without losing the summary', () => {
  const source = read('apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx');
  assert.match(source, /response.status === 404/);
  assert.match(source, /setGazeFiles\(.*filter/);
  assert.match(source, /site archive/);
  assert.match(source, /摘要仍保留/);
});
