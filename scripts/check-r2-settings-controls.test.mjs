import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Settings controls match what players expect for each kind of value:
// named choices for difficulty, sliders with a visible value for bounded percentages/durations,
// and only the inputs that apply to the current choice.
const gamesRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games');

async function Load(gameId, file) {
  const source = await readFile(resolve(gamesRoot, gameId, file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = [];
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const attribute = (node, name) => node.attributes.properties.find(item => item.name?.getText(tree) === name)?.initializer?.getText(tree);
  const input = name => elements.find(node => ['input', 'select'].includes(node.tagName.getText(tree)) && attribute(node, 'name') === `"${name}"`);
  const label = node => { let current = node; while (current && !(ts.isJsxElement(current) && current.openingElement.tagName.getText(tree) === 'label')) current = current.parent; return current; };
  // The nearest `condition && <element>` that wraps a control.
  const condition = node => {
    for (let current = node; current; current = current.parent) {
      if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return current.left.getText(tree);
      if (ts.isConditionalExpression(current)) return current.condition.getText(tree);
    }
    return null;
  };
  return { source, tree, elements, attribute, input, label, condition };
}

async function Version(gameId) {
  return JSON.parse(await readFile(resolve(gamesRoot, gameId, 'package.json'), 'utf8')).version;
}

for (const [gameId, file, version] of [['gabor-patching', 'GaborPatchingGame.tsx', '2.0.3'], ['asteroid-shield', 'AsteroidShieldGame.tsx', '2.0.11']]) {
  test(`${gameId}: difficulty options lead with a plain name and keep the parameters as detail`, async () => {
    const { source } = await Load(gameId, file);
    assert.equal(await Version(gameId), version);
    for (const names of [['簡單', '中等', '困難'], ['Easy', 'Medium', 'Hard']]) {
      const positions = names.map(name => source.indexOf(`${name}（`) >= 0 ? source.indexOf(`${name}（`) : source.indexOf(`${name} (`));
      assert.ok(positions.every(position => position >= 0), `${gameId} names every difficulty: ${names.join('/')}`);
    }
    // The original timing/speed parameters remain visible beside the name.
    assert.match(source, gameId === 'gabor-patching' ? /4 秒／每幀 2%/ : /1\.35 s \/ 120 px\/s/);
  });
}

test('gesture-battler: strictness and hold time are sliders that show their value', async () => {
  const { input, attribute, label } = await Load('gesture-battler', 'GestureBattlerGame.tsx');
  assert.equal(await Version('gesture-battler'), '2.0.6');
  for (const [name, range] of [['strictnessPercent', ['"50"', '"90"', '"5"']], ['holdDurationSec', ['"0.5"', '"10"', '"0.5"']]]) {
    const control = input(name);
    assert.equal(attribute(control, 'type'), '"range"', name);
    assert.deepEqual(['min', 'max', 'step'].map(key => attribute(control, key)), range, name);
    assert.match(label(control).getText(), /<output>/, `${name} shows its current value.`);
  }
  assert.equal(attribute(input('enemyMaxHp'), 'type'), '"number"', 'Exact HP stays a number field.');
});

test('motor-cortex-rehab: target size and speed are sliders that show their value', async () => {
  const { input, attribute, label } = await Load('motor-cortex-rehab', 'MotorCortexRehabGame.tsx');
  assert.equal(await Version('motor-cortex-rehab'), '2.0.4');
  for (const [name, range] of [['targetSizePercent', ['{75}', '{130}', '{5}']], ['speedPercent', ['{70}', '{140}', '{5}']]]) {
    const control = input(name);
    assert.equal(attribute(control, 'type'), '"range"', name);
    assert.deepEqual(['min', 'max', 'step'].map(key => attribute(control, key)), range, name);
    assert.match(label(control).getText(), /<output>/, `${name} shows its current value.`);
  }
});

test('drawing-defense: only the inputs for the current choice are shown and HP accepts normal typing', async () => {
  const { input, attribute, condition, source } = await Load('drawing-defense', 'DrawingTowerDefenseGame.tsx');
  assert.equal(await Version('drawing-defense'), '2.0.8');
  const duration = input('gameDuration');
  assert.equal(duration.tagName.getText(), 'select');
  assert.match(source, /<option value="custom">\{t\('training\.custom'\)\}<\/option>/, 'Custom is a duration choice.');
  assert.equal(condition(input('customGameDurationSec')), 'customDurationSelected', 'Custom seconds appear only after choosing custom.');
  assert.equal(condition(input('backgroundColor')), "backgroundMode === 'color'");
  assert.equal(condition(input('backgroundImage')), "backgroundMode === 'image'");
  for (const name of ['customGameDurationSec', 'maxHp']) {
    const control = input(name);
    assert.equal(attribute(control, 'type'), '"number"');
    assert.ok(attribute(control, 'required') !== undefined || control.attributes.properties.some(item => item.name?.getText() === 'required'), `${name} is validated on confirm.`);
    assert.doesNotMatch(attribute(control, 'onChange'), /Clamp\(/, `${name} does not rewrite the value while typing.`);
  }
});

test('driving-rehab: settings use the same section cards and dropdowns as the other R2 games', async () => {
  const { input, label, elements, attribute, tree, source } = await Load('driving-rehab', 'DrivingRehabGame.tsx');
  assert.equal(await Version('driving-rehab'), '2.1.1');
  const section = node => { let current = node; while (current && !(ts.isJsxElement(current) && current.openingElement.tagName.getText(tree) === 'section')) current = current.parent; return current; };
  for (const name of ['difficulty', 'renderQuality', 'controlMode']) {
    const control = input(name);
    assert.equal(control?.tagName.getText(tree), 'select', `${name} is a dropdown.`);
    assert.ok(label(control), `${name} has a visible label.`);
    const card = section(control);
    assert.equal(attribute(card?.openingElement, 'className'), '"training-setting"', `${name} sits in a settings card.`);
    assert.match(card.getText(tree), /^<section className="training-setting"><h3>/, `${name} card starts with a heading.`);
  }
  assert.match(source, /<option key=\{value\} value=\{value\}\s+disabled=\{!IsDrivingControlModeAvailable\(/, 'Unavailable controls stay visible but cannot be chosen.');
  assert.equal(attribute(input('redFlashEnabled'), 'type'), '"checkbox"');
  assert.equal(attribute(section(input('redFlashEnabled'))?.openingElement, 'className'), '"training-setting"');
  const rescan = elements.find(node => node.tagName.getText(tree) === 'button' && /rescan/.test(node.parent.getText(tree)));
  assert.equal(attribute(section(rescan)?.openingElement, 'className'), '"training-setting"', 'Rescan stays inside the controls card.');
  assert.doesNotMatch(source, /training-option|<fieldset|type="radio"/, 'No custom radio grid.');
  const css = await readFile(resolve(gamesRoot, 'driving-rehab', 'game.css'), 'utf8');
  assert.doesNotMatch(css, /training-option|\.training-setting \{[^}]*border: 0/, 'game.css does not override the shared card styles.');
  const wheel = await readFile(resolve(gamesRoot, 'driving-rehab', 'input/DrivingWheelSetup.tsx'), 'utf8');
  assert.match(wheel, /<section className="training-setting driving-wheel-setup"><h3>/, 'Wheel calibration uses a settings card with a heading.');
});
