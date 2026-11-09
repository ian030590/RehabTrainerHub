import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const requiredHeadings = ['Summary', 'Overview', 'Detailed Design', 'Edge Cases', 'Dependencies', 'Acceptance Criteria'];
const guidance = 'Run the game team; see .claude/docs/rehab-game-team.md.';

function ReadCatalogIds(source) {
  const sourceFile = ts.createSourceFile('catalog.ts', source, ts.ScriptTarget.Latest, true);
  let seeds;
  const Visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'seeds') seeds = node.initializer;
    ts.forEachChild(node, Visit);
  };
  Visit(sourceFile);
  if (seeds && ts.isAsExpression(seeds)) seeds = seeds.expression;
  if (!seeds || !ts.isArrayLiteralExpression(seeds)) throw new Error('catalog.ts seeds must be an array literal.');
  return seeds.elements.map(seed => {
    if (!ts.isObjectLiteralExpression(seed)) throw new Error('catalog.ts seeds must contain object literals.');
    const id = seed.properties.find(property => ts.isPropertyAssignment(property)
      && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'id');
    if (!id || !ts.isStringLiteral(id.initializer)) throw new Error('catalog.ts game IDs must be string literals.');
    return id.initializer.text;
  });
}

export function CheckGameTeamDesign(root) {
  const problems = [];
  const AddProblem = message => problems.push(`${message} ${guidance}`);
  try {
    const legacyPath = 'scripts/game-team-legacy-games.json';
    const legacy = JSON.parse(readFileSync(resolve(root, legacyPath), 'utf8'));
    if (!Array.isArray(legacy) || legacy.some(id => typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
      throw new Error(`${legacyPath} must be an array of game directory names.`);
    }
    if (new Set(legacy).size !== legacy.length) AddProblem(`${legacyPath} must contain unique entries; remove duplicates.`);
    if (legacy.some((id, index) => id !== [...legacy].sort()[index])) AddProblem(`${legacyPath} must be sorted; do not add new games to this frozen list.`);
    const gamesRoot = resolve(root, 'apps/rehabtrainerhub/games');
    const directories = readdirSync(gamesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    for (const id of legacy) {
      if (!directories.includes(id)) AddProblem(`Legacy game ${id} no longer exists as a directory; remove the removed game from ${legacyPath}.`);
    }
    const catalogIds = ReadCatalogIds(readFileSync(resolve(gamesRoot, 'catalog.ts'), 'utf8'));
    for (const id of [...new Set([...directories, ...catalogIds])].sort()) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        AddProblem(`Invalid catalog game ID: ${id}. Use a game directory name.`);
        continue;
      }
      if (legacy.includes(id)) continue;
      const gddPath = `design/gdd/${id}.md`;
      if (!existsSync(resolve(root, gddPath))) {
        AddProblem(`New game ${id} requires ${gddPath} with all six required level-two headings.`);
        continue;
      }
      const source = readFileSync(resolve(root, gddPath), 'utf8');
      const headings = new Set([...source.matchAll(/^## ([^\r\n]+?)[ \t]*\r?$/gm)].map(match => match[1]));
      const missing = requiredHeadings.filter(heading => !headings.has(heading));
      if (missing.length) AddProblem(`${gddPath} is missing required headings: ${missing.map(heading => `## ${heading}`).join(', ')}.`);
    }
  } catch (error) {
    AddProblem(error.message);
  }
  return problems;
}
