import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import colorNames from 'color-name';
import postcss from 'postcss';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const hub = 'apps/rehabtrainerhub';
const runner = 'apps/usergamerunner';
const runnerRoute = `${runner}/functions/[[path]].js`;

function TrackedSources(paths, extensions) {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(path => extensions.test(path)
      && !/\.test\.[cm]?[jt]sx?$|\/(?:vendor|vendors|fixtures)\//.test(path));
}

function VisitSource(path, source, visit) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function Walk(node) {
    visit(node);
    ts.forEachChild(node, Walk);
  }
  Walk(tree);
}

function CheckSandbox(path, source) {
  let count = 0;
  VisitSource(path, source, node => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === 'iframe') {
      count++;
      const attributes = node.attributes.properties.filter(attr => ts.isJsxAttribute(attr) && attr.name.getText() === 'sandbox');
      assert.equal(attributes.length, 1, `${path}: iframe must declare one sandbox`);
      const value = attributes[0].initializer;
      assert.equal(value && ts.isStringLiteral(value) && value.text, 'allow-scripts', `${path}: iframe sandbox must be allow-scripts`);
      assert.ok(node.attributes.properties.every(attr => !ts.isJsxSpreadAttribute(attr)), `${path}: iframe sandbox must not be overridden by spread props`);
    }
  });
  assert.ok(count, `${path}: expected a package iframe`);
}

test('Hub package iframes use the exact allow-scripts sandbox', () => {
  for (const attrs of ['', 'sandbox="allow-scripts allow-same-origin"', 'sandbox="allow-scripts allow-top-navigation-by-user-activation"',
    'sandbox="allow-scripts" {...props}']) {
    assert.throws(() => CheckSandbox('fixture.tsx', `<iframe ${attrs} />`), /sandbox/);
  }
  for (const overlay of ['R2GameOverlay', 'PackageGameOverlay']) {
    const path = `${hub}/app/train/${overlay}.tsx`;
    CheckSandbox(path, read(path));
  }
});

async function CheckRunnerMethods(handle) {
  const paths = ['/', '/games/fixture/', '/games/fixture/1.0.0/package/index.html', '/runtime/gameBridge-1.0.0.js', '/input/eye-tracking-1.0.0/preview'];
  for (const pathname of paths) {
    const url = `https://runner.example${pathname}`;
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'CUSTOM']) {
      const response = await handle({
        request: { method, url },
        get env() { assert.fail(`${method} accessed bindings`); },
        next() { assert.fail(`${method} reached an asset handler`); },
      });
      assert.equal(response.status, 405, `${method} must be rejected on ${pathname}`);
      assert.equal(response.headers.get('allow'), 'GET, HEAD');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const asset = new Response(null, { status: 204 });
    const response = await handle({ request: { method, url: 'https://runner.example/' }, next: () => asset });
    assert.equal(response, asset, `${method} must reach the asset handler`);
  }
}

test('runner requests outside GET and HEAD are rejected before accessing assets', async () => {
  await assert.rejects(() => CheckRunnerMethods(async () => new Response(null, { status: 200 })), /POST must be rejected/);
  const { HandleRequest } = await import(`../${runner}/functions/[[path]].js`);
  await CheckRunnerMethods(HandleRequest);
});

function CheckReadOnlyBucket(path, source) {
  function LastMember(node) {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
  }
  VisitSource(path, source, node => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (!['bucket', 'GAME_RELEASE_BUCKET'].includes(LastMember(node.expression))) return;
      const method = LastMember(node);
      assert.ok(['get', 'head'].includes(method), `${path}: release bucket cannot use ${method ?? 'a dynamic member'}`);
    }
  });
}

test('runner Functions only read the release bucket', () => {
  assert.throws(() => CheckReadOnlyBucket('route.js', "await context.env.GAME_RELEASE_BUCKET['put'](key, bytes);"), /cannot use put/);
  assert.throws(() => CheckReadOnlyBucket('route.js', "await context.env['GAME_RELEASE_BUCKET'][method](key);"), /dynamic member/);
  assert.throws(() => CheckReadOnlyBucket('route.js', 'await bucket.delete(key);'), /cannot use delete/);
  for (const path of TrackedSources([`${runner}/functions`, `${hub}/functions/_lib/officialGameReleases.js`], /\.js$/)) {
    CheckReadOnlyBucket(path, read(path));
  }
});

function CheckPackageCsp(path, source) {
  const declarations = [];
  const references = [];
  VisitSource(path, source, node => {
    if (!ts.isIdentifier(node) || node.text !== 'packageContentSecurityPolicy') return;
    if (ts.isVariableDeclaration(node.parent) && node.parent.name === node) declarations.push(node.parent.initializer);
    else references.push(node.parent);
  });
  assert.equal(declarations.length, 1, 'package CSP must have one declaration');
  const policy = declarations[0];
  assert.ok(policy && ts.isCallExpression(policy) && ts.isPropertyAccessExpression(policy.expression)
    && policy.expression.name.text === 'join' && ts.isArrayLiteralExpression(policy.expression.expression), 'expected package CSP directive list');
  const directives = policy.expression.expression.elements.map(directive => {
    assert.ok(ts.isStringLiteral(directive), 'CSP directives must be static strings');
    return directive.text;
  });
  const names = directives.map(directive => directive.split(' ')[0]);
  assert.equal(new Set(names).size, names.length, 'duplicate package CSP directive');
  for (const directive of ["default-src 'none'", "connect-src 'none'", "child-src 'none'", "frame-src 'none'", "form-action 'none'",
    "object-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "webrtc 'block'", "worker-src 'none'", 'sandbox allow-scripts']) {
    assert.ok(directives.includes(directive), `package CSP is missing ${directive}`);
  }
  assert.doesNotMatch(directives.join('; '), /unsafe-eval|frame-ancestors/);
  assert.ok(references.some(node => ts.isCallExpression(node) && node.expression.getText() === 'DocumentHeaders'),
    'package responses must consume the policy declaration');
}

test('the package CSP has one restrictive policy used by package responses', () => {
  const source = read(runnerRoute);
  assert.throws(() => CheckPackageCsp(runnerRoute, source.replace("connect-src 'none'", "connect-src 'self'")), /connect-src/);
  assert.throws(() => CheckPackageCsp(runnerRoute, source.replace('    packageContentSecurityPolicy,', '    launcherPolicy,')), /consume/);
  CheckPackageCsp(runnerRoute, source);
});

function CheckNoRetiredHost(path, source) {
  assert.doesNotMatch(source, /\b(?:motor|vision|brain|mouth)\.trainerhub\.cc\b/i, path);
}

test('retired trainer hostnames cannot return to shipped source, assets or deployment configuration', () => {
  assert.throws(() => CheckNoRetiredHost('fixture.ts', 'export const canonical = "https://vision.trainerhub.cc/";'), /fixture/);
  for (const path of TrackedSources(['apps', 'packages', 'workers', '.github', 'scripts'], /\.(?:[cm]?[jt]sx?|html?|css|jsonc?|toml|ya?ml|txt|xml|webmanifest)$|\/(?:_redirects|_headers)$/)) {
    CheckNoRetiredHost(path, read(path));
  }
});

function CheckOfficialRegistry(registry) {
  for (const [id, entry] of Object.entries(registry)) {
    assert.deepEqual(Object.keys(entry).sort(), ['name', 'origin'], `${id}: registry may only name the game and its trusted origin`);
  }
}

test('the official registry has no current version or release hash', () => {
  assert.throws(() => CheckOfficialRegistry({ game: { name: 'Game', origin: 'https://runner.example', currentVersion: '1.0.0' } }), /registry may only/);
  CheckOfficialRegistry(JSON.parse(read('packages/ui/src/officialGameReleases.json')));
});

function CheckMigrationNumbers(files) {
  const migrations = files.filter(file => file.endsWith('.sql')).sort();
  assert.ok(migrations.length, 'expected numbered D1 migrations');
  for (const [index, file] of migrations.entries()) {
    const prefix = String(index + 1).padStart(4, '0');
    assert.match(file, new RegExp(`^${prefix}_[a-z0-9]+(?:_[a-z0-9]+)*\\.sql$`), `D1 migration ${file} must have sequence number ${prefix}`);
  }
}

test('D1 migration numbers are unique and contiguous from 0001', () => {
  assert.throws(() => CheckMigrationNumbers(['0001_auth.sql', '0003_games.sql']), /sequence number 0002/);
  assert.throws(() => CheckMigrationNumbers(['0001_auth.sql', '0001_duplicate.sql']), /sequence number 0002/);
  CheckMigrationNumbers(readdirSync(resolve(root, hub, 'migrations')));
});

function CheckFunctionSyntax(path, source) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${path}: ${result.stderr}`);
}

test('Hub and runner Cloudflare Functions pass the Node module syntax check', () => {
  assert.throws(() => CheckFunctionSyntax('fixture.js', 'export function onRequest( {}'), /SyntaxError/);
  for (const path of TrackedSources([`${hub}/functions`, `${runner}/functions`], /\.[cm]?js$/)) {
    CheckFunctionSyntax(path, read(path));
  }
});

const strongClaims = /保證療效|臨床級|醫療級|執業職能治療師|治療師審閱|醫療器材認證|醫囑|治療處方|個別化職能治療服務|預防疾病|(?:恢復|改善)人體功能|\b(?:clinically proven|clinical[- ]grade|medical[- ]grade|board[- ]certified|therapist[- ]reviewed|guaranteed (?:clinical results|therapeutic benefits)|FDA[- ]approved)\b/gi;
const medicalUse = /診斷服務|個別評估服務|治療服務|開立處方|(?:預防|改善|恢復)(?:疾病|視力|認知功能|人體功能)|(?:提供|開始|接受|預約|(?<!職)能|可以)(?:個別評估|診斷|治療|處方)|\b(?:diagnos(?:is|tic) service|treatment service|individuali[sz]ed assessment|prevents? disease|restores? vision|improves? human function|prescribe[sd]? (?:medicine|treatment)|(?:treats?|cures?) (?:stroke|disease|adhd))\b/gi;
const nonService = /不(?:是|作為|用於|提供|代表|等同|可|能|涉及|會|得|宣稱|構成|保證|建立)|並非|僅供|無法(?:取代|代表)|\b(?:not|cannot|no|neither|never)\b/i;

function CheckPublicCopy(path, source) {
  VisitSource(path, source, node => {
    if (!ts.isStringLiteralLike(node) && !ts.isJsxText(node) && !ts.isTemplateHead(node)
      && !ts.isTemplateMiddle(node) && !ts.isTemplateTail(node)) return;
    const parent = node.parent;
    if (parent.name === node || ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return;
    if (ts.isJsxAttribute(parent) && !/^(?:title|alt|placeholder|aria-label|aria-description)$/.test(parent.name.getText())) return;
    const text = node.text.trim();
    const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
    assert.ok(!/\b(?:[\w-]+\.)?104\.com\.tw\b/i.test(text), `${path}:${line} exposes a 104 URL`);
    for (const sentence of text.split(/[。！？!?\n]+|\.\s+/)) {
      for (const claim of [...sentence.matchAll(strongClaims), ...sentence.matchAll(medicalUse)]) {
        const preceding = sentence.slice(0, claim.index);
        if (preceding.endsWith('不') || nonService.test(preceding)) continue;
        assert.fail(`${path}:${line} has a medical advertising phrase (${claim[0]})`);
      }
    }
  });
}

test('public Hub strings use practice wording and keep private resumes out of copy', () => {
  const fixture = `${hub}/app/fixture.tsx`;
  assert.throws(() => CheckPublicCopy(fixture, 'export const headline = "保證療效";'), /medical advertising phrase/);
  assert.throws(() => CheckPublicCopy(fixture, '<h1>診斷服務</h1>'), /medical advertising phrase/);
  assert.throws(() => CheckPublicCopy(fixture, "export const en = { cta: 'Clinically proven to treat stroke' };"), /medical advertising phrase/);
  assert.throws(() => CheckPublicCopy(fixture, 'const url = "https://www.104.com.tw/profile/";'), /104 URL/);
  CheckPublicCopy(fixture, '<p>居家練習遊戲。不提供個別評估、診斷或治療。</p>');
  CheckPublicCopy(fixture, '<p>作者具有職能治療背景。</p>');
  for (const path of TrackedSources([`${hub}/app`], /\.[cm]?[jt]sx?$/)) {
    if (!path.startsWith(`${hub}/app/admin/`)) CheckPublicCopy(path, read(path));
  }
});

const tokenStyles = new Map([
  [`${hub}/app/globals.css`, ':root'],
  ['packages/ui/src/legacy-color-tokens.css', ':where(:root)'],
]);
const cssColorNames = Object.keys(colorNames).join('|');
const literalColor = new RegExp(`#[\\da-f]{3,8}\\b|(?<![\\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk)\\(|(?<![\\w-])(?:${cssColorNames})(?![\\w-])`, 'i');

function HardcodedColors(path, source) {
  const literals = [];
  const tokenSelector = tokenStyles.get(path);
  postcss.parse(source, { from: path }).walkDecls(declaration => {
    const unquoted = declaration.value.replace(/url\([^)]*\)|"[^"]*"|'[^']*'/gi, '').replace(/\bvar\(\s*--[\w-]+/gi, 'var(');
    const color = literalColor.exec(unquoted);
    if (!color || (tokenSelector && declaration.parent.selector === tokenSelector && declaration.prop.startsWith('--'))) return;
    const selector = declaration.parent.selector ?? `@${declaration.parent.name}`;
    literals.push(`${path} | ${selector.replace(/\s+/g, ' ')} | ${declaration.prop}: ${declaration.value}`);
  });
  return literals;
}

test('Hub and shared package CSS use theme tokens for colors', () => {
  const fixture = `${hub}/app/fixture.css`;
  assert.deepEqual(HardcodedColors(fixture, '#abc { color: var(--accent-blue); background: url(/icon.svg#aaa) }'), []);
  assert.deepEqual(HardcodedColors(fixture, `
    .banner {
      color: #abc;
      background: rgb(3 4 5);
      border-color: tomato;
      outline-color: color-mix(in srgb, var(--accent) 50%, white);
      box-shadow: var(--shadow-card, 0 1px 4px rgba(0, 0, 0, 0.02));
    }
  `), [
    `${fixture} | .banner | color: #abc`, `${fixture} | .banner | background: rgb(3 4 5)`, `${fixture} | .banner | border-color: tomato`,
    `${fixture} | .banner | outline-color: color-mix(in srgb, var(--accent) 50%, white)`,
    `${fixture} | .banner | box-shadow: var(--shadow-card, 0 1px 4px rgba(0, 0, 0, 0.02))`,
  ]);
  const literals = TrackedSources([hub, 'packages'], /\.css$/)
    .filter(path => !path.startsWith(`${hub}/games/`)).flatMap(path => HardcodedColors(path, read(path)));
  assert.deepEqual(literals.sort(), [], 'use theme tokens in these declarations');
  assert.deepEqual(JSON.parse(read('scripts/legacy-css-colors.json')), [], 'the legacy color allowlist must stay empty');
});

function CheckTrainingPanelCss(path, source) {
  postcss.parse(source, { from: path }).walkRules(rule => {
    if (!/\.training-panel(?![\w-])/.test(rule.selector)) return;
    for (const decl of rule.nodes) {
      if (decl.type !== 'decl' || decl.prop !== 'font-weight') continue;
      const weight = decl.value === 'normal' ? 400 : Number(decl.value);
      assert.ok(Number.isNaN(weight) || weight >= 700, `${path}: ${rule.selector} declares font weight ${decl.value}`);
    }
  });
}

function CheckTrainingPanelMarkup(path, source) {
  VisitSource(path, source, node => {
    if (!ts.isJsxElement(node) || !/\btraining-panel\b/.test(node.openingElement.attributes.getText())) return;
    function CheckChild(child) {
      if (ts.isJsxElement(child)) {
        const element = child.openingElement;
        const tag = element.tagName.getText();
        if (/^(?:div|span)$/.test(tag)) {
          assert.doesNotMatch(element.attributes.getText(), /role=["']heading["']|\btraining-panel-(?:title|subtitle|description)\b/,
            `${path}: use native headings and paragraphs in training panels`);
        }
      }
      ts.forEachChild(child, CheckChild);
    }
    ts.forEachChild(node, CheckChild);
  });
}

test('training panels retain native headings and a minimum explicit text weight of 700', () => {
  assert.throws(() => CheckTrainingPanelCss('panel.css', '.training-panel p { font-weight: 600 }'), /font weight 600/);
  assert.throws(() => CheckTrainingPanelMarkup('panel.tsx', '<section className="training-panel"><div role="heading">Setup</div></section>'), /native headings/);
  for (const path of TrackedSources([`${hub}/games`, 'packages/ui/src'], /\.(?:css|tsx)$/)) {
    if (path.endsWith('.css')) CheckTrainingPanelCss(path, read(path));
    else CheckTrainingPanelMarkup(path, read(path));
  }
});

const secretLiteral = /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z\d]{30,}|github_pat_[A-Za-z\d_]{30,}|AKIA[A-Z\d]{16}|sk-(?:proj-|live_)?[A-Za-z\d_-]{32,}|AIza[A-Za-z\d_-]{35})\b/;
const secretEnv = /\b(?:NEXT_PUBLIC_[A-Z\d_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|API_KEY)|(?:AUTH_(?:SESSION|STATE)_SECRET|JWT_SECRET|GOOGLE_CLIENT_SECRET|BLOGGER_API_KEY|PCLOUD_ACCESS_TOKEN|TURNSTILE_SECRET_KEY|GITHUB_APP_PRIVATE_KEY))\b/;

function CheckFrontendSecrets(path, source) {
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    assert.ok(!secretLiteral.test(line) && !secretEnv.test(line), `${path}:${index + 1} contains a frontend secret pattern`);
  }
}

test('frontend files do not expose private keys, credential values or server-only variables', () => {
  assert.throws(() => CheckFrontendSecrets('fixture.tsx', 'const secret = process.env.NEXT_PUBLIC_OAUTH_CLIENT_SECRET;'), /frontend secret pattern/);
  assert.throws(() => CheckFrontendSecrets('fixture.tsx', `const token = 'ghp_${'a'.repeat(36)}';`), /frontend secret pattern/);
  for (const path of TrackedSources([`${hub}/app`, `${hub}/games`, `${hub}/public`, `${hub}/next.config.mjs`, 'packages', `${runner}/runtime`, `${runner}/public`],
    /\.(?:[cm]?[jt]sx?|html?|jsonc?)$/)) {
    CheckFrontendSecrets(path, read(path));
  }
});

function CheckCommitSubject(subject) {
  assert.match(subject, /^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([\w./-]+\))?!?: \S[^\r\n]*$/,
    'use a Conventional Commit subject');
}

test('a directly checked out commit uses a Conventional Commit subject', context => {
  assert.throws(() => CheckCommitSubject('update tests'), /Conventional Commit/);
  if (process.env.GITHUB_EVENT_NAME === 'pull_request' && /^refs\/pull\/\d+\/merge$/.test(process.env.GITHUB_REF ?? '')) {
    context.skip('The shallow PR checkout contains GitHub’s synthesized merge commit.');
    return;
  }
  const subject = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: root, encoding: 'utf8' }).trimEnd();
  CheckCommitSubject(subject);
});

const originalGameExemptions = new Set(`antisaccade asteroid-shield attention-network-task attentional-blink card-sorting complex-search conjunction-search
connect4 continuous-performance digit-span divided-attention dots-and-boxes drawing-defense driving-rehab every-ball-response exploratory-saccade
flanker gabor-patching gesture-battler go-nogo hart-chart hex hex-schulte keep-track letter-memory lights-out maze memory-match minesweeper
motor-cortex-rehab moving-card n-back number-letter oculomotor-training pattern-memory plus-minus popout-search reaction-time reading-training
sart schulte-grid seagull-flight simon-says simon-task sliding-puzzle spatial-span stop-signal stroop sudoku tic-tac-toe time-perception
tongue-catch tower-of-london ufov whack-a-mole`.split(/\s+/));

function CheckFrozenGameExemptions(actual, activeGames) {
  assert.deepEqual(actual.filter(id => !originalGameExemptions.has(id)), [], 'do not add to the frozen legacy GDD list');
  assert.deepEqual(actual.sort(), activeGames.filter(id => originalGameExemptions.has(id)).sort(),
    'remove a frozen GDD exemption only when its game is removed');
}

test('the frozen GDD exemption list cannot add new games or remove active exemptions', () => {
  assert.throws(() => CheckFrozenGameExemptions(['new-game'], ['new-game']), /do not add/);
  assert.throws(() => CheckFrozenGameExemptions([], ['gabor-patching']), /only when its game is removed/);
  const actual = JSON.parse(read('scripts/game-team-legacy-games.json'));
  const activeGames = readdirSync(resolve(root, hub, 'games'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  CheckFrozenGameExemptions(actual, activeGames);
});

function CheckInstructionTriggers(workflow) {
  const prPaths = workflow.match(/^  pull_request:\s*\n    paths:\s*\n((?:      - [^\n]+\n)+)/m)?.[1] ?? '';
  for (const file of ['AGENTS.md', 'CLAUDE.md']) assert.ok(prPaths.includes(`- "${file}"`), `PR CI must check ${file}`);
}

test('PR verification includes the two root instruction files', () => {
  const workflow = read('.github/workflows/ci.yml').replaceAll('\r\n', '\n');
  assert.throws(() => CheckInstructionTriggers('on:\n  pull_request:\n    paths:\n      - "AGENTS.md"\n'), /must check CLAUDE.md/);
  CheckInstructionTriggers(workflow);
});

function CheckHubMetadata(brand, seo, home, layout, faq) {
  assert.match(brand, /\bhubLocalName\s*=\s*['"]居家訓練網['"]/);
  assert.match(brand, /\bhubSeoDescriptor\s*=\s*['"]居家訓練工具與衛教資訊['"]/);
  assert.match(home, /\btitle:\s*hubSeoTitle\b/, 'home metadata must use the brand title');
  assert.match(home, /\bdescription:\s*siteDescription\b/);
  assert.match(layout, /\bmetadataBase:\s*new URL\(siteUrls\.hub\)/);
  assert.match(seo, /\bhubUrl\s*=\s*`\$\{siteUrls\.hub\}\//);
  assert.doesNotMatch(seo, /\breviewedBy\b/, 'a review claim requires verified page-specific review evidence');
  assert.doesNotMatch(faq, /\bProfilePage\b/, 'the mixed FAQ is not a ProfilePage');
}

test('Hub metadata draws from its canonical origin and brand and keeps the FAQ out of ProfilePage schema', () => {
  const inputs = ['hubBrand.ts', 'seo.ts', 'page.tsx', 'layout.tsx', 'qa/page.tsx'].map(file => read(`${hub}/app/${file}`));
  const [brand, seo, home, layout, faq] = inputs;
  assert.throws(() => CheckHubMetadata(brand, seo, home.replace('title: hubSeoTitle', 'title: "Custom title"'), layout, faq), /brand title/);
  assert.throws(() => CheckHubMetadata(brand, `${seo}\nconst schema = { reviewedBy: "Reviewer" };`, home, layout, faq), /review claim/);
  assert.throws(() => CheckHubMetadata(brand, seo, home, layout, `${faq}\nconst schema = { "@type": "ProfilePage" };`), /FAQ/);
  CheckHubMetadata(...inputs);
});
