import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const gamesRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games');
const cases = [
  { id: 'driving-rehab', component: 'DrivingRehabGame', tutorial: 'DrivingTutorial' },
  { id: 'reading-training', component: 'ReadingTrainingGame', tutorial: 'ReadingTutorial' },
  { id: 'gabor-patching', component: 'GaborPatchingGame', tutorial: 'GaborTutorial' },
  { id: 'drawing-defense', component: 'DrawingTowerDefenseGame', tutorial: 'DrawingDefenseTutorial' },
  { id: 'asteroid-shield', component: 'AsteroidShieldGame', tutorial: 'AsteroidShieldTutorial' },
  { id: 'gesture-battler', component: 'GestureBattlerGame', tutorial: 'GestureBattlerTutorial' },
  { id: 'moving-card', component: 'MovingCardGame', tutorial: 'MovingCardTutorial' },
  { id: 'sart', component: 'SartGame', tutorial: 'SartTutorial' },
  { id: 'schulte-grid', component: 'SchulteGridGame', tutorial: 'SchulteTutorial', logic: { '../logic/schulteGrid': 'logic/schulteGrid.ts' } },
  { id: 'hex-schulte', component: 'HexSchulteGame', tutorial: 'HexTutorial', logic: { '../logic/hexBoard': 'logic/hexBoard.ts', '../HexBoard': 'HexBoard.tsx' } },
  { id: 'continuous-performance', component: 'ContinuousPerformanceGame', tutorial: 'CptTutorial' },
  { id: 'simon-task', component: 'SimonTaskGame', tutorial: 'SimonTutorial' },
  { id: 'card-sorting', component: 'CardSortingGame', tutorial: 'SortingTutorial', logic: { '../logic/cardSorting': 'logic/cardSorting.ts', '../CardFace': 'CardFace.tsx' } },
  { id: 'attentional-blink', component: 'AttentionalBlinkGame', tutorial: 'BlinkTutorial' },
  { id: 'time-perception', component: 'TimePerceptionGame', tutorial: 'TimingTutorial' },
  { id: 'divided-attention', component: 'DividedAttentionGame', tutorial: 'DividedTutorial' },
  { id: 'pattern-memory', component: 'PatternMemoryGame', tutorial: 'PatternTutorial', logic: { '../PatternBoard': 'PatternBoard.tsx' } },
  { id: 'stroop', component: 'StroopGame', tutorial: 'StroopTutorial' },
  { id: 'flanker', component: 'FlankerGame', tutorial: 'FlankerTutorial' },
  { id: 'go-nogo', component: 'GoNoGoGame', tutorial: 'GoNoGoTutorial' },
  { id: 'stop-signal', component: 'StopSignalGame', tutorial: 'StopSignalTutorial', logic: { '../shapes': 'shapes.tsx' } },
  { id: 'attention-network-task', component: 'AttentionNetworkGame', tutorial: 'AntTutorial', logic: { '../ArrowRow': 'ArrowRow.tsx' } },
  { id: 'n-back', component: 'NBackLetters', tutorial: 'NBackTutorial' },
  { id: 'number-letter', component: 'NumberLetterSwitch', tutorial: 'NumberLetterTutorial' },
  { id: 'digit-span', component: 'DigitSpanRecall', tutorial: 'DigitSpanTutorial' },
  { id: 'spatial-span', component: 'SpatialSpanRecall', tutorial: 'SpatialSpanTutorial' },
  { id: 'tower-of-london', component: 'TowerPlanning', tutorial: 'TowerTutorial', logic: { '../logic/towerOfLondon': 'logic/towerOfLondon.ts', '../TowerBoard': 'TowerBoard.tsx' } },
  { id: 'reaction-time', component: 'ReactionSignal', tutorial: 'ReactionTutorial' },
  { id: 'tic-tac-toe', component: 'TicTacToeGame', tutorial: 'TicTacToeTutorial', logic: { '../logic/ticTacToe': 'logic/ticTacToe.ts' } },
  { id: 'connect4', component: 'Connect4Game', tutorial: 'Connect4Tutorial', logic: { '../logic/connect4': 'logic/connect4.ts' } },
  { id: 'hex', component: 'HexGame', tutorial: 'HexTutorial', logic: { '../logic/hex': 'logic/hex.ts', '../HexBoard': 'HexBoard.tsx' } },
  { id: 'dots-and-boxes', component: 'DotsAndBoxesGame', tutorial: 'DotsTutorial', logic: { '../logic/dotsAndBoxes': 'logic/dotsAndBoxes.ts', '../DotsBoard': 'DotsBoard.tsx' } },
  { id: 'lights-out', component: 'LightsOutGame', tutorial: 'LightsOutTutorial', logic: { '../logic/lightsOut': 'logic/lightsOut.ts', '../LightsBoard': 'LightsBoard.tsx' } },
  { id: 'sliding-puzzle', component: 'SlidingPuzzleGame', tutorial: 'SlidingTutorial', logic: { '../logic/slidingPuzzle': 'logic/slidingPuzzle.ts', '../SlidingBoard': 'SlidingBoard.tsx' } },
  { id: 'maze', component: 'MazeGame', tutorial: 'MazeTutorial', logic: { '../logic/maze': 'logic/maze.ts', '../MazeBoard': 'MazeBoard.tsx', '../DirectionPad': 'DirectionPad.tsx' } },
  { id: 'sudoku', component: 'SudokuGame', tutorial: 'SudokuTutorial', logic: { '../logic/numberGrid': 'logic/numberGrid.ts', '../NumberBoard': 'NumberBoard.tsx' } },
  { id: 'memory-match', component: 'MemoryMatchGame', tutorial: 'MemoryTutorial', logic: { '../logic/memoryMatch': 'logic/memoryMatch.ts', '../CardBoard': 'CardBoard.tsx' } },
  { id: 'simon-says', component: 'SimonSaysGame', tutorial: 'SimonTutorial', logic: { '../logic/simonSays': 'logic/simonSays.ts', '../SimonPads': 'SimonPads.tsx' } },
  { id: 'whack-a-mole', component: 'WhackAMoleGame', tutorial: 'WhackTutorial', logic: { '../logic/whackAMole': 'logic/whackAMole.ts', '../HoleBoard': 'HoleBoard.tsx' } },
  { id: 'minesweeper', component: 'MinesweeperGame', tutorial: 'MinesweeperTutorial', logic: { '../logic/minesweeper': 'logic/minesweeper.ts', '../MineBoard': 'MineBoard.tsx' } },
  { id: 'antisaccade', component: 'AntisaccadeGame', tutorial: 'AntisaccadeTutorial', logic: { '../Stimulus': 'Stimulus.tsx' } },
  { id: 'keep-track', component: 'KeepTrackRecall', tutorial: 'KeepTrackTutorial', logic: { '../logic/keepTrack': 'logic/keepTrack.ts', '../AnswerRows': 'AnswerRows.tsx' } },
  { id: 'letter-memory', component: 'LetterMemoryRecall', tutorial: 'LetterMemoryTutorial', logic: { '../logic/letterMemory': 'logic/letterMemory.ts', '../LetterPad': 'LetterPad.tsx' } },
  { id: 'plus-minus', component: 'PlusMinusSwitch', tutorial: 'PlusMinusTutorial', logic: { '../NumberPad': 'NumberPad.tsx' } },
  { id: 'ufov', component: 'UfovGame', tutorial: 'UfovTutorial', logic: { '../AnswerPad': 'AnswerPad.tsx' } },
];

for (const fixture of cases) {
  test(`${fixture.id}: final settings are readable and keep start and back actions`, async () => {
    for (const language of ['zh', 'en']) {
      const source = await readFile(resolve(gamesRoot, fixture.id, 'rules', `${fixture.tutorial}.tsx`), 'utf8');
      const module = { exports: {} };
      const dependencies = {
        react: { ...React, useEffect() {}, useLayoutEffect() {}, useMemo: calculate => calculate(),
          useState: initial => [fixture.id === 'moving-card' && typeof initial === 'object' ? initial : true, () => {}],
          useRef: () => ({ current: null }) },
        'react/jsx-runtime': jsxRuntime,
        '../i18n/useT': { useT: () => ({ lang: language, t: key => key }) },
        '../runtime/tour': {}, '../runtime/tour.css': {}, './tutorialSteps': {},
        '../settings': { PixelFromMillimeter: value => value },
        '../gaborTexture': { gaborTextureSpecs: [{ freq: .05 }, { freq: .08 }, { freq: .03 }] },
      };
      // Tutorials that draw their preview from the game's own pure logic modules; a module may import one listed before it.
      for (const [name, file] of Object.entries(fixture.logic ?? {})) {
        const logicModule = { exports: {} };
        new Function('module', 'exports', 'require', ts.transpileModule(await readFile(resolve(gamesRoot, fixture.id, file), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
        }).outputText)(logicModule, logicModule.exports, name => name === 'react/jsx-runtime' ? jsxRuntime : dependencies[`../${posix.join(posix.dirname(file), name)}`] ?? {});
        dependencies[name] = logicModule.exports;
      }
      if (fixture.id === 'moving-card') {
        const mathModule = { exports: {} }, layoutModule = { exports: {} };
        new Function('module', 'exports', ts.transpileModule(await readFile(resolve(gamesRoot, fixture.id, 'gameUtils.ts'), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText)(mathModule, mathModule.exports);
        new Function('require', 'module', 'exports', ts.transpileModule(await readFile(resolve(gamesRoot, fixture.id, 'cardLayout.ts'), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText)(() => mathModule.exports, layoutModule, layoutModule.exports);
        dependencies['../cardLayout'] = layoutModule.exports;
        dependencies['../runtime/theme'] = { typography: { fontSizeM: 16 } };
      }
      new Function('require', 'module', 'exports', 'window', ts.transpileModule(
        source.replaceAll('import.meta.url', JSON.stringify('https://runner.example/package/rules/tutorial.js')),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
      ).outputText)(name => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      }, module, module.exports, { innerWidth: 390, innerHeight: 844 });
      let starts = 0;
      let backs = 0;
      const tree = module.exports[fixture.tutorial]({
        title: 'Session', active: true, ready: true, shieldSizePercent: 75,
        settings: { controlMode: 'arrow', passage: 0, wordsPerMinute: 240, crowding: 100, contrast: 100, durationSec: 60, maxSpots: 8, rounds: 10, optionCount: 18, difficulty: 'medium', targetPhysicalSizeMm: 15, optionPhysicalSizeMm: 10, calibrationLengthMm: 149 },
        summaryItems: [{ label: 'Duration', value: '30s' }, { label: 'Threshold', value: '65%' }],
        onStart: () => starts++, onBack: () => backs++,
      });
      const confirmation = Find(tree, element => HasClass(element, 'training-confirmation'));
      assert.ok(confirmation, 'The final settings use a named confirmation panel.');
      assert.ok(HasClass(confirmation, 'training-config'));
      const markup = renderToStaticMarkup(confirmation);
      assert.match(markup, /<header class="training-config-header"><h2/);
      assert.match(markup, /<div class="training-config-body">/);
      assert.match(markup, /<section class="training-setting"><h3>.*(?:確認設定|Confirm settings)/);
      assert.match(markup, /<div class="training-config-summary">/);
      assert.match(markup, /<p class="training-config-summary-item"><strong>Duration.*30s/);
      assert.match(markup, /<p class="training-config-summary-item"><strong>Threshold.*65%/);
      assert.match(markup, /<footer class="config-actions">/);
      Find(confirmation, element => element.type === 'button' && HasClass(element, 'btn-primary')).props.onClick();
      Find(confirmation, element => element.type === 'button' && HasClass(element, 'btn-ghost')).props.onClick();
      assert.equal(starts, 1);
      assert.equal(backs, 1);
      assert.ok(AllDivsNamed(confirmation), 'Confirmation divs identify their content or purpose.');
      assert.ok(AllDivsNamed(tree), 'Tutorial divs identify their content or purpose.');
      if (fixture.id === 'asteroid-shield') {
        const waiting = module.exports[fixture.tutorial]({ active: true, ready: false });
        assert.equal(Find(waiting, element => element.type === 'button' && HasClass(element, 'btn-primary')).props.disabled, true);
      }
    }
  });

  test(`${fixture.id}: settings and results follow the same semantic layout`, async () => {
    const source = await readFile(resolve(gamesRoot, fixture.id, `${fixture.component}.tsx`), 'utf8');
    const syntax = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const elements = [];
    const collect = node => {
      if (ts.isJsxElement(node)) elements.push(node);
      ts.forEachChild(node, collect);
    };
    collect(syntax);
    const form = elements.find(node => node.openingElement.tagName.getText(syntax) === 'form');
    assert.ok(form);
    assert.match(form.getText(syntax), /className="[^"]*training-config/);
    for (const name of ['training-config-header', 'training-config-body', 'training-setting', 'config-actions', 'training-config-navigation-buttons']) {
      assert.ok(form.getText(syntax).includes(`className="${name}"`), `Settings need ${name}.`);
    }
    if (['moving-card', 'gabor-patching', 'reading-training'].includes(fixture.id)) {
      assert.match(form.getText(syntax), /onSubmit={[\s\S]*confirmSettings\(\)/);
      assert.match(source, /const confirmSettings = \(\) => {[\s\S]*?reportValidity\(\)[\s\S]*?ValidateSettings\(settings\)[\s\S]*?setPhase\('rules'\)/);
    } else {
      // Confirming validates the form before the tutorial (and before the settings are remembered).
      assert.match(form.getText(syntax), /confirmSettings\(/);
      assert.match(source, /const confirmSettings = \([^)]*\) => {[\s\S]*?reportValidity\(\)[\s\S]*?setPhase\('rules'\)/);
    }
    const results = elements.find(node => node.openingElement.getText(syntax).includes('className="experiment-results"'));
    assert.ok(results);
    for (const node of elements.filter(node => node.pos >= results.pos && node.end <= results.end)) {
      if (node.openingElement.tagName.getText(syntax) === 'div') {
        assert.ok(node.openingElement.attributes.properties.some(attribute => attribute.name?.getText(syntax) === 'className'),
          `Unnamed result div: ${node.openingElement.getText(syntax)}`);
      }
    }
    assert.match(results.getText(syntax), /className="score-save-status" role="status"/);
    assert.match(results.getText(syntax), /className="btn btn-primary score-return-button"/);
  });
}

function HasClass(element, name) {
  return element.props.className?.split(' ').includes(name);
}

function Find(element, predicate) {
  if (!React.isValidElement(element)) return null;
  if (predicate(element)) return element;
  return React.Children.toArray(element.props.children).map(child => Find(child, predicate)).find(Boolean);
}

function AllDivsNamed(element) {
  if (!React.isValidElement(element)) return true;
  return (element.type !== 'div' || Boolean(element.props.className))
    && React.Children.toArray(element.props.children).every(AllDivsNamed);
}
