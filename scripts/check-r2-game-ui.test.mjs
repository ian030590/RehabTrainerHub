import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const gamesRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games');
const cases = [
  { id: 'drawing-defense', component: 'DrawingTowerDefenseGame', tutorial: 'DrawingDefenseTutorial' },
  { id: 'asteroid-shield', component: 'AsteroidShieldGame', tutorial: 'AsteroidShieldTutorial' },
  { id: 'gesture-battler', component: 'GestureBattlerGame', tutorial: 'GestureBattlerTutorial' },
  { id: 'moving-card', component: 'MovingCardGame', tutorial: 'MovingCardTutorial' },
];

for (const fixture of cases) {
  test(`${fixture.id}: final settings are readable and keep start and back actions`, async () => {
    for (const language of ['zh', 'en']) {
      const source = await readFile(resolve(gamesRoot, fixture.id, 'rules', `${fixture.tutorial}.tsx`), 'utf8');
      const module = { exports: {} };
      const dependencies = {
        react: { ...React, useEffect() {}, useState: () => [true, () => {}], useRef: () => ({ current: null }) },
        'react/jsx-runtime': jsxRuntime,
        '../i18n/useT': { useT: () => ({ lang: language, t: key => key }) },
        '../runtime/tour': {}, '../runtime/tour.css': {}, './tutorialSteps': {},
        '../settings': { PixelFromMillimeter: value => value },
      };
      new Function('require', 'module', 'exports', ts.transpileModule(
        source.replaceAll('import.meta.url', JSON.stringify('https://runner.example/package/rules/tutorial.js')),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
      ).outputText)(name => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      }, module, module.exports);
      let starts = 0;
      let backs = 0;
      const tree = module.exports[fixture.tutorial]({
        title: 'Session', active: true, ready: true, shieldSizePercent: 75,
        settings: { rounds: 10, optionCount: 18, difficulty: 'medium', targetPhysicalSizeMm: 15, optionPhysicalSizeMm: 10, calibrationLengthMm: 149 },
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
    if (fixture.id === 'moving-card') {
      assert.match(form.getText(syntax), /onSubmit={[\s\S]*confirmSettings\(\)/);
      assert.match(source, /const confirmSettings = \(\) => {[\s\S]*?reportValidity\(\)[\s\S]*?ValidateSettings\(settings\)[\s\S]*?setPhase\('rules'\)/);
    } else assert.match(form.getText(syntax), /reportValidity\(\)/);
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
