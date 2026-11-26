import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as results from '../apps/rehabtrainerhub/app/lobbyResults.js';
import * as recommendations from '../apps/rehabtrainerhub/app/lobbyRecommendations.js';
import featureIndex from '../apps/rehabtrainerhub/recommendation/generated/featureIndex.json' with { type: 'json' };

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const installStylesheet = new URL('../packages/ui/src/components/InstallAppPage.css', import.meta.url);
const siteStylesheets = [new URL('globals.css', appRoot), new URL('practicePlans.css', appRoot), installStylesheet];

function StyleRules(css, selector) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some(value => value.trim() === selector))
    .map(([, , declarations]) => declarations);
}

const lobbySelectorPrefixes = [
  '.hub-', '.lobby-', '.module-', '.filter-', '.pagination', '.result-', '.active-filter',
  '.catalog-load-notice', '.community-game', '.official-game', '.assigned-practice',
  '.account-menu', '.account-button', '.account-popover', '.account-avatar',
];

function LobbyRules(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) => selectors.split(',')
    .map(selector => selector.trim())
    .filter(selector => ['h1', 'h2', 'h3', 'body'].includes(selector)
      || lobbySelectorPrefixes.some(prefix => selector.includes(prefix)))
    .map(selector => ({ selector, body })));
}

function SiteRules(css) {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([, selectors, body]) => selectors.split(',').map(selector => ({ selector: selector.trim(), body })));
}

test('every site text size uses a type role while verified glyph selectors keep their sizes', async () => {
  const failures = [];
  for (const file of siteStylesheets) {
    const css = await readFile(file, 'utf8');
    for (const { selector, body } of SiteRules(css)) {
      if (/material-symbols-outlined|-icon\b|\bsvg\b/.test(selector)) continue;
      for (const [, value] of body.matchAll(/\bfont-size:\s*([^;]+);/g)) {
        const token = /^var\(--type-(display|headline|title|body|label)\)$/;
        const clamp = /^clamp\(var\(--type-(display|headline|title|body|label)\),\s*[\d.]+vw,\s*var\(--type-(display|headline|title|body|label)\)\)$/;
        if (!token.test(value.trim()) && !clamp.test(value.trim()) && !/^(inherit|100%)$/.test(value.trim())) {
          failures.push(`${file} ${selector}: ${value}`);
        }
      }
    }
  }
  assert.deepEqual(failures, [], 'Site text must use the shared roles with a 14px label floor.');
});

test('Hub page headings and install instructions omit eyebrow labels and their obsolete styles', async () => {
  const files = (await readdir(appRoot, { recursive: true })).filter(file => file.endsWith('.tsx'));
  const failures = [];
  for (const file of files) {
    const source = await readFile(new URL(file.replaceAll('\\', '/'), appRoot), 'utf8');
    if (/\b(?:page-kicker|install-app-kicker|eyebrow)\b/.test(source)) failures.push(file);
  }
  const install = await readFile(new URL('../packages/ui/src/components/InstallAppPage.tsx', import.meta.url), 'utf8');
  if (/\b(?:page-kicker|install-app-kicker|eyebrow)\b/.test(install)) failures.push('InstallAppPage.tsx');
  for (const file of siteStylesheets) {
    const css = await readFile(file, 'utf8');
    if (/\.(?:page-kicker|install-app-kicker)\b/.test(css)) failures.push(file.pathname);
  }
  assert.deepEqual(failures, []);
});

test('Hub notices and metrics use full borders instead of decorative side stripes', async () => {
  const failures = [];
  for (const file of siteStylesheets) {
    const css = await readFile(file, 'utf8');
    for (const { selector, body } of SiteRules(css)) {
      for (const [, property, value] of body.matchAll(/\b(border-(?:left|right|inline-start|inline-end)(?:-width)?):\s*([^;]+);/g)) {
        const pixels = value.match(/^([\d.]+)px\b/);
        if (pixels && Number(pixels[1]) > 1) failures.push(`${selector}: ${property}: ${value}`);
      }
    }
    if (/\.progress-metrics article(?::nth-child\([^)]*\))?::before/.test(css)) failures.push('progress metric stripe pseudo-element');
  }
  assert.deepEqual(failures, []);
});

test('fixed width checkboxes in flex labels retain their width', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const candidates = SiteRules(css).filter(({ selector, body }) => {
    const parent = selector.match(/^(.*?)\s+(?:>\s*)?input(?:\[type=["']?(?:checkbox|radio)["']?\])?$/)?.[1];
    if (!parent || !/(?:^|;)\s*width:\s*\d+(?:\.\d+)?px\s*;/.test(body)) return false;
    return [parent, `${parent} label`].some(label => StyleRules(css, label)
      .some(rule => /(?:^|;)\s*display:\s*(?:inline-)?flex\s*;/.test(rule)));
  });
  for (const selector of ['.admin-game-evidence input', '.filter-option input',
    '.developer-capabilities input', '.developer-confirmation input']) {
    assert.ok(candidates.some(candidate => candidate.selector === selector), `Missing ${selector}`);
  }
  assert.deepEqual(candidates.filter(({ body }) => !/(?:^|;)\s*(?:flex:\s*none|flex-shrink:\s*0)\s*;/.test(body))
    .map(({ selector }) => selector), [], 'Fixed width checkbox and radio inputs must not shrink in flex labels.');
});

test('admin release sections and findings use dividers instead of nested boxes', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const selectors = ['.admin-game-release details', '.admin-game-public-metadata', '.admin-game-findings li'];
  const failures = [];
  for (const selector of selectors) {
    const rules = StyleRules(css, selector);
    assert.ok(rules.length, `Missing ${selector}`);
    for (const body of rules) {
      for (const [, property, value] of body.matchAll(/(?:^|(?<=;))\s*([\w-]+)\s*:\s*([^;]+);/g)) {
        if (/^(?:background(?:-.+)?|border-radius|border)$/.test(property)
          || (property.startsWith('border-') && (property !== 'border-top' || value.trim() !== '1px solid var(--border)'))) {
          failures.push(`${selector}: ${property}: ${value.trim()}`);
        }
      }
    }
  }
  assert.deepEqual(failures, [], 'Release sections and finding rows must not render as boxes.');
  for (const selector of selectors.slice(0, 2)) {
    const body = StyleRules(css, selector).join('\n');
    assert.match(body, /padding-top:\s*16px;/, selector);
    assert.match(body, /border-top:\s*1px solid var\(--border\);/, selector);
    assert.doesNotMatch(body, /(?:^|;)\s*padding\s*:/, selector);
  }
  assert.match(StyleRules(css, '.admin-game-findings').join('\n'), /gap:\s*0;/);
  assert.match(StyleRules(css, '.admin-game-findings li').join('\n'), /padding:\s*10px 0;/);
  assert.match(StyleRules(css, '.admin-game-findings li + li').join('\n'), /border-top:\s*1px solid var\(--border\);/);
  assert.match(StyleRules(css, '.admin-game-findings li strong').join('\n'), /color:\s*var\(--error\);/);
  assert.match(StyleRules(css, '.admin-game-release').join('\n'), /border:\s*1px solid var\(--border\);/);
});

test('monospace is reserved for actual code while numbered developer labels use body type', async () => {
  const failures = [];
  for (const file of siteStylesheets) {
    for (const { selector, body } of SiteRules(await readFile(file, 'utf8'))) {
      if (/font-family:\s*[^;]*monospace/.test(body) && !/(?:^|[\s>+~])(?:pre|code)\b/.test(selector)) failures.push(selector);
    }
  }
  assert.deepEqual(failures, []);
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const selector of ['.developer-docs-sidebar a span', '.developer-route-number', '.developer-step-list li > span',
    '.developer-flow span', '.developer-number-list li::before']) {
    const rule = StyleRules(css, selector).join('\n');
    assert.match(rule, /font-family:\s*inherit;/, selector);
    assert.match(rule, /font-variant-numeric:\s*tabular-nums;/, selector);
  }
});

test('progress and install cards rest flat while achieved status remains visible in text', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const selector of ['.progress-metrics article', '.achievement-grid article.is-achieved']) {
    assert.doesNotMatch(StyleRules(css, selector).join('\n'), /box-shadow\s*:/, selector);
  }
  assert.doesNotMatch(StyleRules(await readFile(installStylesheet, 'utf8'), '.install-guide-card').join('\n'), /box-shadow\s*:/);
  const progress = await readFile(new URL('progress/ProgressDashboard.tsx', appRoot), 'utf8');
  assert.match(progress, /achievement\.achieved\s*\?\s*copy\.achieved\s*:\s*t\('progress\.daysToGo'/);
});

test('browser theme metadata matches the Hub surface and background palette', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const root = css.match(/:root\s*\{([^}]+)\}/)[1];
  const surface = root.match(/--surface:\s*(#[\da-f]+);/i)[1];
  const background = root.match(/--background:\s*(#[\da-f]+);/i)[1];
  const layout = await readFile(new URL('layout.tsx', appRoot), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', appRoot), 'utf8'));
  assert.equal(layout.match(/themeColor:\s*['"]([^'"]+)/)[1], surface);
  assert.equal(manifest.theme_color, surface);
  assert.equal(manifest.background_color, background);
});

test('removed heading labels leave no unused copy keys and retain the lobby guide navigation label', async () => {
  for (const language of ['zh-TW', 'en']) {
    const loaded = { exports: {} };
    new Function('exports', ts.transpileModule(await readFile(new URL(`i18n/${language}.ts`, appRoot), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText)(loaded.exports);
    const copy = (loaded.exports.zhTW ?? loaded.exports.en).hubUi;
    for (const [section, keys] of Object.entries({
      about: ['kicker', 'purposeKicker', 'platformKicker', 'responsibilityKicker', 'contactKicker'],
      progress: ['kicker', 'today', 'milestones'],
      questions: ['kicker', 'aboutKicker', 'professionalKicker'], educationArticles: ['kicker'],
    })) for (const key of keys) assert.equal(Object.hasOwn(copy[section], key), false, `${language}.${section}.${key}`);
    assert.ok(copy.lobby.guide.kicker);
    assert.equal(copy.progress.recentlyPlayed, language === 'en' ? 'Recently played' : '近期遊玩',
      'The recent activity heading still uses this copy key.');
  }
  const progress = await readFile(new URL('progress/ProgressDashboard.tsx', appRoot), 'utf8');
  assert.match(progress, /<h2 id="recent-modules-title">\{copy\.recentlyPlayed\}<\/h2>/);
  const developer = await readFile(new URL('developer/developerCopy.ts', appRoot), 'utf8');
  assert.doesNotMatch(developer, /\b(?:eyebrow|kicker|releasesEyebrow):/);
});

test('the progress H1 matches its navigation label and keeps the daily tasks feature name in both languages', async () => {
  const progress = await readFile(new URL('progress/ProgressDashboard.tsx', appRoot), 'utf8');
  assert.match(progress, /<h1>\{copy\.title\}<\/h1>/);
  for (const language of ['zh-TW', 'en']) {
    const loaded = { exports: {} };
    new Function('exports', ts.transpileModule(await readFile(new URL(`i18n/${language}.ts`, appRoot), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText)(loaded.exports);
    const copy = (loaded.exports.zhTW ?? loaded.exports.en).hubUi;
    assert.equal(copy.progress.title, copy.navigation.navigationItems[4], language);
    assert.equal(copy.progress.dailyTasks, language === 'en' ? 'Daily tasks' : '每日任務', language);
  }
});

test('developer headings use their topics without sidebar label prefixes in both languages', async () => {
  const developerModule = { exports: {} };
  new Function('exports', ts.transpileModule(await readFile(new URL('developer/developerCopy.ts', appRoot), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(developerModule.exports);
  for (const language of ['zh', 'en']) {
    const developer = developerModule.exports.GetDeveloperCopy(language);
    const isEnglish = language === 'en';
    assert.deepEqual([
      developer.quickStart.title, developer.research.title, developer.accessibility.title,
      developer.submission.signedOutTitle, developer.submission.uploadTitle,
    ], isEnglish ? [
      'Game submission flow', 'Define the activity before the score', 'Provide equivalent ways to operate',
      'Sign in to submit a game', 'Upload a new version',
    ] : [
      '遊戲投稿流程', '先定義活動，再定義分數', '讓操作方式可被替代', '登入後投稿遊戲', '上傳新版本',
    ], language);
    assert.equal(developer.header.title, isEnglish ? 'Guide to building a home-practice game' : '居家練習遊戲開發指南');
    assert.equal(developer.security.title, isEnglish ? 'Behavior blocked by automated security checks' : '安全檢查會自動阻擋的行為');
  }
});

test('installation introductions explain adding the app in plain language', async () => {
  for (const language of ['zh', 'en']) {
    const installModule = { exports: {} };
    new Function('exports', ts.transpileModule(await readFile(new URL(
      `../packages/ui/src/i18n/installApp/${language}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText)(installModule.exports);
    const install = installModule.exports[language === 'en' ? 'installAppEn' : 'installAppZh'];
    assert.equal(install.intro, language === 'en'
      ? 'Add {appName} to your device, then open it directly from your home screen or app list.'
      : '將 {appName} 加到裝置，之後可從主畫面或應用程式列表直接開啟。', language);
  }
});

test('the author section separates its topic heading from the name and preserves its anchor and links', async () => {
  for (const language of ['zh-TW', 'en']) {
    const loaded = { exports: {} };
    new Function('exports', ts.transpileModule(await readFile(new URL(`i18n/${language}.ts`, appRoot), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText)(loaded.exports);
    const copy = (loaded.exports.zhTW ?? loaded.exports.en).hubUi.questions;
    assert.equal(copy.professionalTitle, language === 'en' ? 'Author background and accountability' : '作者背景與內容責任');
    assert.equal(copy.professionalName, language === 'en' ? 'Hung-En Tsai | Occupational Therapist' : '蔡泓恩｜職能治療師');
  }
  const source = await readFile(new URL('qa/QuestionsContent.tsx', appRoot), 'utf8');
  assert.match(source, /id="professional-background"/);
  assert.match(source, /<h2 id="professional-background-title">\{copy\.professionalTitle\}<\/h2>\s*<p><strong>\{copy\.professionalName\}<\/strong><\/p>/);
  assert.match(source, /<a href=\{personalWebsiteUrl\} rel="me">/);
});

test('version identifiers follow their headings and the missing page starts directly with its H1', async () => {
  const portal = await readFile(new URL('developer/DeveloperPortal.tsx', appRoot), 'utf8');
  const missing = await readFile(new URL('not-found.tsx', appRoot), 'utf8');
  assert.match(portal, /<h4>\{game\.title\}<\/h4>\s*<p>\{game\.slug\}<\/p>/);
  assert.match(missing, /<main\b[^>]*>\s*<h1>找不到頁面<\/h1>/);
  assert.doesNotMatch(missing, /<p>404<\/p>/);
});

test('shared elevation shadows only mark floating layers and the phone filter sheet', async () => {
  const allowed = new Set(['.account-popover', '.embedded-training-bar', '.package-game-toolbar', '.hub-language-toggle img']);
  const failures = [];
  for (const file of siteStylesheets) {
    const css = await readFile(file, 'utf8');
    const phone = css.match(/@media \(max-width: 1023px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    for (const { selector, body } of SiteRules(css)) {
      if (!/box-shadow:\s*[^;]*var\(--shadow-(?:sm|md)\)/.test(body)) continue;
      if (allowed.has(selector)) continue;
      if (selector === '.filter-panel' && StyleRules(phone, selector).includes(body) && /position:\s*fixed;/.test(body)) continue;
      failures.push(selector);
    }
  }
  assert.deepEqual(failures, [], 'Resting surfaces must not use elevation shadows.');
});

test('admin panels place their content directly on the page without an outer card', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  assert.doesNotMatch(StyleRules(css, '.admin-tab-panel').join('\n'), /\b(?:border(?:-[\w-]+)?|background(?:-[\w-]+)?|box-shadow|padding(?:-[\w-]+)?):/);
  assert.match(StyleRules(css, '.admin-tabs').join('\n'), /border:\s*1px solid var\(--border\);/);
});

test('every rendered Hub icon is present in the documented local font subset', async () => {
  const readme = await readFile(new URL('../public/fonts/README.md', appRoot), 'utf8');
  const names = readme.match(/icon_names=([^&\s)]+)/)[1].split(',');
  assert.deepEqual(names, [...new Set(names)].sort(), 'The subset name list must be sorted and unique.');
  const rendered = new Set();
  function CollectRenderedNames(node) {
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const name = node.text.trim();
      if (/^[a-z]+(?:_[a-z]+)*$/.test(name)) rendered.add(name);
    } else if (ts.isJsxExpression(node) && node.expression) {
      CollectRenderedNames(node.expression);
    } else if (ts.isParenthesizedExpression(node)) {
      CollectRenderedNames(node.expression);
    } else if (ts.isConditionalExpression(node)) {
      CollectRenderedNames(node.whenTrue);
      CollectRenderedNames(node.whenFalse);
    }
  }
  const files = (await readdir(appRoot, { recursive: true })).filter(file => file.endsWith('.tsx'))
    .map(file => new URL(file.replaceAll('\\', '/'), appRoot));
  files.push(new URL('../packages/ui/src/components/InstallAppPage.tsx', import.meta.url));
  for (const file of files) {
    const source = ts.createSourceFile(file.pathname, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function Visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'span'
        && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
          && attribute.name.getText(source) === 'className' && attribute.initializer
          && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text.split(/\s+/).includes('material-symbols-outlined'))) {
        node.children.forEach(CollectRenderedNames);
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(source).replace(/['"]/g, '') === 'icon'
        && ts.isStringLiteral(node.initializer)) CollectRenderedNames(node.initializer);
      ts.forEachChild(node, Visit);
    }
    Visit(source);
  }
  assert.deepEqual([...rendered].filter(name => !names.includes(name)).sort(), [], 'Rendered icon names missing from the local subset.');
  const font = await readFile(new URL('../public/fonts/material-symbols-hub.woff2', appRoot));
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  assert.equal(font.length, Number(readme.match(/([\d,]+)-byte subset/)[1].replaceAll(',', '')));
});

test('admin KPI units declare the label role instead of inheriting the browser smaller size', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  assert.match(StyleRules(css, '.admin-kpi-grid small').join('\n'), /font-size:\s*var\(--type-label\);/);
});

test('display type is reserved for page H1s and progress metric numbers at every width', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const failures = SiteRules(css).filter(({ selector, body }) => /font-size:\s*[^;]*var\(--type-display\)/.test(body)
    && selector !== '.progress-metrics strong'
    && !/(?:^|[\s>+~])h1(?::lang\([^)]*\))?$/.test(selector));
  assert.deepEqual(failures.map(({ selector }) => selector), []);
});

test('developer section headings, running text and the link arrow retain their semantic type roles', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const [selector, role] of [
    ['.developer-doc-section > header h2', 'headline'],
    ['.developer-hero > div > p:last-child', 'body'],
    ['.developer-section-link span', 'title'],
  ]) {
    const sizes = StyleRules(css, selector).flatMap(body => [...body.matchAll(/font-size:\s*([^;]+);/g)].map(([, value]) => value));
    assert.ok(sizes.length > 0, selector);
    assert.ok(sizes.every(value => value === `var(--type-${role})`), `${selector}: ${sizes.join(', ')}`);
  }
});

test('phone developer grids can shrink below long paths and route descriptions wrap those paths', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 640px)', css.indexOf('.developer-page {')));
  const selectors = ['.developer-route-grid', '.developer-research-grid', '.developer-environment-grid',
    '.developer-prompt-builder form', '.developer-definition-list > div'];
  const sharedRules = [...phone.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, header]) => selectors.every(selector => header.split(',').map(value => value.trim()).includes(selector)));
  assert.equal(sharedRules.length, 1);
  assert.match(sharedRules[0][2], /grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(StyleRules(css, '.developer-route-grid p').join('\n'), /overflow-wrap:\s*anywhere;/);
});

test('site colors use shared tokens outside the two root palettes', async () => {
  const failures = [];
  for (const file of siteStylesheets) {
    const css = await readFile(file, 'utf8');
    for (const { selector, body } of SiteRules(css)) {
      if (selector === ':root') continue;
      if (/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\s*\(/i.test(body)) failures.push(`${file} ${selector}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('the Hub declares five type roles in its first root block and reuses them for lobby text', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const root = css.match(/:root\s*\{([^}]*)\}/)[1];
  for (const [role, value] of Object.entries({ display: '2.8125rem', headline: '1.875rem', title: '1.375rem', body: '1rem', label: '0.875rem' })) {
    assert.match(root, new RegExp(`--type-${role}:\\s*${value.replace('.', '\\.')}\\s*;`));
  }
  const modern = css.match(/@supports\s*\(color:\s*oklch\([^)]*\)\)\s*\{\s*:root\s*\{([^}]+)\}/)[1];
  assert.doesNotMatch(modern, /--type-/);
  assert.match(StyleRules(css, '.lobby-welcome h1').join('\n'), /clamp\(var\(--type-headline\),\s*3\.5vw,\s*var\(--type-display\)\)/);
});

test('every lobby text size uses a type role while icon glyphs retain their own sizes', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const failures = [];
  for (const { selector, body } of LobbyRules(css)) {
    for (const [, value] of body.matchAll(/\bfont-size:\s*([^;]+);/g)) {
      if (/material-symbols-outlined|-icon/.test(selector)) continue;
      const token = /^var\(--type-(display|headline|title|body|label)\)$/;
      const clamp = /^clamp\(var\(--type-(display|headline|title|body|label)\),\s*[\d.]+vw,\s*var\(--type-(display|headline|title|body|label)\)\)$/;
      if (!token.test(value.trim()) && !clamp.test(value.trim())) failures.push(`${selector}: ${value}`);
    }
  }
  assert.deepEqual(failures, [], 'Lobby text must use the five type roles, including its phone and tablet rules.');
});

test('lobby corners use the radius scale instead of literal pixel radii', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const failures = [];
  for (const { selector, body } of LobbyRules(css)) {
    for (const [, value] of body.matchAll(/\bborder(?:-[\w-]+)?-radius:\s*([^;]+);/g)) {
      if (/\d(?:\.\d+)?px\b/.test(value)) failures.push(`${selector}: ${value}`);
    }
  }
  assert.deepEqual(failures, []);
  const root = css.match(/:root\s*\{([^}]*)\}/)[1];
  for (const [role, value] of Object.entries({ sm: '4px', lg: '12px', xl: '16px', pill: '999px' })) {
    assert.match(root, new RegExp(`--radius-${role}:\\s*${value};`));
  }
  assert.match(root, /--radius-s:\s*var\(--radius\);/);
  assert.match(root, /--radius-l:\s*var\(--radius\);/);
});

test('lobby colors and shadows use Hub tokens outside the palette declarations', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const failures = LobbyRules(css).filter(({ body }) => /#[\da-f]{3,8}\b|\brgba?\(/i.test(body))
    .map(({ selector }) => selector);
  assert.deepEqual(failures, []);
});

test('lobby help, install, retry and result focus use the same visible site ring', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const selector of ['.lobby-tour-button:focus-visible', '.lobby-guide-link:focus-visible',
    '.module-card-footer a:focus-visible', '.catalog-load-notice button:focus-visible', '#result-title:focus-visible']) {
    const rule = StyleRules(css, selector).join('\n');
    assert.match(rule, /outline:\s*3px solid var\(--focus\);/, selector);
    assert.match(rule, /outline-offset:\s*3px;/, selector);
    assert.doesNotMatch(rule, /outline:\s*(?:none|0)\b/);
  }
});

test('disabled lobby filters stay muted without hover tint and use an unavailable cursor', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const selector of ['.filter-option:has(input:disabled)', '.filter-category-header:has(input:disabled)']) {
    const rule = StyleRules(css, selector).join('\n');
    assert.match(rule, /color:\s*var\(--text-muted\);/);
    assert.match(rule, /cursor:\s*not-allowed;/);
    assert.match(rule, /background:\s*transparent;/);
  }
});

test('Hub headings, body, secondary text and ordinary links use neutral dark colors', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const root = css.match(/:root\s*\{([^}]*)\}/)[1];
  for (const token of ['text', 'text-muted', 'heading', 'primary', 'primary-hover']) {
    const hex = root.match(new RegExp(`--${token}:\\s*#([a-f0-9]{6});`, 'i'))?.[1];
    assert.ok(hex, `${token} must define the Hub text color`);
    const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
    assert.equal(channels[0], channels[1], `${token} must not tint text green`);
    assert.equal(channels[1], channels[2], `${token} must be neutral`);
    assert.ok(channels[0] <= 96, `${token} must keep secondary text readable`);
  }
  for (const rule of StyleRules(css, '.hub-nav a')) {
    assert.doesNotMatch(rule, /(?:^|;)\s*color:\s*#[a-f0-9]+;/i,
      'Phone and desktop navigation must follow the same neutral text tokens');
  }
});

test('Hub descriptions and guide content can use their available column width', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const selector of [
    '.lobby-guide', '.lobby-guide > header', '.lobby-guide-details p',
    '.about-site-section p:last-child', '.about-page .page-heading > p:last-child',
    '.education-articles-source', '.education-article-summary',
    '.developer-hero h1', '.developer-hero > div > p:last-child',
    '.developer-doc-section > header', '.developer-doc-section > header h2',
    '.developer-docs-lead', '.developer-check-list',
  ]) {
    for (const rule of StyleRules(css, selector)) {
      assert.doesNotMatch(rule, /max-width:\s*[\d.]+(?:px|ch|rem)/,
        `${selector} must not leave unused space to the right inside its column`);
    }
  }
});

test('Hub headings wrap at the available edge instead of balancing into short lines', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  assert.match(StyleRules(css, 'h1').join('\n'), /text-wrap:\s*wrap;/);
  for (const selector of ['h1', 'h2', 'h3', '.developer-hero h1', '.developer-doc-section > header h2']) {
    assert.doesNotMatch(StyleRules(css, selector).join('\n'), /text-wrap:\s*balance;/, selector);
  }
});

test('category labels and selected filters keep neutral text while icons retain category colors', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const selector of [
    '.module-category-tag', '.module-theme-badge', '.lobby-filter-chip', '.filter-option:hover',
    '.recent-module-card a',
  ]) {
    assert.match(StyleRules(css, selector).join('\n'), /(?:^|;)\s*color:\s*var\(--(?:text|heading)\);/, selector);
  }
  assert.match(StyleRules(css, '.module-card-meta .module-card-theme-icon').join('\n'), /color:\s*var\(--trainer-color-dark\)/);
});

test('navigation icons keep one glyph of space while the webfont loads', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const rules = StyleRules(css, '.hub-nav-icon').join('\n');
  assert.match(rules, /width:\s*1em;/);
  assert.match(rules, /overflow:\s*hidden;/);
});

const games = Array.from({ length: 14 }, (_, index) => ({
  id: `game-${index}`, title: `Activity ${index}`, summary: 'Practice at home', author: 'Hub',
  version: '1.0.0', requirement: 'none', imageSrc: '/preview.webp',
  purpose: index < 4 ? 'attention' : 'memory', theme: { icon: { type: 'svg', value: '/logo.svg', alt: 'MotorTrainer' } },
  installUrl: `/games/game-${index}/`, launch: { contract: 'catalog-v1', module: {} },
}));

function Elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(Elements);
  return [tree, ...Elements(tree.props?.children)];
}

function Text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  if (Array.isArray(tree)) return tree.map(Text).join(' ');
  return Text(tree.props?.children);
}

function Deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

async function Settle() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

async function Lobby(language = 'en', catalog = games, { fetchCatalog = false } = {}) {
  const slots = [];
  const effects = [];
  const requests = [];
  let cursor = 0;
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  const tourCalls = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        const entry = { deps };
        slots[index] = entry;
        const isCatalogFetch = effect.toString().includes('FetchPublishedGames');
        if ((deps.length || isCatalogFetch) && (!isCatalogFetch || fetchCatalog)) {
          effects.push(() => { previous?.cleanup?.(); entry.cleanup = effect(); });
        }
      }
    },
    useCallback: callback => callback,
    useMemo: callback => callback(),
  };
  const dictionarySource = await readFile(new URL(`i18n/${language}.ts`, appRoot), 'utf8');
  const dictionary = { exports: {} };
  new Function('exports', ts.transpileModule(dictionarySource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(dictionary.exports);
  const copy = (dictionary.exports.en ?? dictionary.exports.zhTW).hubUi;
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-dom': { flushSync: update => update() },
    './hubMotion': { AnimateVisibleGameCards: () => () => {}, CancelHubGameTransition() {}, TransitionGameSurface: (_source, update) => update() },
    './i18n': { GetHubUiCopy: () => copy },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: language === 'en' ? 'en' : 'zh', locale: language, t: key => key }) },
    './gameCatalog': { BuildHubGameCatalog: (_modules, published) => [...catalog, ...published] },
    './activityLinks': await import('../apps/rehabtrainerhub/app/activityLinks.ts'),
    './publishedGames': { FetchPublishedGames: signal => {
      const request = { ...Deferred(), signal, previousAbortedOnStart: requests.map(previous => previous.signal.aborted) };
      requests.push(request);
      return request.promise;
    } },
    './tour/hubTour': { StartHubTour: (...args) => tourCalls.push(args) },
    'next/image': { default: props => ({ type: 'img', props }) },
    '@rehab-trainer/ui/components/CardImagePlaceholder': { CardImagePlaceholder: props => ({ type: 'img', props }) },
    './lobbyResults.js': results,
    './lobbyRecommendations.js': recommendations,
    './useLobbyActivityHistory': { useLobbyActivityHistory: () => [] },
    '../recommendation/generated/featureIndex.json': { default: featureIndex },
    './trainingThemeStyle': { BuildTrainingThemeStyle: () => ({}) },
    '@rehab-trainer/ui/hooks/useBottomSheet': { useBottomSheet: () => ({ dialogRef: {}, isMobile: false }) },
    '@rehab-trainer/hub-modules/catalog': {
      trainingCatalog: [], trainingPurposes: [{ id: 'attention' }, { id: 'memory' }],
      trainerCategoryTags: [{ id: 'brain', label: { en: 'Cognition', 'zh-TW': '認知' } }, { id: 'motor', label: { en: 'Movement', 'zh-TW': '動作' } }],
      categorySubcategories: { brain: ['attention', 'memory'], motor: ['hand'] },
      trainingThemes: Object.fromEntries(['attention', 'memory', 'hand'].map(id => [id, { label: { en: id, 'zh-TW': id }, icon: {} }])),
      GetTrainerCategoryTheme: () => ({}),
    },
  };
  const source = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('exports', 'require', 'document', compiled)(loaded.exports, name => dependencies[name] ?? {}, {
    activeElement: null, querySelector: () => null, head: { append() {} }, createElement: () => ({ remove() {} }),
  });
  const render = () => { cursor = 0; const tree = loaded.exports.TrainingLobby(); effects.splice(0).forEach(effect => effect()); return Elements(tree); };
  return { render, copy, dictionary: dictionary.exports, tourCalls, requests,
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}

for (const [language, loading, unavailable, retryLabel] of [
  ['zh-TW', '正在載入開發者遊戲…', '部分遊戲目前無法載入，已顯示的遊戲仍可開始。', '重新載入'],
  ['en', 'Loading developer games…', 'Some games could not be loaded. Available games can still be played.', 'Try again'],
]) {
  test(`${language} catalog loading is announced below the grid while official activities remain available`, async () => {
    const { render, requests } = await Lobby(language, [games[0]], { fetchCatalog: true });
    let elements = render();
    const headingFocus = [];
    elements.find(node => node.props?.id === 'result-title').props.ref.current = { focus: options => headingFocus.push(options) };
    assert.equal(requests.length, 1);
    const notice = elements.find(node => node.props?.className === 'catalog-load-notice');
    assert.ok(notice, 'A pending developer catalog needs a visible loading line.');
    assert.equal(notice.props.role, 'status');
    assert.ok(Text(notice).includes(loading));
    assert.ok(!Elements(notice).some(node => node.type === 'button'));
    assert.ok(elements.indexOf(notice) > elements.findIndex(node => node.props?.className === 'result-header'));
    assert.ok(elements.indexOf(notice) > elements.findIndex(node => node.props?.className === 'module-grid'));
    assert.equal(elements.filter(node => node.type === 'article').length, 1);
    const developer = { ...games[1], title: 'Developer activity', launch: { contract: 'package-v1', game: {} },
      release: { launchUrl: 'https://runner.example/games/developer/1.0.0/' } };
    requests[0].resolve([developer]); await Settle(); elements = render();
    assert.ok(!elements.some(node => node.props?.className === 'catalog-load-notice'));
    assert.ok(elements.some(node => node.type === 'h3' && Text(node) === developer.title));
    assert.deepEqual(headingFocus, [], 'The initial catalog response must not move focus.');
  });

  test(`${language} catalog errors expose a retry that aborts the old request and preserves notice focus while loading`, async () => {
    const { render, requests } = await Lobby(language, [games[0]], { fetchCatalog: true });
    render(); requests[0].reject(Error('offline')); await Settle();
    let elements = render();
    const notice = elements.find(node => node.props?.className === 'catalog-load-notice');
    assert.ok(Text(notice).includes(unavailable));
    const retry = Elements(notice).find(node => node.type === 'button' && Text(node).includes(retryLabel));
    assert.ok(retry, 'A catalog failure needs a retry button.');
    assert.equal(retry.props.type, 'button');
    assert.ok(Elements(retry).some(node => node.props?.['aria-hidden'] === 'true' && Text(node) === 'refresh'));
    assert.ok(Elements(notice).some(node => node.props?.['aria-hidden'] === 'true' && Text(node) === 'warning'));
    assert.equal(notice.props.tabIndex, -1);
    let focused = 0;
    const headingFocus = [];
    elements.find(node => node.props?.id === 'result-title').props.ref.current = { focus: options => headingFocus.push(options) };
    notice.props.ref.current = { focus() { focused += 1; } };
    retry.props.onClick(); elements = render();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1].previousAbortedOnStart, [true], 'The prior request is aborted before its replacement starts.');
    const pendingNotice = elements.find(node => node.props?.className === 'catalog-load-notice');
    assert.ok(pendingNotice, 'Retry must keep the existing region mounted.');
    assert.equal(pendingNotice.type, notice.type);
    assert.equal(pendingNotice.props.ref, notice.props.ref);
    assert.equal(focused, 1);
    assert.ok(Text(pendingNotice).includes(loading));
    assert.ok(!Text(pendingNotice).includes(unavailable));
    requests[1].resolve([]); await Settle(); elements = render();
    assert.ok(!elements.some(node => node.props?.className === 'catalog-load-notice'));
    assert.equal(elements.filter(node => node.type === 'article').length, 1);
    assert.deepEqual(headingFocus, [{ preventScroll: true }], 'A successful retry must move focus to the results heading.');
  });
}

test('unmount aborts the pending developer catalog request', async () => {
  const { render, requests, unmount } = await Lobby('en', [games[0]], { fetchCatalog: true });
  render();
  assert.equal(requests[0].signal.aborted, false);
  unmount();
  assert.equal(requests[0].signal.aborted, true);
  requests[0].reject(Error('aborted')); await Settle();
});

test('catalog failures use a neutral surface and a 44px retry without side stripes or gold fill', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const notice = StyleRules(css, '.catalog-load-notice').join('\n');
  assert.doesNotMatch(notice, /border-left:\s*(?:[2-9]|\d{2,})px/);
  assert.doesNotMatch(notice, /--gold/);
  assert.match(notice, /background:\s*var\(--surface-muted\);/);
  assert.match(notice, /border:\s*1px solid var\(--border\);/);
  assert.match(notice, /border-radius:\s*var\(--radius\);/);
  assert.match(notice, /color:\s*var\(--text\);/);
  assert.match(StyleRules(css, '.catalog-load-notice > .material-symbols-outlined').join('\n'), /color:\s*var\(--warning\);/);
  assert.match(StyleRules(css, '.catalog-load-notice button').join('\n'), /min-height:\s*44px;/);
  assert.match(StyleRules(css, '.catalog-load-notice button:focus-visible').join('\n'), /outline:\s*3px solid var\(/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)\s*\{\s*\.catalog-load-notice\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\);/);
  assert.match(StyleRules(css, '.catalog-load-notice button').join('\n'), /grid-column:\s*2;/);
});

test('catalog notices sit a grid gap below the cards and keep loading to one quiet line', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const loading = StyleRules(css, '.catalog-load-notice[data-state="loading"]').join('\n');
  assert.match(StyleRules(css, '.catalog-load-notice').join('\n'), /margin:\s*24px 0 0;/);
  assert.match(loading, /margin:\s*24px 0 0;/);
  assert.match(loading, /padding:\s*0;/);
  assert.match(loading, /border:\s*0;/);
  assert.match(loading, /color:\s*var\(--text-muted\);/);
  assert.match(StyleRules(css, '.catalog-load-notice p').join('\n'), /margin:\s*0;/);
});

test('the developer catalog notice follows every grid card and precedes pagination inside the results section', async () => {
  const { render } = await Lobby();
  const elements = render();
  const section = elements.find(node => node.props?.className === 'module-results');
  const children = section.props.children.filter(Boolean);
  const grid = children.find(node => node.props?.className === 'module-grid');
  const notice = children.find(node => node.props?.className === 'catalog-load-notice');
  const pagination = children.find(node => node.props?.className === 'lobby-pagination');
  assert.ok(notice, 'The initial loading notice belongs to the results section.');
  assert.equal(children.indexOf(notice), children.indexOf(grid) + 1);
  assert.ok(children.indexOf(notice) < children.indexOf(pagination));
  assert.ok(elements.indexOf(notice) > elements.indexOf(Elements(grid).at(-1)), 'Every card and its actions precede the notice.');
});

for (const [language, firstVisit, startTour, readGuide, noneYet] of [
  ['zh-TW', '第一次使用？', '開始網站導覽', '閱讀練習指南', '尚無'],
  ['en', 'First time here?', 'Start the site tour', 'Read the practice guide', 'None yet'],
]) {
  test(`${language} lobby link labels carry their underline separately from the icons`, async () => {
    const { render } = await Lobby(language);
    const elements = render();
    for (const node of [elements.find(node => node.props?.className === 'lobby-tour-button'),
      elements.find(node => node.type === 'a' && node.props.href === '#lobby-guide'),
      elements.find(node => node.type === 'a' && node.props.href === games[0].installUrl)]) {
      const label = Elements(node).find(child => child.props?.className === 'lobby-link-label');
      assert.ok(label, 'Only the label, rather than the neighboring icon glyph, should carry an underline.');
      assert.equal(label.type, 'span');
      assert.equal(Elements(label).some(child => child.props?.className?.includes('material-symbols-outlined')), false);
      assert.ok(Text(label).trim().length > 0);
    }
  });
  test(`${language} first visit offers a working tour and guide with the safety note visible`, async () => {
    const { render, copy, tourCalls } = await Lobby(language);
    const elements = render();
    const heading = elements.find(node => node.props?.className === 'lobby-heading');
    const content = Elements(heading);
    assert.ok(content.some(node => Text(node).includes(firstVisit)), 'The first-visit invitation stays visible.');
    const tour = content.find(node => node.type === 'button' && Text(node).includes(startTour));
    assert.ok(tour, 'The first-visit line needs a tour button.');
    assert.equal(tour.props.type, 'button');
    assert.ok(Elements(tour).some(node => node.props?.['aria-hidden'] === 'true' && Text(node) === 'explore'));
    tour.props.onClick();
    assert.deepEqual(tourCalls, [[language === 'en' ? 'en' : 'zh', { force: true }]]);
    const guide = content.find(node => node.type === 'a' && node.props.href === '#lobby-guide');
    assert.ok(Text(guide).includes(readGuide));
    assert.ok(Elements(guide).some(node => node.props?.['aria-hidden'] === 'true' && Text(node) === 'menu_book'));
    assert.ok(Text(content.find(node => node.type === 'aside')).includes(copy.lobby.intro));
    assert.equal(elements.filter(node => node.props?.className === 'page-kicker').length, 0);
    const h1 = content.find(node => node.type === 'h1');
    assert.equal(h1.props.id, 'lobby-title');
    assert.deepEqual(h1.props.children[0].props.children, [copy.lobby.kicker, ' ']);
    assert.equal(h1.props.children[0].props.className, 'sr-only');
    assert.equal(h1.props.children[1], copy.lobby.title);
    assert.ok(elements.some(node => node.type === 'nav' && node.props['aria-label'] === copy.lobby.guide.kicker));
    assert.equal(Object.hasOwn(copy.lobby, 'beforeStarting'), false);
  });

  test(`${language} cards show equipment and keep developer attribution only on developer cards`, async () => {
    const requirementCopy = language === 'en' ? {
      none: 'No camera needed', camera: 'Camera required', 'camera-optional': 'Camera optional',
      'camera-or-microphone': 'Camera or microphone required', 'camera-and-microphone': 'Camera and microphone required',
      microphone: 'Microphone required',
    } : {
      none: '不需攝影機', camera: '需要攝影機', 'camera-optional': '可選用攝影機',
      'camera-or-microphone': '需要攝影機或麥克風', 'camera-and-microphone': '需要攝影機和麥克風', microphone: '需要麥克風',
    };
    for (const [requirement, label] of Object.entries(requirementCopy)) {
      const official = { ...games[0], requirement };
      const developer = { ...games[1], requirement, launch: { contract: 'package-v1', game: {} } };
      const { render } = await Lobby(language, [official, developer]);
      const cards = render().filter(node => node.type === 'article');
      for (const [index, card] of cards.entries()) {
        const content = Elements(card);
        const equipment = content.find(node => node.props?.className === 'module-card-requirement');
        assert.ok(equipment, 'Every card must state its equipment requirement.');
        assert.ok(Text(equipment).includes(label));
        assert.ok(Elements(equipment).some(node => node.props?.['aria-hidden'] === 'true' &&
          Text(node) === (requirement === 'none' ? 'check_circle' : 'info')));
        assert.ok(content.indexOf(equipment) < content.findIndex(node => node.props?.className?.includes('module-card-footer')));
        const details = content.find(node => node.type === 'dl');
        if (index === 0) assert.equal(details, undefined, 'Official cards must omit author and version.');
        else {
          assert.ok(Text(details).includes(language === 'en' ? 'Author' : '作者'));
          assert.ok(Text(details).includes(language === 'en' ? 'Version' : '版本'));
          assert.ok(Text(details).includes(developer.author));
          assert.ok(Text(details).includes(developer.version));
        }
        const install = content.find(node => node.type === 'a');
        assert.equal(install.props.href, [official, developer][index].installUrl);
        assert.equal(install.props.target, '_blank');
        assert.equal(install.props.rel, 'noopener noreferrer');
        assert.ok(install.props['aria-label'].includes([official, developer][index].title));
        const preview = content.find(node => node.type === 'img' && node.props.src === '/preview.webp');
        assert.equal(preview.props.alt, `${[official, developer][index].title} ${language === 'en' ? 'activity screen' : '活動畫面'}`);
        assert.ok(!preview.props.alt.includes(official.summary));
        assert.ok(content.filter(node => node.type === 'img' && node.props.src === '/logo.svg').every(node => node.props.alt === ''));
      }
    }
  });

  test(`${language} search updates facets without using the purpose selection and disables empty options`, async () => {
    const { render } = await Lobby(language);
    let elements = render();
    const purposes = () => elements.filter(node => node.props?.className === 'filter-option filter-subcategory-option');
    const categories = () => elements.filter(node => node.props?.className === 'filter-category-header');
    assert.equal(Elements(purposes()[2]).find(node => node.type === 'input').props.disabled, true);
    assert.equal(Text(Elements(purposes()[2]).find(node => node.type === 'small')), noneYet);
    assert.equal(Elements(categories()[1]).find(node => node.type === 'input').props.disabled, true);
    Elements(purposes()[0]).find(node => node.type === 'input').props.onChange();
    elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: '  ACTIVITY 4  ' } });
    elements = render();
    assert.equal(Text(Elements(purposes()[0]).find(node => node.type === 'small')), '0');
    const selected = Elements(purposes()[0]).find(node => node.type === 'input');
    assert.equal(selected.props.checked, true);
    assert.equal(selected.props.disabled, false, 'A selected empty purpose stays removable.');
    assert.equal(Text(Elements(purposes()[1]).find(node => node.type === 'small')), '1');
    assert.equal(Text(Elements(categories()[0]).find(node => node.type === 'small')), '1');
    selected.props.onChange();
    elements = render();
    assert.equal(Elements(purposes()[0]).find(node => node.type === 'input').props.disabled, true);
    assert.equal(Text(Elements(purposes()[0]).find(node => node.type === 'small')), noneYet);
    assert.equal(elements.filter(node => node.type === 'article').length, 1);
    Elements(purposes()[1]).find(node => node.type === 'input').props.onChange();
    elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'unavailable' } });
    elements = render();
    const category = Elements(categories()[0]).find(node => node.type === 'input');
    assert.equal(category.props.disabled, false, 'A category containing a selection must stay enabled.');
    category.props.onChange();
    elements = render();
    assert.equal(purposes().some(option => Elements(option).find(node => node.type === 'input').props.checked), false,
      'An empty category can remove its remaining selection without selecting disabled purposes.');
    assert.equal(Elements(categories()[0]).find(node => node.type === 'input').props.disabled, true);
  });
}

test('search facets match descriptions and visible developer authors as well as titles', async () => {
  const { render } = await Lobby('en', [games[0], { ...games[4], summary: 'Balance practice', author: 'Contributor', launch: { contract: 'package-v1', game: {} } }]);
  for (const query of ['balance', 'contributor']) {
    let elements = render();
    elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: query } });
    elements = render();
    const purposes = elements.filter(node => node.props?.className === 'filter-option filter-subcategory-option');
    assert.equal(Text(Elements(purposes[1]).find(node => node.type === 'small')), '1');
    assert.equal(Elements(purposes[0]).find(node => node.type === 'input').props.disabled, true);
    assert.equal(elements.filter(node => node.type === 'article').length, 1);
  }
});

test('lobby search excludes hidden official authors while developer authors still update results and facets', async () => {
  const { render } = await Lobby('en', [
    { ...games[0], author: '居家訓練網' },
    { ...games[4], author: 'Ada Lab', launch: { contract: 'package-v1', game: {} } },
  ]);
  for (const [query, count, memoryCount] of [['居家訓練網', 0, 'None yet'], [' ada ', 1, '1']]) {
    let elements = render();
    elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: query } });
    elements = render();
    assert.equal(elements.filter(node => node.type === 'article').length, count);
    const purposes = elements.filter(node => node.props?.className === 'filter-option filter-subcategory-option');
    assert.equal(Text(Elements(purposes[1]).find(node => node.type === 'small')), memoryCount);
  }
});

test('search counts exclude nonmatching activities while ignoring the selected purpose', async () => {
  const { render } = await Lobby();
  let elements = render();
  elements.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange();
  elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'Activity 4' } });
  elements = render();
  const counts = elements.filter(node => node.props?.className === 'filter-option filter-subcategory-option')
    .map(node => Text(Elements(node).find(child => child.type === 'small')));
  assert.deepEqual(counts.slice(0, 2), ['0', '1']);
  const category = elements.find(node => node.props?.className === 'filter-category-header');
  assert.equal(Text(Elements(category).find(node => node.type === 'small')), '1');
});

test('official cards omit author and version while developer cards retain both', async () => {
  const { render } = await Lobby('en', [games[0], { ...games[1], launch: { contract: 'package-v1', game: {} } }]);
  const cards = render().filter(node => node.type === 'article');
  assert.equal(Elements(cards[0]).some(node => node.type === 'dl'), false);
  const details = Elements(cards[1]).find(node => node.type === 'dl');
  assert.ok(Text(details).includes('Author'));
  assert.ok(Text(details).includes('Version'));
  assert.ok(Text(details).includes(games[1].author));
  assert.ok(Text(details).includes(games[1].version));
});

test('preview alternatives identify the activity without repeating its description', async () => {
  for (const language of ['zh-TW', 'en']) {
    const { render } = await Lobby(language);
    const preview = render().find(node => node.type === 'img' && node.props.src === '/preview.webp');
    assert.equal(preview.props.alt, `${games[0].title} ${language === 'en' ? 'activity screen' : '活動畫面'}`);
    assert.ok(!preview.props.alt.includes(games[0].summary));
  }
});

test('category artwork is decorative beside the visible category labels', async () => {
  const { render } = await Lobby();
  const logos = render().filter(node => node.type === 'img' && node.props.src === '/logo.svg');
  assert.ok(logos.length > 0);
  assert.ok(logos.every(node => node.props.alt === ''));
});

test('lobby and guide headings omit the repeated visible eyebrow', async () => {
  const { render } = await Lobby();
  assert.equal(render().filter(node => node.props?.className === 'page-kicker').length, 0);
});

test('category selection does not turn on empty disabled purposes', async () => {
  const { render } = await Lobby();
  let elements = render();
  elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'Activity 4' } });
  elements = render();
  Elements(elements.find(node => node.props?.className === 'filter-category-header')).find(node => node.type === 'input').props.onChange();
  elements = render();
  const selected = elements.filter(node => node.props?.className === 'filter-option filter-subcategory-option')
    .map(node => Elements(node).find(child => child.type === 'input').props.checked);
  assert.deepEqual(selected, [false, true, false]);
});

test('lobby dictionaries describe activities in search, results and pagination', async () => {
  for (const [language, expected] of [
    ['zh-TW', ['搜尋活動名稱', '搜尋練習活動', '所有練習活動', '共 {count} 個活動', '活動分頁', '查看 {count} 個活動', '找不到符合條件的活動']],
    ['en', ['Search activity names', 'Search activities', 'All activities', '{count} activities', 'Activity pages', 'View {count} activities', 'No matching activities']],
  ]) {
    const { copy } = await Lobby(language);
    assert.deepEqual(['searchLabel', 'searchPlaceholder', 'allModules', 'moduleCount', 'paginationLabel', 'viewResults', 'noResultsTitle']
      .map(key => copy.lobby[key]), expected);
    assert.equal(copy.lobby.start, language === 'en' ? 'Start training' : '開始訓練');
  }
});

test('the first view compacts spacing while preserving readable text and 44px help actions', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const heading = StyleRules(css, '.lobby-heading')[0];
  assert.ok(Number(heading.match(/padding:\s*(\d+)px/)[1]) <= 24, 'The heading top padding must be at most 24px.');
  assert.ok(Number(heading.match(/gap:\s*(\d+)px/)[1]) <= 16, 'The heading row gap must be at most 16px.');
  assert.ok(Number(StyleRules(css, '.lobby-search-row')[0].match(/padding-top:\s*(\d+)px/)[1]) <= 16);
  assert.ok(Number(StyleRules(css, '.lobby-start-note')[0].match(/padding:\s*(\d+)px/)[1]) <= 16);
  assert.match(StyleRules(css, '.lobby-start-note p')[0], /font-size:\s*var\(--type-body\);/);
  for (const selector of ['.lobby-tour-button', '.lobby-guide-link']) {
    assert.match(StyleRules(css, selector).join('\n'), /min-height:\s*44px;/);
    assert.match(StyleRules(css, `${selector}:focus-visible`).join('\n'), /outline:\s*3px solid var\(/);
  }
});

test('the lobby heading and results share the responsive page gutter', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  assert.doesNotMatch(css, /\.lobby-recommendations?\b/);
  assert.match(StyleRules(css, '.module-card-content > .module-card-order-cue').join('\n'), /overflow-wrap:\s*anywhere/);
  assert.match(StyleRules(css, '.lobby-heading').join('\n'), /padding:\s*24px var\(--lobby-gutter\)/);
  assert.match(StyleRules(css, '.module-results').join('\n'), /padding:\s*0 var\(--lobby-gutter\)/);
  assert.match(StyleRules(css, '.filter-panel').join('\n'), /margin:\s*0 0 30px var\(--lobby-gutter\)/);
  assert.match(StyleRules(css, '.lobby-page').join('\n'), /--lobby-gutter:\s*32px/);
  assert.match(css, /@media \(max-width: 767px\) \{\s*\.lobby-page\s*\{[^}]*--lobby-gutter:\s*18px/);
});

test('install is an underlined neutral link beside a wider primary start button', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const link = StyleRules(css, '.official-game-actions > a').join('\n');
  assert.match(link, /text-decoration:\s*none;/);
  for (const selector of ['.lobby-tour-button', '.lobby-guide-link']) {
    assert.match(StyleRules(css, selector).join('\n'), /text-decoration:\s*none;/);
  }
  const label = StyleRules(css, '.lobby-link-label').join('\n');
  assert.match(label, /text-decoration:\s*underline;/);
  assert.match(label, /text-decoration-thickness:\s*1px;/);
  assert.match(label, /text-underline-offset:\s*4px;/);
  assert.match(link, /color:\s*var\(--text\);/);
  assert.match(link, /background:\s*transparent;/);
  assert.match(link, /border:\s*0;/);
  assert.match(link, /flex:\s*0 0 auto;/);
  assert.match(link, /min-width:\s*44px;/);
  assert.match(link, /min-height:\s*44px;/);
  assert.match(StyleRules(css, '.official-game-actions > button').join('\n'), /flex:\s*1 1 (?:0|auto);/);
  assert.match(StyleRules(css, '.module-card-footer a:focus-visible').join('\n'), /outline:\s*3px solid var\(/);
});

test('filters use tinted selections and bold neutral labels without colored side stripes', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  for (const [, selectors, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.includes('.filter-')) continue;
    assert.doesNotMatch(declarations, /border-left:\s*(?:[2-9]|\d{2,})px/);
    assert.doesNotMatch(declarations, /inset\s+3px\s+0\s+0/);
  }
  assert.match(StyleRules(css, '.filter-option:has(input:checked)').join('\n'), /font-weight:\s*700;/);
  for (const selector of ['.filter-option:has(input:disabled)', '.filter-category-header:has(input:disabled)']) {
    assert.match(StyleRules(css, selector).join('\n'), /color:\s*var\(--text-muted\);/);
  }
});

test('clearing a search returns focus to the field while keeping selected categories', async () => {
  const { render, copy } = await Lobby();
  let elements = render();
  elements.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange();
  elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'no match' } });
  elements = render();
  assert.ok(elements.some(node => node.props?.className === 'empty-results'));
  const clear = elements.find(node => node.props?.className === 'module-search-clear');
  assert.ok(clear, 'An entered search needs an explicit clear control.');
  assert.equal(clear.props['aria-label'], copy.lobby.clearSearch);
  let focused = false;
  elements.find(node => node.type === 'input' && node.props.type === 'search').props.ref.current = { focus() { focused = true; } };
  clear.props.onClick();
  elements = render();
  assert.equal(focused, true);
  assert.equal(elements.find(node => node.type === 'input' && node.props.type === 'search').props.value, '');
  assert.equal(elements.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true);
  assert.equal(elements.filter(node => node.type === 'article').length, 12);
});

test('the lobby offers a working guide anchor and preserves accessible search and heading', async () => {
  const { render } = await Lobby();
  const elements = render();
  assert.ok(elements.some(node => node.type === 'a' && node.props.href === '#lobby-guide'));
  assert.ok(elements.some(node => node.type === 'section' && node.props.id === 'lobby-guide'));
  assert.equal(elements.filter(node => node.type === 'h1').length, 1);
  const search = elements.find(node => node.type === 'input' && node.props.type === 'search');
  assert.ok(search);
  assert.ok(elements.some(node => node.type === 'label' && node.props.htmlFor === search.props.id));
});

for (const language of ['zh-TW', 'en']) {
  test(`${language} guide puts short starting instructions and score limits before optional details`, async () => {
    const { render, copy } = await Lobby(language);
    const guide = render().find(node => node.props?.id === 'lobby-guide');
    const elements = Elements(guide);
    const steps = elements.find(node => node.type === 'ol');
    assert.ok(steps, 'Starting instructions must be a scannable ordered list.');
    assert.equal(Elements(steps).filter(node => node.type === 'li').length, 2);
    assert.ok(Text(steps).includes(copy.lobby.guide.chooseBody));
    assert.ok(Text(steps).includes(copy.lobby.guide.prepareBody));
    const note = elements.find(node => node.props?.className === 'lobby-guide-note');
    assert.ok(note, 'Score limits stay visible without opening a disclosure.');
    assert.ok(Text(note).includes(copy.lobby.guide.limitsBody));
    assert.ok(elements.indexOf(note) < elements.findIndex(node => node.type === 'details'));
    const visibleText = elements.filter(node => node.type === 'p' &&
      !elements.filter(item => item.type === 'details').some(item => Elements(item).includes(node)))
      .map(Text).join(' ');
    assert.ok(language === 'en' ? visibleText.split(/\s+/).length <= 140 : visibleText.length <= 260,
      'The default guide must fit a short read.');
  });

  test(`${language} guide keeps login, privacy and review answers in native disclosures and retains useful links`, async () => {
    const { render, copy } = await Lobby(language);
    const guide = Elements(render().find(node => node.props?.id === 'lobby-guide'));
    const disclosures = guide.filter(node => node.type === 'details');
    assert.equal(disclosures.length, 3);
    for (const [index, key] of ['records', 'privacy', 'review'].entries()) {
      const disclosure = disclosures[index];
      assert.ok(!disclosure.props.open, 'Extra details are initially collapsed.');
      const content = Elements(disclosure);
      assert.equal(Text(content.find(node => node.type === 'summary')), copy.lobby.guide[`${key}Title`]);
      assert.equal(Text(content.find(node => node.type === 'p')), copy.lobby.guide[`${key}Body`],
        'The full answer must exist in the initial render, before interaction.');
    }
    assert.deepEqual(guide.filter(node => node.type === 'a').map(node => node.props.href),
      ['/about/', '/qa/', '/privacy/', '/activities/', '/activity-map/']);
    assert.doesNotMatch(Text(guide), /5000|5%|escape-character|iframe|Worker/,
      'Developer implementation details do not belong in the lobby guide.');
  });
}

test('homepage FAQ structured data matches every rendered guide heading and answer', async () => {
  const { render, dictionary } = await Lobby('zh-TW');
  const guide = Elements(render().find(node => node.props?.id === 'lobby-guide'));
  const source = await readFile(new URL('seo.ts', appRoot), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    './i18n': dictionary,
    './hubBrand': { hubLocalName: '居家訓練網', hubAlternateNames: ['Rehab Trainer Hub'], hubFullName: '居家訓練網 Rehab Trainer Hub' },
    './siteUrls': { siteUrls: { hub: 'https://trainerhub.cc' } },
  };
  new Function('exports', 'require', compiled)(loaded.exports, name => dependencies[name]);
  const questions = loaded.exports.homepageFaqJsonLd.mainEntity;
  assert.equal(questions.length, 7);
  for (const question of questions) {
    assert.ok(guide.some(node => ['h2', 'h3'].includes(node.type) && Text(node) === question.name), question.name);
    assert.ok(guide.some(node => node.type === 'p' && Text(node) === question.acceptedAnswer.text),
      `The FAQ answer must match the page: ${question.name}`);
  }
});

test('only official lobby cards link to an activity detail page', async () => {
  const submitted = { ...games[1], launch: { contract: 'package-v1', game: {} } };
  const { render } = await Lobby('en', [games[0], submitted]);
  const cards = render().filter(node => node.type === 'article');
  assert.deepEqual(cards.flatMap(card => Elements(card).filter(node => node.type === 'a'
    && node.props.href.startsWith('/activities/')).map(node => node.props.href)), ['/activities/game-0/']);
});

test('game actions retain their install destinations and open and close the original overlay', async () => {
  const { render, copy } = await Lobby();
  let elements = render();
  const card = elements.find(node => node.type === 'article');
  const actions = Elements(card);
  assert.ok(actions.some(node => node.type === 'a' && node.props.href === games[0].installUrl));
  const start = actions.find(node => node.type === 'button' && node.props.children.includes(copy.lobby.start));
  assert.equal(start.props['aria-label'], `${copy.lobby.start}: ${games[0].title}`);
  assert.ok(actions.find(node => node.type === 'a' && node.props.href === games[0].installUrl).props['aria-label'].includes(games[0].title));
  start.props.onClick({ currentTarget: { closest: () => ({ isConnected: true }) } });
  elements = render();
  const overlay = elements.find(node => node.props?.game === games[0]);
  assert.ok(overlay);
  overlay.props.onClose();
  assert.equal(render().some(node => node.props?.game), false);
});

test('lobby module cards wrap at 450px and fill narrower containers', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  const [base, ...overrides] = StyleRules(css, '.module-grid');
  assert.match(base, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(450px,\s*100%\),\s*1fr\)\);/);
  for (const rule of overrides) assert.doesNotMatch(rule, /grid-template-columns\s*:/);
});
