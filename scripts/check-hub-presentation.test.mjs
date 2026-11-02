import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as results from '../apps/rehabtrainerhub/app/lobbyResults.js';

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const games = Array.from({ length: 14 }, (_, index) => ({
  id: `game-${index}`, title: `Activity ${index}`, summary: 'Practice at home', author: 'Hub',
  purpose: index < 4 ? 'attention' : 'memory', theme: { icon: { type: 'symbol', value: 'grid_view' } },
  installUrl: `/games/game-${index}/`, launch: { contract: 'catalog-v1', module: {} },
}));

function Elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(Elements);
  return [tree, ...Elements(tree.props?.children)];
}

async function Lobby() {
  const slots = [];
  const effects = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) {
        slots[index] = deps;
        // Only state effects run here; network and document setup belong to browser checks.
        if (deps.length) effects.push(effect);
      }
    },
    useCallback: callback => callback,
    useMemo: callback => callback(),
  };
  const dictionarySource = await readFile(new URL('i18n/en.ts', appRoot), 'utf8');
  const dictionary = { exports: {} };
  new Function('exports', ts.transpileModule(dictionarySource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(dictionary.exports);
  const copy = dictionary.exports.en.hubUi;
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './i18n': { GetHubUiCopy: () => copy },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t: key => key }) },
    './gameCatalog': { BuildHubGameCatalog: () => games },
    './lobbyResults.js': results,
    './trainingThemeStyle': { BuildTrainingThemeStyle: () => ({}) },
    '@rehab-trainer/ui/hooks/useBottomSheet': { useBottomSheet: () => ({ dialogRef: {}, isMobile: false }) },
    '@rehab-trainer/hub-modules/catalog': {
      trainingCatalog: [], trainingPurposes: [{ id: 'attention' }, { id: 'memory' }],
      trainerCategoryTags: [{ id: 'brain', label: { en: 'Cognition' } }],
      categorySubcategories: { brain: ['attention', 'memory'] },
      trainingThemes: Object.fromEntries(['attention', 'memory'].map(id => [id, { label: { en: id }, icon: {} }])),
      GetTrainerCategoryTheme: () => ({}),
    },
  };
  const source = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('exports', 'require', 'document', compiled)(loaded.exports, name => dependencies[name] ?? {}, { activeElement: null });
  const render = () => { cursor = 0; const tree = loaded.exports.TrainingLobby(); effects.splice(0).forEach(effect => effect()); return Elements(tree); };
  return { render, copy };
}

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

test('game actions retain their install destinations and open and close the original overlay', async () => {
  const { render, copy } = await Lobby();
  let elements = render();
  const card = elements.find(node => node.type === 'article');
  const actions = Elements(card);
  assert.ok(actions.some(node => node.type === 'a' && node.props.href === games[0].installUrl));
  actions.find(node => node.type === 'button' && node.props.children.includes(copy.lobby.start)).props.onClick();
  elements = render();
  const overlay = elements.find(node => node.props?.game === games[0]);
  assert.ok(overlay);
  overlay.props.onClose();
  assert.equal(render().some(node => node.props?.game), false);
});
