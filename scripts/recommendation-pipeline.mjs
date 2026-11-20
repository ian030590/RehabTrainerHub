import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DeriveTagLevels,
  featureSpaceVersion,
  lobbySimilarityThreshold,
  RankSimilarGames,
  ValidateRecommendationData,
  ValidateTaxonomy,
} from '../apps/rehabtrainerhub/recommendation/features.js';

const gamesRoot = new URL('../apps/rehabtrainerhub/games/', import.meta.url);
const recommendationRoot = new URL('../apps/rehabtrainerhub/recommendation/', import.meta.url);
const indexPath = new URL('generated/featureIndex.json', recommendationRoot);

export async function ReadCatalog(root) {
  const source = readFileSync(new URL('catalog.ts', root), 'utf8');
  const seeds = source.match(/^const seeds: readonly TrainingCatalogSeed\[\] = \[\r?\n([\s\S]*?)^\] as const;/m)?.[1];
  if (!seeds) throw new Error('[R10] catalog.ts Could not read the catalog seeds array.');
  const { trainingModuleFlowManifest } = await import(new URL('moduleFlowManifest.ts', root).href);
  const catalog = [];
  const entries = [...seeds.matchAll(/^  \{\r?\n([\s\S]*?)^  \},?/gm)];
  if (!entries.length || seeds.replace(/^  \{\r?\n[\s\S]*?^  \},?/gm, '').trim()) {
    throw new Error('[R10] catalog.ts Expected one object per catalog seed.');
  }
  const manifestById = new Map();
  for (const [key, entry] of Object.entries(trainingModuleFlowManifest)) {
    const id = key.split(':')[1];
    if (!id || manifestById.has(id)) throw new Error(`[R10] moduleFlowManifest.ts Invalid or duplicate game ID in ${key}.`);
    manifestById.set(id, entry);
  }
  for (const [, seed] of entries) {
    const id = seed.match(/^    id: ['"]([a-z0-9-]+)['"],\s*$/m)?.[1];
    if (!id) throw new Error('[R10] catalog.ts Each catalog seed must declare a literal ID.');
    const flow = manifestById.get(id);
    if (!flow) throw new Error(`[R17] catalog.${id} Missing media permission in the training flow manifest.`);
    catalog.push({ id, mediaPermission: flow.mediaPermission });
  }
  return catalog;
}

function SortKeys(value) {
  if (Array.isArray(value)) return value.map(SortKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, SortKeys(value[key])]));
}

function ReadJson(name) {
  return JSON.parse(readFileSync(new URL(name, recommendationRoot), 'utf8'));
}

function RequireValid(result) {
  if (!result.ok) throw new Error(result.errors.join('\n'));
}

async function RunPipeline(check) {
  const taxonomy = ReadJson('taxonomy.json');
  RequireValid(ValidateTaxonomy(taxonomy));
  console.log('1/5 Loaded and validated taxonomy.');

  const gameFeatures = ReadJson('gameFeatures.json');
  const catalog = await ReadCatalog(gamesRoot);
  RequireValid(ValidateRecommendationData(taxonomy, gameFeatures, catalog));
  console.log('2/5 Validated game features against the official catalog.');

  const entries = Object.entries(gameFeatures.games);
  const games = Object.fromEntries(entries.map(([id, game]) => [id, {
    reviewStatus: game.reviewStatus,
    derivedFunctionTags: DeriveTagLevels(taxonomy, game.functionTags),
  }]));
  console.log('3/5 Derived tag levels.');

  const similarityScores = {};
  for (const [id, game] of Object.entries(games)) {
    const ranked = RankSimilarGames(taxonomy, gameFeatures, id);
    game.neighbors = ranked.slice(0, 5).map(({ gameId, score }) => ({
      gameId, score: Number(score.toFixed(4)),
    }));
    // Keep one score per pair, including eligible matches beyond the admin top five.
    const scores = ranked.filter(({ gameId, score }) => id < gameId && score >= lobbySimilarityThreshold);
    if (scores.length) similarityScores[id] = Object.fromEntries(scores.map(({ gameId, score }) => [gameId, Number(score.toFixed(4))]));
  }
  console.log('4/5 Computed pairwise similarity and top-5 neighbors.');

  const inputs = { taxonomy, gameFeatures, catalog: catalog.toSorted((a, b) => a.id < b.id ? -1 : 1), featureSpaceVersion, lobbySimilarityThreshold };
  const inputSha256 = createHash('sha256').update(JSON.stringify(SortKeys(inputs))).digest('hex');
  const index = SortKeys({ taxonomyVersion: taxonomy.taxonomyVersion, featureSpaceVersion, inputSha256, games, similarityScores });
  const bytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
  if (check) {
    let existing;
    try {
      existing = readFileSync(indexPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!existing?.equals(bytes)) throw new Error('featureIndex.json is stale; run npm run recommendation:build');
  } else {
    mkdirSync(new URL('generated/', recommendationRoot), { recursive: true });
    writeFileSync(indexPath, bytes);
  }
  console.log(`5/5 ${check ? 'Checked' : 'Wrote'} featureIndex.json.`);

  const parents = new Set(taxonomy.tags.map(tag => tag.parent));
  const coverage = taxonomy.dimensions.map(({ id, group }) => {
    const leaves = taxonomy.tags.filter(tag => tag.dimension === id && tag.status === 'active' && !parents.has(tag.id));
    const field = group === 'function' ? 'functionTags' : 'taskDemandTags';
    const known = entries.reduce((count, [, game]) => count + leaves.filter(tag => Object.hasOwn(game[field], tag.id)).length, 0);
    return `${id}=${known}/${entries.length * leaves.length}`;
  });
  const draft = entries.filter(([, game]) => game.reviewStatus === 'draft').length;
  console.log(`Summary: ${entries.length} games, ${draft} draft, ${entries.length - draft} confirmed. Coverage: ${coverage.join(', ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await RunPipeline(process.argv.includes('--check'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
