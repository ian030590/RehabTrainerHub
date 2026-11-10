import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, '.tmp/uiux-implementation/browser');
const browserPath = process.env.BRAVE_BIN || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
assert.ok(existsSync(browserPath), 'Install Brave or provide BRAVE_BIN for this local browser gate.');
await mkdir(artifacts, { recursive: true });
const output = resolve(process.env.HUB_OUTPUT_ROOT || resolve(root, 'apps/rehabtrainerhub/out'));
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname);
    const file = resolve(output, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(output + '/')) {
      // resolve() uses backslashes on Windows.
      assert.ok(file.startsWith(output + '\\'), 'Static path must stay within build output.');
    }
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream' }).end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const baseUrl = process.env.UIUX_BASE_URL || `http://127.0.0.1:${server.address().port}`;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname), 'UI tests only run against a local fixture.');
const debugProbe = createServer();
await new Promise(done => debugProbe.listen(0, '127.0.0.1', done));
const debugPort = debugProbe.address().port;
await new Promise(done => debugProbe.close(done));
const browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--disable-gpu',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${resolve(artifacts, 'profile-' + process.pid)}`, 'about:blank'],
{ stdio: 'ignore', windowsHide: true });
const sleep = milliseconds => new Promise(done => setTimeout(done, milliseconds));
const user = { id: 'uiux-fixture', displayName: 'Browser fixture', role: 'patient', profileCompleted: true };
// The app's signed token stores its payload in the first segment.
const token = Buffer.from(JSON.stringify({ sub: user.id, name: user.displayName })).toString('base64url') + '.fixture';
const failures = [];
const results = [];
let ws, session, serial = 0;
let authenticated = false;
let releasePlan = null;
let holdPlan = false;
let holdAuthChecks = false;
let authCheckCount = 0;
const heldAuthChecks = [];
const apiCalls = [];
let progressFailed = true;
let holdProgress = false;
let releaseProgress = null;
const pending = new Map();
const send = (method, params = {}, sessionId = session) => new Promise((done, reject) => {
  const id = ++serial;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 25000);
  pending.set(id, { done, reject, timer });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async expression => {
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await sleep(100); }
  throw new Error('Browser condition timed out: ' + expression);
};
const navigate = async (path, width = 390, height = 844) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send('Page.navigate', { url: baseUrl + path });
  await waitFor(`document.readyState==='complete'&&!!document.querySelector('h1')`);
  await sleep(550);
};
const click = async selector => {
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing click target');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
};
const key = async (name, code, value, modifiers = 0) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: name, code, windowsVirtualKeyCode: value, modifiers });
};
const fill = async (selector, value) => {
  await click(selector);
  await send('Input.insertText', { text: value });
};
const releaseAuthChecks = () => { holdAuthChecks = false; heldAuthChecks.splice(0).forEach(done => done()); };
const check = async (name, action) => {
  try { await action(); results.push({ name, pass: true }); console.log('PASS ' + name); }
  catch (error) {
    failures.push(name); results.push({ name, pass: false, error: String(error) }); console.error('FAIL ' + name + ': ' + error.message);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
    if (screenshot) await writeFile(resolve(artifacts, name.replace(/[^a-z0-9]+/gi, '-') + '.png'), Buffer.from(screenshot.data, 'base64'));
  }
  finally {
    releaseAuthChecks(); user.profileCompleted = true;
    holdPlan = false; releasePlan?.(); releasePlan = null;
    holdProgress = false; releaseProgress?.(); releaseProgress = null;
  }
};

try {
  let connection;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { connection = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(); break; } catch { await sleep(100); }
  }
  assert.ok(connection, 'Browser debugger did not start.');
  ws = new WebSocket(connection.webSocketDebuggerUrl);
  await new Promise((done, reject) => { ws.addEventListener('open', done, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer); pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.done(message.result);
    }
    if (message.method === 'Fetch.requestPaused') void (async () => {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      const fulfill = (status, payload) => send('Fetch.fulfillRequest', { requestId, responseCode: status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: new URL(baseUrl).origin },
          { name: 'Access-Control-Allow-Credentials', value: 'true' },
          { name: 'Access-Control-Allow-Methods', value: 'GET, HEAD, POST, PUT, OPTIONS' },
          { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') });
      if (url.pathname.startsWith('/api/')) {
        apiCalls.push({ path: url.pathname, method: request.method });
        if (request.method === 'OPTIONS') return fulfill(204, {});
        if (url.pathname === '/api/auth/password/login' && request.method === 'POST') {
          authenticated = true;
          return fulfill(200, { token, user });
        }
        if (!['GET', 'HEAD'].includes(request.method)) return fulfill(503, { error: 'Local read-only UI fixture' });
        if (['/api/auth/me', '/api/auth/session'].includes(url.pathname)) {
          authCheckCount++;
          if (holdAuthChecks) await new Promise(done => heldAuthChecks.push(done));
          if (url.pathname === '/api/auth/me') return fulfill(authenticated ? 200 : 401, { user });
          return fulfill(401, {});
        }
        if (url.pathname === '/api/games') return fulfill(200, { games: [] });
        if (url.pathname === '/api/training-plans/current') {
          if (!holdPlan) return fulfill(200, { plan: null });
          await new Promise(done => releasePlan = done);
          return fulfill(200, { plan: { id: 'fixture', title: 'Browser-only plan', note: '', assignedBy: null,
            items: [{ id: 'fixture-item', gameId: 'drawing-defense', weeklyTarget: 3, settings: null, completedThisWeek: 0 }],
            week: { start: '2026-11-09', end: '2026-11-16', achieved: false }, achievedWeeks: 0, currentStreak: 0, weeksToTitle: 6, titles: [] } });
        }
        if (url.pathname.includes('progress')) {
          if (holdProgress) await new Promise(done => releaseProgress = done);
          return fulfill(progressFailed ? 503 : 200, {
            serverDate: '2026-11-10', timeZone: 'Asia/Taipei', startedOn: '2026-11-09', daysSinceStart: 1,
            rehabilitationDays: 1, totalRehabilitationDays: 1, recentModules: [], dailyTasks: [], achievements: [] });
        }
        return fulfill(200, { records: [], cursor: null });
      }
      if (url.origin !== new URL(baseUrl).origin) return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      return send('Fetch.continueRequest', { requestId });
    })().catch(() => {});
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setBypassServiceWorker', { bypass: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('rehab_hub_tour_seen','1');
    window.__uiuxCards=[];window.__uiuxTransitions=[];
    const originalAnimate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){
      if(this.matches('.module-grid [data-runtime-id]')){
        const r=this.getBoundingClientRect();
        window.__uiuxCards.push({id:this.dataset.runtimeId,frames,options,visible:r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth});
      }
      return originalAnimate.call(this,frames,options);
    };
    if(document.startViewTransition){
      const originalTransition=document.startViewTransition.bind(document);
      document.startViewTransition=function(update){
        const record={old:[...document.querySelectorAll('[style]')].filter(e=>e.style.viewTransitionName==='hub-game-surface').map(e=>e.className)};
        window.__uiuxTransitions.push(record);
        const transition=originalTransition(async()=>{await update();record.next=[...document.querySelectorAll('[style]')].filter(e=>e.style.viewTransitionName==='hub-game-surface').map(e=>({className:e.className,containsFrame:!!e.querySelector('iframe')}));});
        transition.ready.then(()=>{record.ready=true;record.animations=document.getAnimations().map(a=>({pseudo:a.effect?.pseudoElement,name:a.animationName,playState:a.playState,duration:a.effect?.getTiming().duration}));},error=>{record.error=String(error);});
        transition.finished.then(()=>{record.finished=true;},()=>{});
        return transition;
      };
    }
  ` });

  await check('local icon font survives blocked external services', async () => {
    await navigate('/');
    const loaded = await evaluate(`(async()=>{await document.fonts.ready;return [...document.fonts].some(f=>f.family.includes('Material Symbols Outlined')&&f.status==='loaded');})()`);
    assert.equal(loaded, true, 'Critical icon face must load from the app, with external requests blocked.');
    const fontReadme = await readFile(resolve(root, 'apps/rehabtrainerhub/public/fonts/README.md'), 'utf8');
    const iconNames = fontReadme.match(/icon_names=([a-z_,]+)/)?.[1].split(',');
    assert.ok(iconNames?.length, 'The local font records its exact symbol subset.');
    const glyphs = await evaluate(`(()=>{const canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font='24px "Material Symbols Outlined"';return ${JSON.stringify(iconNames)}.map(name=>({name,width:context.measureText(name).width}));})()`);
    assert.ok(glyphs.every(glyph => glyph.width >= 20 && glyph.width <= 32), `Every symbol must render as a glyph instead of its raw ligature text: ${JSON.stringify(glyphs.filter(glyph=>glyph.width<20||glyph.width>32))}`);
    assert.ok(await evaluate(`document.querySelector('.module-search>.material-symbols-outlined').getBoundingClientRect().width<=32`), 'The visible search icon uses the loaded icon font.');
    await writeFile(resolve(artifacts, 'lobby-phone-success.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  });
  await check('OKLCH palette is active and desktop touch controls stay large', async () => {
    await navigate('/', 768, 1024);
    assert.equal(await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--surface').trim().startsWith('oklch(')`), true);
    assert.ok(await evaluate(`document.querySelector('#hub-guide-button').getBoundingClientRect().height>=44`));
    await navigate('/developer/');
    assert.ok(await evaluate(`document.querySelector('.developer-prompt-output button').getBoundingClientRect().height>=44`));
  });
  await check('Chinese developer title has no single-character final line at phone widths', async () => {
    for (const width of [320, 390]) {
      await navigate('/developer/', width);
      const lines = await evaluate(`(()=>{const title=document.querySelector('.developer-hero h1');const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);const lines=new Map();while(walker.nextNode()){const n=walker.currentNode;for(let i=0;i<n.length;i++){if(!n.data[i].trim())continue;const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const y=Math.round(r.getBoundingClientRect().y);lines.set(y,(lines.get(y)||'')+n.data[i]);}}return [...lines.values()];})()`);
      const metrics = await evaluate(`(()=>{const e=document.querySelector('.developer-hero h1'),s=getComputedStyle(e);return{fontSize:s.fontSize,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,lang:document.documentElement.lang,innerWidth};})()`);
      assert.ok(lines.length === 1 || lines.at(-1).length > 1, `${width}px: ${lines.join(' / ')} ${JSON.stringify(metrics)}`);
      assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));
    }
    await writeFile(resolve(artifacts, 'developer-phone-success.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  });
  if (!process.argv.includes('--visual-only')) {
    await check('pending sign-in is announced, deduplicated and cancelled without reopening', async () => {
      authenticated = false;
      await navigate('/'); await click('.account-menu-button');
      const before = authCheckCount;
      holdAuthChecks = true;
      await click('.auth-panel-actions button');
      await waitFor(`!!document.querySelector('.auth-account-dialog:modal [role="status"]')`);
      assert.match(await evaluate(`document.querySelector('.auth-account-dialog [role="status"]').textContent`), /檢查登入|Checking sign-in/);
      await evaluate(`document.querySelector('.auth-panel-actions button').click();document.querySelector('.auth-panel-actions button').click()`);
      await sleep(100);
      assert.equal(authCheckCount - before, 1, 'Rapid repeated entry clicks must share the pending session check.');
      await click('.auth-account-dialog .auth-dialog-close');
      assert.equal(await evaluate(`!!document.querySelector('.auth-account-dialog:modal')`), false);
      releaseAuthChecks(); await sleep(200);
      assert.equal(await evaluate(`!!document.querySelector('.auth-account-dialog')`), false, 'An old request must not reopen the cancelled modal.');
      assert.equal(await evaluate(`document.activeElement.matches('.auth-panel-actions button')`), true);
    });
    await check('login opens inside a native modal and closes back to its trigger', async () => {
      await navigate('/'); await click('.account-menu-button'); await click('.auth-panel-actions button');
      await waitFor(`!!document.querySelector('.auth-account-dialog:modal')`);
      await waitFor(`!!document.querySelector('.auth-account-dialog form')`);
      assert.ok(await evaluate(`document.querySelector('.auth-account-dialog').contains(document.activeElement)`));
      for (let step = 0; step < 15; step++) {
        await key('Tab', 'Tab', 9);
        assert.ok(await evaluate(`document.querySelector('.auth-account-dialog').contains(document.activeElement)`), `Tab step ${step}: ${await evaluate('document.activeElement.outerHTML.slice(0,180)')}`);
      }
      for (let step = 0; step < 15; step++) {
        await key('Tab', 'Tab', 9, 8);
        assert.ok(await evaluate(`document.querySelector('.auth-account-dialog').contains(document.activeElement)`), `Shift+Tab step ${step}: ${await evaluate('document.activeElement.outerHTML.slice(0,180)')}`);
      }
      await click('.auth-account-dialog input[type="email"]');
      assert.equal(await evaluate(`document.querySelector('.account-menu-button').getAttribute('aria-expanded')`), 'true', 'Interacting with a portalled modal must not close its parent account menu.');
      const backgroundFocusBlocked = await evaluate(`(()=>{const e=document.querySelector('#module-search-input');e.focus();return document.activeElement!==e;})()`);
      assert.equal(backgroundFocusBlocked, true, 'Native modal must keep the background inert.');
      await key('Escape', 'Escape', 27); await sleep(150);
      assert.equal(await evaluate(`!!document.querySelector('.auth-account-dialog:modal')`), false);
      assert.equal(await evaluate(`document.activeElement.matches('.auth-panel-actions button')`), true);
      assert.equal(await evaluate(`document.querySelector('.account-menu-button').getAttribute('aria-expanded')`), 'true', 'Escape closes the modal while preserving the parent menu.');
    });
    await check('phone login keeps its close control visible and requires privacy consent', async () => {
      await navigate('/', 320, 568); await click('.account-menu-button'); await click('.auth-panel-actions button');
      await waitFor(`!!document.querySelector('.auth-account-dialog form')`);
      assert.equal(await evaluate(`document.querySelector('.auth-privacy-disclosure').open`), false);
      assert.equal(await evaluate(`document.querySelectorAll('.auth-privacy-disclosure li').length`), 5);
      await click('.auth-privacy-disclosure summary');
      assert.equal(await evaluate(`document.querySelector('.auth-privacy-disclosure').open`), true);
      await evaluate(`document.querySelector('.auth-dialog-body').scrollTop=100000`);
      assert.ok(await evaluate(`(()=>{const e=document.querySelector('.auth-dialog-close'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&r.top>=0&&r.bottom<=innerHeight&&e.contains(hit);})()`), 'Header close remains visible and hittable after reading the full notice.');
      await fill('.auth-account-dialog input[type="email"]', 'fixture@example.com');
      await fill('.auth-account-dialog input[type="password"]', 'fixture-password');
      assert.equal(await evaluate(`document.querySelector('.auth-account-dialog button[type="submit"]').disabled`), true);
      await click('.auth-account-dialog input[type="checkbox"]');
      assert.equal(await evaluate(`document.querySelector('.auth-account-dialog button[type="submit"]').disabled`), false);
      await writeFile(resolve(artifacts, 'auth-phone-success.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await click('.auth-account-dialog .auth-dialog-close');
    });
    await check('profile validation and server failures are announced inside the visible modal', async () => {
      authenticated = true; user.profileCompleted = false;
      await evaluate(`localStorage.setItem('rehabtrainerhub.auth.token',${JSON.stringify(token)})`);
      await navigate('/');
      await waitFor(`!!document.querySelector('.auth-profile-dialog:modal')`);
      assert.ok(await evaluate(`(()=>{const r=document.querySelector('.auth-profile-dialog').getBoundingClientRect();return r.width>0&&r.height>0;})()`), 'The automatic questionnaire is visible even while the account menu is closed.');
      await click('.auth-profile-dialog .auth-dialog-actions .auth-button-primary');
      await waitFor(`!!document.querySelector('.auth-profile-dialog [role="alert"]')`);
      assert.match(await evaluate(`document.querySelector('.auth-profile-dialog [role="alert"]').innerText`), /年齡|age/);
      assert.equal(await evaluate(`document.activeElement.matches('.auth-profile-dialog [role="alert"]')`), true);
      assert.ok(await evaluate(`(()=>{const r=document.activeElement.getBoundingClientRect(),b=document.querySelector('.auth-dialog-body').getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom;})()`));
      await evaluate(`(()=>{const fields=document.querySelectorAll('.auth-profile-grid select');for(const [field,value]of [[fields[0],'30-39'],[fields[1],'woman']]){field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
      await fill('.auth-profile-grid input[type="text"]', 'Taiwan');
      await click('.auth-profile-dialog .auth-dialog-actions .auth-button-primary');
      await waitFor(`document.querySelector('.auth-profile-dialog [role="alert"]')?.textContent.includes('失敗')||document.querySelector('.auth-profile-dialog [role="alert"]')?.textContent.includes('could not be saved')`);
      assert.ok(apiCalls.some(call => call.path === '/api/auth/profile' && call.method === 'PUT'));
      assert.equal(await evaluate(`document.activeElement.matches('.auth-profile-dialog [role="alert"]')`), true);
      await writeFile(resolve(artifacts, 'profile-error-success.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await click('.auth-profile-dialog .auth-dialog-close');
      assert.equal(await evaluate(`document.activeElement.matches('.account-menu-button')`), true, 'An automatic questionnaire returns focus to its collapsed account control.');
      user.profileCompleted = true;
    });
    await check('delayed patient plan preserves the collapsed result position', async () => {
      holdPlan = true; authenticated = true;
      await navigate('/');
      await evaluate(`localStorage.setItem('rehabtrainerhub.auth.token',${JSON.stringify(token)});dispatchEvent(new Event('rehab-auth-changed'))`);
      for (let attempt = 0; attempt < 50 && !releasePlan; attempt++) await sleep(100);
      assert.ok(releasePlan, 'Patient plan request must be intercepted.');
      const before = await evaluate(`document.querySelector('.lobby-layout').getBoundingClientRect().y`);
      await sleep(600); holdPlan = false; releasePlan(); releasePlan = null; await sleep(200);
      const after = await evaluate(`document.querySelector('.lobby-layout').getBoundingClientRect().y`);
      assert.ok(Math.abs(before - after) <= 1, `Results moved by ${after - before}px`);
    });
    await check('failed progress has retry and never masquerades as zero', async () => {
      await navigate('/progress/'); await waitFor(`!!document.querySelector('.progress-error')`);
      const text = await evaluate(`document.querySelector('.progress-metrics').innerText`);
      assert.doesNotMatch(text, /\b0\b/);
      const retry = await evaluate(`(()=>{const e=[...document.querySelectorAll('main button')].find(b=>/重試|重新載入|Try again|Retry/i.test(b.innerText));if(!e)return false;e.id='uiux-progress-retry';return true;})()`);
      assert.equal(retry, true); progressFailed = false; holdProgress = true; await click('#uiux-progress-retry');
      for (let attempt = 0; attempt < 50 && !releaseProgress; attempt++) await sleep(100);
      assert.ok(releaseProgress, 'Retry must issue another progress request.');
      await waitFor(`!document.querySelector('.progress-error')&&[...document.querySelectorAll('.progress-metrics strong')].every(e=>/載入中|Loading/i.test(e.textContent))`);
      assert.doesNotMatch(await evaluate(`document.querySelector('.progress-metrics').innerText`), /\b0\b/);
      holdProgress = false; releaseProgress(); releaseProgress = null;
      await waitFor(`!document.querySelector('.progress-error')&&document.querySelectorAll('.progress-metrics strong').length===2&&[...document.querySelectorAll('.progress-metrics strong')].every(e=>e.textContent.trim()==='1')`);
      assert.match(await evaluate(`document.querySelector('.progress-metrics').innerText`), /1/);
    });
    await check('card entry motion is bounded and disabled for reduced motion', async () => {
      authenticated = false; await evaluate(`localStorage.removeItem('rehabtrainerhub.auth.token')`);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await navigate('/');
      assert.ok(await evaluate(`document.querySelectorAll('.module-card').length>0`));
      assert.equal(await evaluate(`document.querySelectorAll('.module-grid')[0].getAnimations({subtree:true}).filter(a=>a.playState==='running').length`), 0);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    });
    await check('new visible cards stagger briefly while retained cards stay still', async () => {
      await navigate('/', 1440, 1200);
      const cards = await evaluate(`window.__uiuxCards`);
      await writeFile(resolve(artifacts, 'stagger-evidence.json'), JSON.stringify(cards, null, 2));
      assert.ok(cards.length >= 2, 'A desktop viewport should animate multiple newly visible cards.');
      assert.ok(cards.every(card => card.visible && card.options.duration === 160 && card.options.delay >= 0 && card.options.delay <= 96));
      assert.ok(new Set(cards.map(card => card.options.delay)).size >= 2, 'Visible siblings start in a staggered sequence.');
      assert.ok(cards.every(card => card.frames.every(frame => !Object.hasOwn(frame,'opacity'))), 'Cards remain visible and usable throughout their entry motion.');
      await evaluate(`window.__uiuxCards=[]`);
      await click('.official-game-card .official-game-actions button');
      await waitFor(`!!document.querySelector('.hub-game-transition-surface')`);
      await key('Escape', 'Escape', 27);
      await waitFor(`!document.querySelector('.hub-game-overlay-host')`);
      assert.equal(await evaluate(`window.__uiuxCards.length`), 0, 'Opening and closing training must not replay the retained grid.');
    });
    await check('card and modal share a real native transition in both directions', async () => {
      await navigate('/', 1440, 1200);
      assert.equal(await evaluate(`typeof document.startViewTransition`), 'function', 'This browser gate requires native View Transitions support.');
      await click('.official-game-card .official-game-actions button');
      await waitFor(`window.__uiuxTransitions[0]?.ready||window.__uiuxTransitions[0]?.error`);
      const opening = await evaluate(`window.__uiuxTransitions[0]`);
      await writeFile(resolve(artifacts, 'shared-opening-success.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      assert.equal(opening.ready, true, opening.error);
      assert.equal(opening.old.length, 1);
      assert.match(opening.old[0], /official-game-card/);
      assert.equal(opening.next.length, 1, 'Only one destination surface owns the shared transition name.');
      assert.match(opening.next[0].className, /hub-game-transition-surface/);
      assert.equal(opening.next[0].containsFrame, false, 'Training runtime contents stay out of the shared snapshot.');
      assert.ok(opening.animations.some(animation => /hub-game-surface/.test((animation.pseudo||'')+(animation.name||'')) && animation.playState === 'running'), 'The named transition must actually animate after ready resolves.');
      await waitFor(`window.__uiuxTransitions[0]?.finished`);
      await key('Escape', 'Escape', 27);
      await waitFor(`window.__uiuxTransitions[1]?.ready||window.__uiuxTransitions[1]?.error`);
      const closing = await evaluate(`window.__uiuxTransitions[1]`);
      await writeFile(resolve(artifacts, 'shared-transition-evidence.json'), JSON.stringify({ opening, closing }, null, 2));
      assert.equal(closing.ready, true, closing.error);
      assert.match(closing.old[0], /hub-game-transition-surface/);
      assert.equal(closing.next.length, 1); assert.match(closing.next[0].className, /official-game-card/);
      assert.ok(closing.animations.some(animation => /hub-game-surface/.test((animation.pseudo||'')+(animation.name||'')) && animation.playState === 'running'));
      await waitFor(`window.__uiuxTransitions[1]?.finished`);
      assert.equal(await evaluate(`document.querySelectorAll('[style*="view-transition-name"]').length`), 0);
    });
  }
  await writeFile(resolve(artifacts, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  if (ws) { try { await send('Browser.close', {}, null); } catch {} ws.close(); }
  browser.kill(); server.closeAllConnections(); await new Promise(done => server.close(done));
}
assert.equal(failures.length, 0, failures.join('\n'));
