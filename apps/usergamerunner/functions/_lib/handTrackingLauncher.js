import { AcceptGameMessage, IsGameResult } from '../../../../packages/ui/src/selfContainedGame.js';

export function RenderHandTrackingLauncher(release, basePath, cspNonce) {
  const configuration = JSON.stringify({ gameId: release.gameId, version: release.version,
    capabilities: release.capabilities, basePath }).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="zh-TW"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <meta name="robots" content="noindex,nofollow,noarchive"><title>手勢指令對戰｜居家訓練網</title>
    <link rel="manifest" href="${basePath}manifest.webmanifest">
    <style nonce="${cspNonce}">
      :root { --surface: #fff; --text: #202428; --overlay: #14212b99; --primary: #005eb8; }
      * { box-sizing: border-box; } html,body,iframe { margin:0;width:100%;height:100%;border:0; }
      body { height:100dvh;overflow:hidden;background:var(--surface);font:700 18px/1.5 system-ui;color:var(--text); }
      #camera-consent { position:fixed;inset:0;background:var(--overlay);display:grid;place-items:center;padding:16px; }
      #camera-consent[hidden] { display:none; } #camera-consent section { max-width:30rem;padding:24px;background:var(--surface);border-radius:8px; }
      button { font:inherit;padding:12px;margin:4px;cursor:pointer; } button:focus-visible { outline:3px solid var(--primary); }
      #install-button { position:fixed;top:8px;right:8px; } #runner-error { position:fixed;inset:0;padding:24px;background:var(--surface); }
    </style>
    <script nonce="${cspNonce}" src="/input/hand-tracking-1.0.0/index.js"></script>
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
      const IsGameResult = ${IsGameResult.toString()};
      const accept = ${AcceptGameMessage.toString()};
      let port = null; let initialized = false; let consentReply = null; let previousFocus = null;
      const broker = TrainerHubHandTracking.CreateBroker({
        send: message => port?.postMessage({ ...message, sessionNonce:nonce }),
        requestConsent: () => new Promise(resolve => { consentReply = resolve; previousFocus = document.activeElement; consent.hidden=false; document.getElementById('camera-enable').focus(); }),
        cancelConsent: () => { consent.hidden=true; consentReply?.(false); consentReply=null; previousFocus?.focus(); },
      });
      const answer = value => { const reply=consentReply; consentReply=null; consent.hidden=true; reply?.(value); previousFocus?.focus(); };
      document.getElementById('camera-enable').onclick=() => answer(true);
      document.getElementById('camera-cancel').onclick=() => answer(false);
      consent.onkeydown=event => { if(event.key==='Escape') {event.preventDefault();answer(false);} if(event.key==='Tab') {event.preventDefault();(document.activeElement.id==='camera-enable'?document.getElementById('camera-cancel'):document.getElementById('camera-enable')).focus();} };
      const stop = () => { broker.Stop(); port?.close(); port=null; };
      frame.addEventListener('load', () => {
        if(initialized) {stop();frame.remove();document.getElementById('runner-error').hidden=false;return;}
        initialized=true;
        const channel=new MessageChannel(); port=channel.port1;
        port.onmessage=({data}) => {
          if(!accept(data,state))return;
          if(data.type==='result')broker.Stop();
          if(data.type==='input-start')void broker.Start();
          if(data.type==='input-stop')broker.Stop();
          if(data.type==='exit') { broker.Stop(); state.complete=false;port.postMessage({schema:'trainerhub.game/v1',type:'configure',sessionNonce:nonce}); }
        };
        port.onmessageerror=stop;port.start();
        frame.contentWindow.postMessage({schema:'trainerhub.game/v1',type:'init',gameId:config.gameId,version:config.version,sessionNonce:nonce,language:new URLSearchParams(location.search).get('lang')==='en'?'en':'zh',mode:'standalone'},'*',[channel.port2]);
      });
      window.addEventListener('pagehide',stop);
      const health=async () => { if(!navigator.onLine)return;try{const response=await fetch(config.basePath,{method:'HEAD',cache:'no-store'});if([404,410].includes(response.status)){stop();frame.remove();document.getElementById('runner-error').hidden=false;}}catch{} };
      const timer=setInterval(health,60000);window.addEventListener('online',health);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
      if(window===window.top && navigator.serviceWorker) navigator.serviceWorker.register(config.basePath+'sw.js',{scope:config.basePath}).catch(()=>{});
      let installPrompt=null;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.getElementById('install-button').hidden=false;});
      document.getElementById('install-button').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;document.getElementById('install-button').hidden=true;}};
      frame.src=config.basePath+'package/index.html';
    });</script>
    </head><body>
      <iframe id="game-frame" title="手勢指令對戰" sandbox="allow-scripts" allow="fullscreen; autoplay" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <div id="camera-consent" hidden role="dialog" aria-modal="true" aria-labelledby="camera-consent-title"><section><h2 id="camera-consent-title">啟用相機 / Enable camera</h2><p>影像只在此裝置由 MediaPipe 處理；遊戲只收到手部座標，不會上傳影像。<br>MediaPipe runs on this device. Only hand coordinates reach the game.</p><button id="camera-enable" type="button">允許相機 / Enable camera</button><button id="camera-cancel" type="button">取消 / Cancel</button></section></div>
      <button id="install-button" hidden type="button">安裝 / Install</button><p id="runner-error" hidden role="alert">此版本無法繼續使用，請返回遊戲入口。</p>
    </body></html>`;
}
