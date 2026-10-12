import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build } from 'vite';
import midiPackage from '@tonejs/midi';
import { HandleRequest } from '../apps/usergamerunner/functions/[[path]].js';
import { CheckAsteroidEffects } from './asteroid-effects-audio-browser.mjs';

const root = resolve(import.meta.dirname, '..');
const effectsOnly = process.argv.includes('--effects-only');
const gameIds = effectsOnly ? ['asteroid-shield'] : Object.keys(JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8')));
const browserPath = process.env.BRAVE_BIN || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
assert.ok(existsSync(browserPath), 'Brave or BRAVE_BIN is required.');
const { Midi } = midiPackage;
const midi = new Midi();
midi.header.setTempo(120);
const melody = midi.addTrack();
melody.addNote({ midi: 60, time: 0, duration: .8, velocity: .7 });
melody.addNote({ midi: 64, time: 0, duration: .8, velocity: .5 });
const drums = midi.addTrack();
drums.channel = 9;
drums.addNote({ midi: 36, time: .2, duration: .1, velocity: .6 });
const packages = new Map();
for (const gameId of gameIds) {
  const gameRoot = resolve(root, `apps/rehabtrainerhub/games/${gameId}`);
  const { version } = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  const composition = gameId === 'asteroid-shield'
    ? `import { backgroundMusic as score, backgroundMusicOptions as options } from ${JSON.stringify(resolve(gameRoot, 'music.ts').replaceAll('\\', '/'))};`
    : `const score = ${JSON.stringify(midi.toJSON())}; const options = {waveforms:['square','white-noise'],loop:true,loopEnd:1};`;
  const source = `import * as audio from ${JSON.stringify(resolve(gameRoot, 'runtime/soundManager.ts').replaceAll('\\', '/'))};
import { getContext } from 'tone/build/esm/core/Global.js';
import { PolySynth, Synth } from 'tone/build/esm/classes.js';
import { AUDIO_NODE_STORE, CONTEXT_STORE } from 'standardized-audio-context/build/es2019/globals.js';
${composition}
window.audioUnderTest = audio; window.testScore = score; window.testOptions = options;
window.captureEffect = async kind => {
  audio.DisposeAudioFeedback(); audio.SetSoundEnabled(true); audio.PrepareAudioFeedback();
  const context = getContext(); await context.resume();
  // Tone wraps the native context; record its final native output without changing the package audio path.
  const raw = CONTEXT_STORE.get(context.rawContext);
  let output = context.destination.output;
  while (output.output) output = output.output;
  const finalOutput = AUDIO_NODE_STORE.get(output);
  const highpass = raw.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 500;
  const lowpass = raw.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 3000;
  const merger = raw.createChannelMerger(2);
  const recorder = raw.createScriptProcessor(1024,2,2);
  const silent = raw.createGain(); silent.gain.value = 0;
  finalOutput.connect(merger,0,0);
  finalOutput.connect(highpass); highpass.connect(lowpass); lowpass.connect(merger,0,1);
  merger.connect(recorder); recorder.connect(silent); silent.connect(raw.destination);
  const samples = [], band = [];
  recorder.onaudioprocess = event => {
    samples.push(...event.inputBuffer.getChannelData(0));
    band.push(...event.inputBuffer.getChannelData(1));
  };
  let baseline;
  if (kind === 'baseline') {
    baseline = new PolySynth({context,voice:Synth,volume:-21,
      options:{oscillator:{type:'sine'},envelope:{attack:.015,decay:.02,sustain:.8,release:.02}}}).connect(context.destination);
    const start = context.now()+.01;
    baseline.triggerAttackRelease(246.94,.11,start,1);
    baseline.triggerAttackRelease(185,.16,start+.1,1);
  } else if (kind === 'fall') audio.PlayAsteroidFallSound();
  else if (kind === 'success') audio.PlaySuccessSound();
  else if (kind === 'victory') audio.PlayGameEndSound('Victory');
  else if (kind === 'damage') audio.PlayFailureSound();
  else if (kind === 'defeat') audio.PlayGameEndSound('Defeat');
  else if (kind === 'mix') {
    await audio.PlayMidiMusic(score,options);
    audio.PlayAsteroidFallSound();
    for (let index=0;index<20;index++) audio.PlayFailureSound();
    for (let index=0;index<20;index++) audio.PlaySuccessSound();
  }
  await new Promise(resolve => setTimeout(resolve,950));
  recorder.onaudioprocess = null;
  finalOutput.disconnect(merger); finalOutput.disconnect(highpass);
  highpass.disconnect(); lowpass.disconnect(); merger.disconnect(); recorder.disconnect(); silent.disconnect();
  baseline?.dispose(); audio.DisposeAudioFeedback();
  const rms = values => Math.sqrt(values.reduce((sum,value)=>sum+value*value,0)/values.length);
  const loudestRms = values => {
    const length = Math.round(context.sampleRate*.1); let sum = 0, maximum = 0;
    for (let index=0;index<values.length;index++) {
      sum += values[index]*values[index];
      if (index>=length) sum -= values[index-length]*values[index-length];
      if (index>=length-1) maximum = Math.max(maximum,sum/length);
    }
    return Math.sqrt(maximum);
  };
  return {samples,sampleRate:context.sampleRate,peak:samples.reduce((peak,value)=>Math.max(peak,Math.abs(value)),0),
    rms:rms(samples),speakerBandRms:rms(band),loudestRms:loudestRms(samples),speakerBandLoudestRms:loudestRms(band),
    compressorNodes:window.compressorNodes};
};
document.getElementById('play').onclick = async () => {
  audio.PrepareAudioFeedback();
  window.started = await audio.PlayMidiMusic(score, options);
  window.analyser = getContext().createAnalyser();
  getContext().destination.connect(window.analyser);
};`;
  const built = await build({ configFile: false, root, logLevel: 'error', plugins: [{ name: 'audio-fixture',
    resolveId: id => id === 'virtual:audio-fixture' ? '\0audio-fixture' : null,
    load: id => id === '\0audio-fixture' ? source : null }],
    build: { write: false, minify: true, rollupOptions: { input: 'virtual:audio-fixture', output: { format: 'iife', inlineDynamicImports: true } } } });
  const files = new Map([
    ['index.html', Buffer.from('<!doctype html><button id="play">Play</button><script defer src="./audio.js"></script>')],
    ['audio.js', Buffer.from(built.output.find(file => file.type === 'chunk').code)],
  ]);
  const manifest = { schemaVersion: 1, status: 'approved', gameId, version, name: gameId, runtime: { name: 'native', major: 1 },
    presentation: 'game', capabilities: ['audio'], entry: 'index.html',
    files: [...files].map(([path, bytes]) => ({ path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })) };
  packages.set(gameId, { version, files, manifest });
}
const bucket = { get: async key => {
  const pkg = packages.get(key.split('/')[1]);
  const bytes = key.endsWith('/release.json') ? Buffer.from(JSON.stringify(pkg?.manifest)) : pkg?.files.get(key.split('/files/')[1]);
  if (!bytes) return null;
  return { size: bytes.length, body: bytes, text: async () => bytes.toString(),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
} };
let origin;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (!url.pathname.startsWith('/games/')) {
      const gameId = url.searchParams.get('game') || gameIds[0];
      response.writeHead(200, { 'Content-Type': 'text/html' }).end(`<iframe sandbox="allow-scripts" src="/games/${gameId}/${packages.get(gameId).version}/package/index.html"></iframe>`);
      return;
    }
    const result = await HandleRequest({ request: new Request(url), env: { GAME_RELEASE_BUCKET: bucket } });
    response.writeHead(result.status, Object.fromEntries(result.headers)).end(Buffer.from(await result.arrayBuffer()));
  } catch (error) { response.writeHead(500).end(String(error)); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
origin = `http://127.0.0.1:${server.address().port}`;
for (const [gameId, pkg] of packages) {
  const response = await fetch(`${origin}/games/${gameId}/${pkg.version}/package/index.html`);
  assert.equal(response.status, 200, `${gameId}: ${await response.text()}`);
}
const debugProbe = createServer();
await new Promise(resolveListen => debugProbe.listen(0, '127.0.0.1', resolveListen));
const debugPort = debugProbe.address().port;
await new Promise(resolveClose => debugProbe.close(resolveClose));
const profile = resolve(root, '.tmp', `audio-browser-${process.pid}`);
await mkdir(profile, { recursive: true });
const browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
  '--disable-background-timer-throttling', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws;
try {
  const debuggerInfo = await Until(async () => { try { return await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(); } catch { return null; } });
  ws = new WebSocket(debuggerInfo.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const contexts = new Map();
  const errors = [];
  const probe = `(() => {if(window.audioProbeInstalled)return;window.audioProbeInstalled=true;window.audioContexts=[]; window.compressorNodes=0; window.workerAttempts=0; window.oscillators=0; window.cspErrors=[];
const NativeAudioContext=window.AudioContext;
window.AudioContext=new Proxy(NativeAudioContext,{construct(target,args){const context=new target(...args);window.audioContexts.push(context);return context;}});
const compressor=NativeAudioContext.prototype.createDynamicsCompressor;
NativeAudioContext.prototype.createDynamicsCompressor=function(...args){window.compressorNodes++;return compressor.apply(this,args);};
const create=NativeAudioContext.prototype.createOscillator;
NativeAudioContext.prototype.createOscillator=function(...args){window.oscillators++;return create.apply(this,args);};
window.Worker=function(){window.workerAttempts++;throw new Error('Worker prohibited');};
addEventListener('securitypolicyviolation',event=>window.cspErrors.push(event.violatedDirective));})();`;
  let send;
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const entry = pending.get(message.id); clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(message.error) : entry.resolve(message.result); }
    if (message.method === 'Runtime.executionContextCreated') contexts.set(`${message.sessionId}:${message.params.context.id}`, { ...message.params.context, sessionId: message.sessionId });
    if (message.method === 'Runtime.executionContextDestroyed') contexts.delete(`${message.sessionId}:${message.params.executionContextId}`);
    if (message.method === 'Runtime.executionContextsCleared') {
      for (const [key, context] of contexts) if (context.sessionId === message.sessionId) contexts.delete(key);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Target.attachedToTarget') void (async () => {
      const child = message.params.sessionId;
      await send('Runtime.enable', {}, child); await send('Page.enable', {}, child);
      await send('Page.addScriptToEvaluateOnNewDocument', { source: probe }, child);
      await send('Runtime.runIfWaitingForDebugger', {}, child);
    })().catch(error => errors.push(String(error)));
  });
  send = (method, params = {}, sessionId) => new Promise((resolveCommand, reject) => {
    const commandId = ++id;
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 20000);
    pending.set(commandId, { resolve: resolveCommand, reject, timer });
    ws.send(JSON.stringify({ id: commandId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: probe }, sessionId);
  const evaluate = async (expression, context) => {
    const result = await send('Runtime.evaluate', { expression, contextId: context.id, returnByValue: true, awaitPromise: true, userGesture: true }, context.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  for (const gameId of gameIds) {
    await send('Page.navigate', { url: origin + '/?game=' + gameId }, sessionId);
    const contextId = await Until(async () => {
      for (const context of contexts.values()) { try { if (await evaluate('Boolean(window.audioUnderTest)', context)) return context; } catch {} }
      return null;
    }).catch(error => { console.error('Browser errors:', JSON.stringify(errors)); throw error; });
    assert.equal(await evaluate('audioContexts.length', contextId), 0, `${gameId}: lazy audio while in settings`);
    await evaluate('document.getElementById("play").click()', contextId);
    await Until(() => evaluate('Boolean(window.started && window.analyser)', contextId));
    await Until(() => evaluate(`(() => {const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length)>.001;})()`, contextId));
    if (gameId === 'asteroid-shield') {
      assert.deepEqual(await evaluate('[testScore.tracks.map(track=>track.notes.length),testOptions]', contextId),
        [[167,480,246,156], {loop:true,loopEnd:48,waveforms:['square','square','white-noise','triangle']}]);
      assert.deepEqual(await evaluate('[testScore.tracks[3].notes[0].midi,testScore.tracks[3].notes.at(-1).midi]', contextId), [57,61]);
      if (!effectsOnly) await new Promise(resolveWait => setTimeout(resolveWait, 48200));
    }
    const first = await evaluate('oscillators', contextId);
    await new Promise(resolveWait => setTimeout(resolveWait, 1200));
    assert.ok(await evaluate('oscillators', contextId) > first, `${gameId}: loop schedules another chord`);
    await evaluate('audioUnderTest.PlaySuccessSound();audioUnderTest.SetSoundEnabled(false)', contextId);
    await Until(() => evaluate('audioContexts.every(context=>context.state==="closed")', contextId));
    const count = await evaluate('oscillators', contextId);
    await evaluate('audioUnderTest.PlaySuccessSound();audioUnderTest.PlayMidiMusic(testScore)', contextId);
    assert.equal(await evaluate('oscillators', contextId), count, `${gameId}: mute suppresses new notes`);
    await evaluate('audioUnderTest.SetSoundEnabled(true);audioUnderTest.PlayMidiMusic(testScore,{waveforms:["sawtooth","triangle"]})', contextId);
    await evaluate('audioUnderTest.DisposeAudioFeedback()', contextId);
    await Until(() => evaluate('audioContexts.every(context=>context.state==="closed")', contextId));
    assert.deepEqual(await evaluate('[workerAttempts,cspErrors]', contextId), [0, []], `${gameId}: strict CSP without Workers`);
    console.log(`${gameId}: opaque sandbox, real Tone synthesis, chord/noise, loop, mute and cleanup passed.`);
    if (gameId === 'asteroid-shield') await CheckAsteroidEffects({ evaluate, contextId, root });
  }
  assert.deepEqual(errors.map(error => error.exception?.description || error.text || String(error)), []);
} finally {
  ws?.close(); browser.kill(); await new Promise(resolveClose => server.close(resolveClose));
}

async function Until(check) {
  for (let attempt = 0; attempt < 150; attempt++) { const result = await check(); if (result) return result; await new Promise(resolveWait => setTimeout(resolveWait, 100)); }
  throw new Error('Browser condition timed out.');
}
