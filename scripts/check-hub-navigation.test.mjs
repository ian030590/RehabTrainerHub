import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const sourcePath = resolve(import.meta.dirname, '../apps/rehabtrainerhub/app/HubNavigation.tsx');
const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routeHrefs = ['/', '/progress/', '/qa/', '/download/'];

function FindNodes(predicate, root = source) {
  const matches = [];
  function Visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, Visit);
  }
  Visit(root);
  return matches;
}

test('Hub has one four-route navigation map with an accessible current page', () => {
  const declaration = FindNodes((node) => ts.isVariableDeclaration(node) && node.name.getText(source) === 'navigationHrefs');
  assert.equal(declaration.length, 1);
  const routes = declaration[0].initializer;
  const array = ts.isAsExpression(routes) ? routes.expression : routes;
  assert.ok(ts.isArrayLiteralExpression(array));
  assert.deepEqual(array.elements.map((element) => element.text), routeHrefs);

  const navs = FindNodes((node) => ts.isJsxOpeningElement(node)
    && node.tagName.getText(source) === 'nav'
    && node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute)
      && attribute.name.getText(source) === 'className'
      && attribute.initializer?.getText(source).includes('hub-nav')));
  assert.equal(navs.length, 1, 'Hub should render one navigation landmark at every viewport');
  const nav = navs[0].parent;
  assert.equal(FindNodes((node) => ts.isIdentifier(node) && node.text === 'navigationHrefs', nav).length, 1);
  const links = FindNodes((node) => ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'Link', nav);
  assert.equal(links.length, 1, 'All main routes should use the same Link template');
  const current = links[0].attributes.properties.find((attribute) => ts.isJsxAttribute(attribute)
    && attribute.name.getText(source) === 'aria-current');
  assert.ok(current, 'Active route must expose aria-current');
  const currentValue = current.initializer?.expression;
  assert.ok(ts.isConditionalExpression(currentValue), 'Only the active route should expose aria-current');
  assert.equal(currentValue.condition.getText(source), 'isActive');
  assert.equal(currentValue.whenTrue.text, 'page');
  assert.equal(currentValue.whenFalse.getText(source), 'undefined');

  const skipLinks = FindNodes((node) => ts.isJsxOpeningElement(node)
    && node.tagName.getText(source) === 'a'
    && node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute)
      && attribute.name.getText(source) === 'href'
      && attribute.initializer?.text === '#main-content'));
  assert.equal(skipLinks.length, 1, 'Hub should have one skip link to main content');
  assert.ok(skipLinks[0].pos < nav.pos, 'Skip link should precede navigation in keyboard order');
});
