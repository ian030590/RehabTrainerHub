import { AcceptGameMessage, AcceptGameSettingsMessage, CameraSensorAllowed, IsGameResult, IsGameSettings, IsPreviewRect, ReadSavedGameSettings, SensorAllowed, WriteSavedGameSettings } from '../../../../packages/ui/src/selfContainedGame.js';
import { DownloadResultFile, IsUfovResultFile, IsUfovResultFileName, ResultFileMimeType, StageResultFile, ufovTrialColumns } from '../../../../packages/ui/src/resultFiles.js';
import { EscapeHtml } from './render.js';

// Consent copy for each sensor proxy: what runs on the device and the only data the game receives.
const sensorConsent = {
  pose: ['啟用相機 / Enable camera', '影像只在此裝置由 MediaPipe 處理；遊戲只收到雙手與髖、膝的座標，不會上傳影像。\nMediaPipe runs on this device. Only hand, hip and knee coordinates reach the game; images are never uploaded.', '允許相機 / Enable camera'],
  microphone: ['啟用麥克風 / Enable microphone', '聲音只在此裝置分析；遊戲只收到音量與高低頻比例，不會錄音或上傳。\nSound is analyzed on this device. Only loudness and the balance of high and low sounds reach the game; nothing is recorded or uploaded.', '允許麥克風 / Enable microphone'],
  tongue: ['啟用相機 / Enable camera', '影像只在此裝置由 MediaPipe 與 TensorFlow 處理；遊戲只收到嘴部位置與舌頭方向，校正影像不會離開此裝置。\nMediaPipe and TensorFlow run on this device. Only the mouth position and tongue direction reach the game; calibration images never leave this device.', '允許相機 / Enable camera'],
  head: ['啟用相機 / Enable camera', '影像只在此裝置由 MediaPipe 處理；遊戲只收到頭部轉動角度，不會上傳影像。\nMediaPipe runs on this device. Only head turn angles reach the game; images are never uploaded.', '允許相機 / Enable camera'],
};

export function RenderHandTrackingLauncher(release, basePath, cspNonce) {
  // Official standalone launcher: camera input brokers when the game uses them, and the game's saved settings.
  const eyeTracking = release.capabilities.includes('eye-tracking');
  const camera = eyeTracking || release.capabilities.includes('hand-tracking');
  // Sensor proxies for the reviewed games; the release validator already tied each capability to its game.
  const sensors = [['pose', 'pose-tracking', 'pose-tracking-1.0.0', 'TrainerHubPoseTracking'],
    ['microphone', 'microphone-level', 'microphone-1.0.0', 'TrainerHubMicrophone'],
    ['tongue', 'tongue-tracking', 'tongue-tracking-1.0.0', 'TrainerHubTongueTracking'],
    ['head', 'head-tracking', 'head-tracking-1.0.0', 'TrainerHubHeadTracking']]
    .filter(([, capability]) => release.capabilities.includes(capability));
  const cameraSensor = sensors.some(([input]) => input !== 'microphone');
  const configuration = JSON.stringify({ gameId: release.gameId, version: release.version,
    capabilities: release.capabilities, basePath }).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="zh-TW"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <meta name="robots" content="noindex,nofollow,noarchive"><title>${EscapeHtml(release.name ?? release.gameId)}｜居家訓練網</title>
    <link rel="manifest" href="${basePath}manifest.webmanifest">
    <style nonce="${cspNonce}">
      :root { --surface: #fff; --text: #202428; --overlay: #14212b99; --primary: #005eb8; }
      * { box-sizing: border-box; } html,body,iframe { margin:0;width:100%;height:100%;border:0; }
      body { height:100dvh;overflow:hidden;background:var(--surface);font:700 18px/1.5 system-ui;color:var(--text); }
      #camera-consent { position:fixed;inset:0;background:var(--overlay);display:grid;place-items:center;padding:16px; }
      #camera-consent[hidden] { display:none; } #camera-consent section { max-width:30rem;padding:24px;background:var(--surface);border-radius:8px; }
      button { font:inherit;padding:12px;margin:4px;cursor:pointer; } button:focus-visible { outline:3px solid var(--primary); }
      #install-button { position:fixed;top:8px;right:8px; } #runner-error { position:fixed;inset:0;padding:24px;background:var(--surface); }
      #camera-consent p { white-space:pre-line; }
      #game-shell { position:fixed;inset:0;background:var(--surface); } #game-shell iframe { position:absolute;inset:0;background:transparent;color-scheme:light; }
      #input-preview { position:absolute;overflow:hidden; } #input-preview[hidden] { display:none; }
    </style>
    ${camera ? `<script nonce="${cspNonce}" src="/input/${eyeTracking ? 'eye-tracking-1.1.0' : 'hand-tracking-1.0.0'}/index.js"></script>` : ''}
    ${sensors.map(([, , directory]) => `<script nonce="${cspNonce}" src="/input/${directory}/index.js"></script>`).join('')}
    <script nonce="${cspNonce}">
    document.addEventListener('DOMContentLoaded', () => {
      const config = ${configuration};
      const frame = document.getElementById('game-frame');
      const consent = document.getElementById('camera-consent');
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2,'0')).join('');
      const state = { ...config, sessionNonce:nonce, sequence:-1, complete:false };
      const sensitiveKey = /(auth|email|jwt|name|password|token|user|participant|secret|cookie|credential|phone)/i;
      const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
      const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
      const metrics = value => plain(value) && Object.keys(value).length <= 12 && Object.entries(value).every(([key,item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) && !sensitiveKey.test(key) && (item === null || (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e12)));
      const IsGameSettings = ${IsGameSettings.toString()};
      const IsGameResult = ${IsGameResult.toString()};
      const AcceptGameSettingsMessage = ${AcceptGameSettingsMessage.toString()};
      const ReadSavedGameSettings = ${ReadSavedGameSettings.toString()};
      const WriteSavedGameSettings = ${WriteSavedGameSettings.toString()};
      const SensorAllowed = ${SensorAllowed.toString()};
      const CameraSensorAllowed = ${CameraSensorAllowed.toString()};
      const IsPreviewRect = ${IsPreviewRect.toString()};
${release.capabilities.includes('result-files') ? `      const ufovTrialColumns = ${JSON.stringify(ufovTrialColumns)};
      const IsUfovResultFileName = ${IsUfovResultFileName.toString()};
      const IsUfovResultFile = ${IsUfovResultFile.toString()};
      const ResultFileMimeType = ${ResultFileMimeType.toString()};
      const DownloadResultFile = ${DownloadResultFile.toString()};
      const StageResultFile = ${StageResultFile.toString()};
` : ''}      const accept = ${eyeTracking ? 'TrainerHubEyeTracking.AcceptGameMessage' : AcceptGameMessage.toString()};
      let storage = null;
      try { storage = window.localStorage; } catch { /* Blocked storage only means defaults next time. */ }
      let port = null; let initialized = false; let consentReply = null; let previousFocus = null;
      let csv = null; const resultFiles = new Map();
      const broker = ${camera ? `${eyeTracking ? 'TrainerHubEyeTracking' : 'TrainerHubHandTracking'}.CreateBroker({
        send: message => port?.postMessage({ ...message, sessionNonce:nonce }),
        requestConsent: () => new Promise(resolve => { consentReply = resolve; previousFocus = document.activeElement; consent.hidden=false; document.getElementById('camera-enable').focus(); }),
        cancelConsent: () => { consent.hidden=true; consentReply?.(false); consentReply=null; previousFocus?.focus(); },
      })` : '{ Start() {}, Stop() {}, Calibrate() {}, Reset() {} }'};
      // Sensor proxies share one input sequence on the game's port; the camera image stays in #input-preview.
      let inputSequence = 0;
      const sendInput = message => port?.postMessage({ schema:'trainerhub.input/v1', sessionNonce:nonce, sequence:inputSequence++, ...message });
      const consentCopy = ${JSON.stringify(Object.fromEntries(sensors.map(([input]) => [input, sensorConsent[input]])))};
      const askSensor = input => new Promise(resolve => { consentReply = resolve; previousFocus = document.activeElement;
        const [title, text, enable] = consentCopy[input]; document.getElementById('camera-consent-title').textContent = title;
        document.getElementById('camera-consent-text').textContent = text; document.getElementById('camera-enable').textContent = enable;
        consent.hidden = false; document.getElementById('camera-enable').focus(); });
      const cancelSensor = () => { consent.hidden=true; consentReply?.(false); consentReply=null; previousFocus?.focus(); };
      const sensors = {${sensors.map(([input, , , global]) => `
        ${input}: ${global}.CreateBroker({ send: sendInput, requestConsent: () => askSensor('${input}'), cancelConsent: cancelSensor${input === 'microphone' ? '' : ", previewHost: document.getElementById('input-preview')"} }),`).join('')}
      };
      const stopSensors = () => Object.values(sensors).forEach(sensor => sensor.Stop());
      const shell = document.getElementById('game-shell');
      const preview = document.getElementById('input-preview');
      const answer = value => { const reply=consentReply; consentReply=null; consent.hidden=true; reply?.(value); previousFocus?.focus(); };
      document.getElementById('camera-enable').onclick=() => answer(true);
      document.getElementById('camera-cancel').onclick=() => answer(false);
      consent.onkeydown=event => { if(event.key==='Escape') {event.preventDefault();answer(false);} if(event.key==='Tab') {event.preventDefault();(document.activeElement.id==='camera-enable'?document.getElementById('camera-cancel'):document.getElementById('camera-enable')).focus();} };
      const stop = () => { broker.Stop(); stopSensors(); port?.close(); port=null; };
      frame.addEventListener('load', () => {
        if(initialized) {stop();frame.remove();document.getElementById('runner-error').hidden=false;return;}
        initialized=true;
        const channel=new MessageChannel(); port=channel.port1;
        port.onmessage=({data}) => {
          if(data?.type==='settings') { if(AcceptGameSettingsMessage(data,state))WriteSavedGameSettings(storage,config.gameId,data.payload); return; }
          if(!accept(data,state))return;
          if(data.type==='result') { broker.Stop(); stopSensors(); }
          if(data.type==='input-start' && data.payload.input) { Object.entries(sensors).forEach(([input, sensor]) => { if(input!==data.payload.input)sensor.Stop(); }); void sensors[data.payload.input]?.Start(data.payload.input); }
          else if(data.type==='input-start')void broker.Start(data.payload.hand);
          if(data.type==='input-stop') { broker.Stop(); stopSensors(); }
          if(data.type==='input-capture')sensors.tongue?.Capture(data.payload.label,data.payload.active);
          if(data.type==='input-preview' && preview) { preview.hidden=!data.payload.visible; for(const [key,name] of [['x','left'],['y','top'],['width','width'],['height','height']])preview.style[name]=Math.round(data.payload[key]*10000)/100+'%'; }
          if(data.type==='fullscreen-request' && shell && document.fullscreenElement!==shell)Promise.resolve(shell.requestFullscreen?.()).catch(()=>{});
          if(data.type==='fullscreen-exit' && document.fullscreenElement===shell)Promise.resolve(document.exitFullscreen()).catch(()=>{});
          if(data.type==='input-calibrate')broker.Calibrate(data.payload.x,data.payload.y);
          if(data.type==='input-reset')broker.Reset();
          if(data.type==='csv-file')csv=data.payload;
          if(data.type==='csv-download' && csv)TrainerHubEyeTracking.DownloadCsv(csv);
          if(data.type==='result-file')StageResultFile(resultFiles,data.payload);
          if(data.type==='result-file-download' && resultFiles.has(data.payload.fileName))DownloadResultFile(data.payload.fileName,resultFiles.get(data.payload.fileName));
          if(data.type==='exit') { broker.Stop(); stopSensors(); csv=null;resultFiles.clear();state.complete=false;port.postMessage({schema:'trainerhub.game/v1',type:'configure',sessionNonce:nonce}); }
        };
        port.onmessageerror=stop;port.start();
        const settings=config.capabilities.includes('settings-storage')?ReadSavedGameSettings(storage,config.gameId):null;
        frame.contentWindow.postMessage({schema:'trainerhub.game/v1',type:'init',gameId:config.gameId,version:config.version,sessionNonce:nonce,language:new URLSearchParams(location.search).get('lang')==='en'?'en':'zh',mode:'standalone',...(settings?{settings}:{})},'*',[channel.port2]);
      });
      window.addEventListener('pagehide',stop);
      if(shell)document.addEventListener('fullscreenchange',() => port?.postMessage({schema:'trainerhub.game/v1',type:'fullscreen',sessionNonce:nonce,active:document.fullscreenElement===shell}));
      const health=async () => { if(!navigator.onLine)return;try{const response=await fetch(config.basePath,{method:'HEAD',cache:'no-store'});if([404,410].includes(response.status)){stop();frame.remove();document.getElementById('runner-error').hidden=false;}}catch{} };
      const timer=setInterval(health,60000);window.addEventListener('online',health);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
      if(window===window.top && navigator.serviceWorker) navigator.serviceWorker.register(config.basePath+'sw.js',{scope:config.basePath}).catch(()=>{});
      let installPrompt=null;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.getElementById('install-button').hidden=false;});
      document.getElementById('install-button').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;document.getElementById('install-button').hidden=true;}};
      frame.src=config.basePath+'package/index.html';
    });</script>
    </head><body>
      ${cameraSensor ? '<div id="game-shell"><div id="input-preview" hidden></div>' : ''}
      <iframe id="game-frame" title="${EscapeHtml(release.name ?? release.gameId)}" sandbox="allow-scripts" allow="fullscreen; autoplay${release.capabilities.includes('gamepad') ? '; gamepad *' : ''}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <div id="camera-consent" hidden role="dialog" aria-modal="true" aria-labelledby="camera-consent-title"><section><h2 id="camera-consent-title">啟用相機 / Enable camera</h2><p id="camera-consent-text">${eyeTracking ? '影像只在此裝置由 WebGazer 處理；遊戲只收到眼動座標，不會上傳影像。<br>WebGazer runs on this device. Only gaze coordinates reach the game.' : '影像只在此裝置由 MediaPipe 處理；遊戲只收到手部座標，不會上傳影像。<br>MediaPipe runs on this device. Only hand coordinates reach the game.'}</p><button id="camera-enable" type="button">允許相機 / Enable camera</button><button id="camera-cancel" type="button">取消 / Cancel</button></section></div>${cameraSensor ? '</div>' : ''}
      <button id="install-button" hidden type="button">安裝 / Install</button><p id="runner-error" hidden role="alert">此版本無法繼續使用，請返回遊戲入口。</p>
    </body></html>`;
}
