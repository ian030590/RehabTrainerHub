import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const gamesRoot = 'apps/rehabtrainerhub/games';

async function ImportStandaloneTypeScriptModule(path) {
  const source = await readFile(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Hart Chart honors the configured alternation count', async () => {
  const { CreateHartChart, CreateHartDecoder } = await ImportStandaloneTypeScriptModule(`${gamesRoot}/hart-chart/logic/hartChart.ts`);
  for (const seed of [0, 1, 12345]) {
    for (const rounds of [5, 10, 30]) {
      const chart = CreateHartChart(seed);
      const result = CreateHartDecoder(chart, seed, rounds);
      assert.equal(result.tokens.filter(token => token.coordinate).length, rounds);
      for (const token of result.tokens.filter(token => token.coordinate)) {
        assert.equal(chart.find(cell => cell.row === token.coordinate.row && cell.col === token.coordinate.col)?.char, token.char);
      }
    }
  }
});
