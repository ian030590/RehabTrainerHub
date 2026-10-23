import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { AcceptGameMessage } from '../../../packages/ui/src/selfContainedGame.js';
import { IsUfovResultFile, ResultFileMimeType, StageResultFile, ufovTrialColumns } from '../../../packages/ui/src/resultFiles.js';
import { ValidateRelease } from '../functions/_lib/release.js';
import { RenderLauncher, UsesOfficialLauncher } from '../functions/_lib/render.js';

const stamp = '20261023-091500';
const trialRow = ['1', '0', '2', '50.01', '50.01', '3', '0', '59.98', '1', '100', '2.5', '15', 'car', 'car', '1', '4', '4', '1', '1', '812', '9'];
const trialsCsv = [ufovTrialColumns.join(','), trialRow.join(','), [...trialRow.slice(0, 13), 'truck', '0', '', '', '', '0', '1400', '0'].join(',')].join('\r\n');
const summaryCsv = ['metric,value,unit', 'activity,2,', 'threshold_ms,83.35,ms', 'stop_condition,adaptive_80,', 'formal_correct,30,count'].join('\r\n');
const trajectory = { schema: 'rehab-trainer.ufov-trajectory/v1', activity: 2, trials: [
  { ...Object.fromEntries(ufovTrialColumns.map((key, index) => [key, /^\d/.test(trialRow[index]) ? Number(trialRow[index]) : trialRow[index]])), trajectory: [[0, 640, 360], [16, 642, 361]] },
] };
const files = {
  trials: { fileName: `ufov-${stamp}-trials.csv`, text: trialsCsv },
  summary: { fileName: `ufov-${stamp}-summary.csv`, text: summaryCsv },
  trajectory: { fileName: `ufov-${stamp}-trajectory.json`, text: JSON.stringify(trajectory) },
};
const state = (extra = {}) => ({ gameId: 'ufov', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false,
  capabilities: ['result-files'], ...extra });
const message = (type, payload, current) => ({ schema: 'trainerhub.game/v1', gameId: current.gameId, version: current.version,
  sessionNonce: current.sessionNonce, sequence: current.sequence + 1, type, payload });

test('UFOV result files validate their exact name, columns and cell values', () => {
  for (const file of Object.values(files)) assert.equal(IsUfovResultFile(file), true, file.fileName);
  const rejected = [
    { ...files.trials, fileName: `../ufov-${stamp}-trials.csv` },
    { ...files.trials, fileName: `ufov-${stamp}-trials.html` },
    { ...files.trials, fileName: `ufov-${stamp}-trials.CSV` },
    { ...files.trials, text: files.trials.text.replace('car,car', '=1+1,car') },
    { ...files.trials, text: files.trials.text.replace('car,car', '"car",car') },
    { ...files.trials, text: files.trials.text.replace(',812,', ',812,1,') },
    { ...files.trials, text: `subject_id,${files.trials.text}` },
    { ...files.trials, text: [ufovTrialColumns.join(','), ...Array(301).fill(trialRow.join(','))].join('\r\n') },
    { ...files.summary, text: `${summaryCsv}\r\nnote,@SUM(A1),` },
    { ...files.summary, text: `${summaryCsv}\r\nsubject_name,Ann,` },
    { ...files.trajectory, text: '{' },
    { ...files.trajectory, text: JSON.stringify({ ...trajectory, subjectId: 'private' }) },
    { ...files.trajectory, text: JSON.stringify({ ...trajectory, trials: [{ ...trajectory.trials[0], note: 'x' }] }) },
    { ...files.trajectory, text: JSON.stringify({ ...trajectory, trials: [{ ...trajectory.trials[0], trajectory: [[0, 'x', 1]] }] }) },
    { ...files.trajectory, text: JSON.stringify({ ...trajectory, trials: [{ ...trajectory.trials[0], trajectory: Array(5001).fill([0, 1, 1]) }] }) },
    { ...files.trajectory, text: 'x'.repeat(4 * 1024 * 1024 + 1) },
    { ...files.trials, extra: true },
    { fileName: files.trials.fileName },
  ];
  for (const file of rejected) assert.equal(IsUfovResultFile(file), false, JSON.stringify(file).slice(0, 120));
  assert.equal(ResultFileMimeType(files.trials.fileName), 'text/csv;charset=utf-8');
  assert.equal(ResultFileMimeType(files.trajectory.fileName), 'application/json;charset=utf-8');
});

test('only the official UFOV game with result-files can stage files before its result and request downloads after it', () => {
  const current = state();
  for (const file of Object.values(files)) assert.equal(AcceptGameMessage(message('result-file', file, current), current), true, file.fileName);
  for (const patch of [{ gameId: 'reaction-time' }, { capabilities: [] }, { capabilities: ['eye-tracking'] }, { complete: true }]) {
    const other = state(patch);
    assert.equal(AcceptGameMessage(message('result-file', files.trials, other), other), false, JSON.stringify(patch));
  }
  const bad = state();
  assert.equal(AcceptGameMessage(message('result-file', { ...files.trials, fileName: 'payload.exe' }, bad), bad), false);
  const done = state({ complete: true });
  assert.equal(AcceptGameMessage(message('result-file-download', { fileName: files.summary.fileName }, done), done), true);
  for (const payload of [{}, { fileName: 'notes.txt' }, { fileName: files.summary.fileName, text: 'x' }]) {
    const other = state({ complete: true });
    assert.equal(AcceptGameMessage(message('result-file-download', payload, other), other), false, JSON.stringify(payload));
  }
  const otherGame = state({ gameId: 'oculomotor-training', capabilities: ['eye-tracking', 'result-files'], complete: true });
  assert.equal(AcceptGameMessage(message('result-file-download', { fileName: files.summary.fileName }, otherGame), otherGame), false);
});

test('releases may declare result-files only for the official UFOV game, which then gets the official launcher', () => {
  const bytes = Buffer.from('<!doctype html><title>UFOV</title>');
  const entries = [{ path: 'index.html', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  const release = { schemaVersion: 1, status: 'approved', gameId: 'ufov', version: '2.0.0', name: 'UFOV', entry: 'index.html',
    runtime: { name: 'native', major: 1 }, presentation: 'game', capabilities: ['pointer', 'result-files'], files: entries,
    contentSha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex') };
  assert.doesNotThrow(() => ValidateRelease(release, 'ufov', '2.0.0'));
  assert.throws(() => ValidateRelease({ ...release, gameId: 'third-party' }, 'third-party', '2.0.0'), /restricted/);
  assert.equal(UsesOfficialLauncher(release), true);
  const { body } = RenderLauncher(release, '/games/ufov/2.0.0/', 'https://runner.example');
  assert.match(body, /const IsUfovResultFile = /);
  assert.match(body, /result-file-download/);
  assert.match(body, /application\/json;charset=utf-8/);
  assert.doesNotMatch(body, /\/input\/(?:eye|hand)-tracking/);
  assert.match(body, /sandbox="allow-scripts"/);
  assert.doesNotMatch(body, /allow-same-origin|allow-downloads|allow-top-navigation/);
});

test('containers keep at most the three latest UFOV files, and the Hub overlay downloads only staged ones', async () => {
  const staged = new Map();
  for (const file of Object.values(files)) StageResultFile(staged, file);
  StageResultFile(staged, { fileName: `ufov-20261023-091501-trials.csv`, text: trialsCsv });
  StageResultFile(staged, { ...files.summary, text: 'newer' });
  assert.deepEqual([...staged.keys()], Object.values(files).map(file => file.fileName));
  assert.equal(staged.get(files.summary.fileName), 'newer', 'A resend of the same file replaces the earlier text.');
  const overlay = await readFile(resolve(import.meta.dirname, '../../rehabtrainerhub/app/train/R2GameOverlay.tsx'), 'utf8');
  assert.match(overlay, /import \{[^}]*DownloadResultFile[^}]*StageResultFile[^}]*\} from '@rehab-trainer\/ui\/resultFiles\.js'/);
  assert.match(overlay, /message\.type === 'result-file'\) StageResultFile\(resultFilesRef\.current, message\.payload\)/);
  assert.match(overlay, /message\.type === 'result-file-download'[^\n]*resultFilesRef\.current\.has\(message\.payload\.fileName\)\)\s*DownloadResultFile\(message\.payload\.fileName, resultFilesRef\.current\.get\(message\.payload\.fileName\)/);
  assert.match(overlay, /csvFileRef\.current = null; resultFilesRef\.current\.clear\(\);/, 'Reloading the game forgets the staged files; closing unmounts them.');
  assert.match(overlay, /sandbox="allow-scripts"/);
  assert.doesNotMatch(overlay, /allow-downloads|allow-same-origin/);
});

test('the production-bundled standalone launcher downloads only staged files, after the result, and forgets them on exit', async () => {
  const output = await build({ entryPoints: [resolve(import.meta.dirname, '../functions/_lib/handTrackingLauncher.js')],
    bundle: true, keepNames: true, format: 'esm', platform: 'neutral', write: false });
  const { RenderHandTrackingLauncher } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  const html = RenderHandTrackingLauncher({ gameId: 'ufov', version: '2.0.0', capabilities: ['pointer', 'result-files', 'settings-storage'] },
    '/games/ufov/2.0.0/', 'test-nonce');
  const inline = html.match(/<script nonce="test-nonce">([\s\S]*?)<\/script>/)[1];
  const events = new Map();
  const posted = [];
  const downloads = [];
  const blobs = new Map();
  const frame = { addEventListener: (type, listener) => events.set(type, listener),
    contentWindow: { postMessage: (data, _origin, ports) => posted.push({ data, port: ports[0] }) } };
  const elements = new Map([['game-frame', frame], ['camera-consent', {}], ['camera-enable', {}], ['camera-cancel', {}], ['install-button', {}], ['runner-error', {}]]);
  let ready;
  // Messages are rebuilt inside the launcher's realm, as a browser's structured clone would do.
  const channel = `class MessageChannel { constructor() {
    const pair = [{}, {}];
    pair.forEach((port, index) => Object.assign(port, { start() {}, close() {},
      postMessage: data => pair[1 - index].onmessage?.({ data: JSON.parse(JSON.stringify(data)) }) }));
    [this.port1, this.port2] = pair;
  } }
`;
  runInNewContext(channel + inline, {
    document: { addEventListener: (_type, listener) => { ready = listener; }, getElementById: id => elements.get(id), activeElement: null,
      createElement: () => ({ click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); } }) },
    URL: { createObjectURL: blob => { const url = `blob:${blobs.size}`; blobs.set(url, blob); return url; }, revokeObjectURL() {} },
    crypto, Uint8Array, URLSearchParams, Blob, TextEncoder, location: { search: '' }, setTimeout: () => 0,
    navigator: {}, window: { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} }, top: null },
    setInterval: () => 0, clearInterval() {},
  });
  ready();
  events.get('load')();
  const { data: init, port } = posted[0];
  const replies = [];
  port.onmessage = ({ data }) => replies.push(data);
  let sequence = 0;
  // Blob#text drops a leading byte order mark, so read the raw bytes.
  const bytes = async blob => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());
  const send = (type, payload) => port.postMessage({ schema: 'trainerhub.game/v1', gameId: 'ufov', version: '2.0.0',
    sessionNonce: init.sessionNonce, sequence: sequence++, type, payload });
  send('ready', {});
  send('result-file-download', { fileName: files.trials.fileName });
  assert.equal(downloads.length, 0, 'Nothing downloads before a file is staged.');
  for (const file of Object.values(files)) send('result-file', file);
  send('result-file', { fileName: files.trials.fileName, text: 'not,a,valid,file' });
  send('result', { config: { activity: 2 }, score: { schema: 'rehab-trainer.game-score/v1', gameId: 'ufov', summary: { trials: 1 }, rounds: [{ trial: 1 }] } });
  send('result-file', { ...files.summary, text: files.summary.text.replace('30', '31') });
  send('result-file-download', { fileName: files.trials.fileName });
  send('result-file-download', { fileName: files.trajectory.fileName });
  assert.deepEqual(downloads.map(item => [item.name, item.blob.type]),
    [[files.trials.fileName, 'text/csv;charset=utf-8'], [files.trajectory.fileName, 'application/json;charset=utf-8']]);
  assert.equal(await bytes(downloads[0].blob), '\uFEFF' + files.trials.text, 'The staged CSV downloads unchanged, after a byte order mark.');
  assert.equal(await downloads[1].blob.text(), files.trajectory.text);
  send('result-file-download', { fileName: files.summary.fileName });
  assert.equal(await bytes(downloads[2].blob), '\uFEFF' + files.summary.text, 'Invalid files and files sent after the result are ignored.');
  send('exit', {});
  assert.equal(replies.at(-1)?.type, 'configure');
  send('result-file-download', { fileName: files.trials.fileName });
  assert.equal(downloads.length, 3, 'Exit forgets the staged files.');
});

