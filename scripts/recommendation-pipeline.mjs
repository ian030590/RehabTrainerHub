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
const layoutVersion = 1;
const mapMargin = 0.075;
const eigenTolerance = 1e-11;
export const activityMapMinDistance = 0.026;

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

function Mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function Dot(first, second) {
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

export function OrientActivityMapAxis(axis) {
  // The vector follows ascending game ID, so ties keep the first entry.
  const largest = axis.reduce((largest, value) => Math.abs(value) > Math.abs(largest) + eigenTolerance ? value : largest, 0);
  return largest < 0 ? axis.map(value => -value) : axis;
}

function PowerAxis(gram, shift, axes) {
  if (gram.length < 2) return null;
  function Deflate(vector) {
    const mean = Mean(vector);
    for (let index = 0; index < vector.length; index++) vector[index] -= mean;
    for (const axis of axes) {
      const projection = Dot(vector, axis.vector);
      for (let index = 0; index < vector.length; index++) vector[index] -= projection * axis.vector[index];
    }
    return vector;
  }

  // A fixed, nonuniform start avoids the constant null vector of the centered matrix.
  let vector = Deflate(gram.map((_, index) => Math.sin((index + 1) * (axes.length + Math.SQRT2))));
  const startNorm = Math.sqrt(Dot(vector, vector));
  if (startNorm < eigenTolerance) return null;
  vector = vector.map(value => value / startNorm);

  let eigenvalue = 0;
  for (let iteration = 0; iteration < 2000; iteration++) {
    const product = Deflate(gram.map((row, index) => Dot(row, vector) + shift * vector[index]));
    eigenvalue = Dot(vector, product) - shift;
    const residual = Math.hypot(...product.map((value, index) => value - (eigenvalue + shift) * vector[index]));
    if (residual <= eigenTolerance) break;
    const norm = Math.sqrt(Dot(product, product));
    vector = product.map(value => value / norm);
  }
  return eigenvalue > eigenTolerance ? { eigenvalue, vector: OrientActivityMapAxis(vector) } : null;
}

function NormalizeAxis(axis) {
  const min = Math.min(...axis);
  const range = Math.max(...axis) - min;
  return axis.map(value => range > eigenTolerance ? mapMargin + (1 - 2 * mapMargin) * (value - min) / range : 0.5);
}

function SeparateMapPoints(points) {
  const round = value => Number(value.toFixed(4));
  const positions = points.map(point => point.map(round));
  const groups = points.map((_, index) => [index]);
  const owner = points.map((_, index) => index);

  while (true) {
    let merged = false;
    for (const [index, [x, y]] of positions.entries()) {
      for (let other = index + 1; other < positions.length; other++) {
        if (owner[index] === owner[other] || Math.hypot(x - positions[other][0], y - positions[other][1]) >= activityMapMinDistance) continue;
        const first = owner[index];
        const second = owner[other];
        for (const member of groups[second]) owner[member] = first;
        groups[first].push(...groups[second]);
        groups[second] = [];
        merged = true;
      }
    }
    if (!merged) return positions;

    for (const group of groups) {
      if (group.length < 2) continue;
      group.sort((a, b) => a - b);
      // Reserve room for four-decimal rounding between adjacent vertices.
      const radius = (activityMapMinDistance + 0.0002) / (2 * Math.sin(Math.PI / group.length));
      if (radius > 0.5) throw new Error('Activity map cluster exceeds the plot size.');
      const [cx, cy] = [0, 1].map(axis => Math.max(radius, Math.min(1 - radius, Mean(group.map(index => points[index][axis])))));
      for (const [offset, index] of group.entries()) {
        const angle = 2 * Math.PI * offset / group.length;
        positions[index] = [round(cx + radius * Math.cos(angle)), round(cy + radius * Math.sin(angle))];
      }
    }
  }
}

export function BuildActivityMap(gameIds, score) {
  const ids = gameIds.toSorted();
  const squaredDistances = ids.map((id, row) => ids.map((other, column) => row === column ? 0 : (1 - (score(id, other) ?? 0)) ** 2));
  const rowMeans = squaredDistances.map(Mean);
  const overallMean = Mean(rowMeans);
  const gram = squaredDistances.map((row, i) => row.map((value, j) => -0.5 * (value - rowMeans[i] - rowMeans[j] + overallMean)));
  // Similarity need not give Euclidean distances. Shift the spectrum so power iteration finds the largest algebraic eigenvalues.
  const shift = Math.max(0, ...gram.map((row, index) => row.reduce((sum, value) => sum + Math.abs(value), 0) - 2 * row[index]));
  const first = PowerAxis(gram, shift, []);
  const second = first && PowerAxis(gram, shift, [first]);
  const [x, y] = [first, second].map(axis => ids.map((_, index) => axis ? axis.vector[index] * Math.sqrt(axis.eigenvalue) : 0));

  let residual = 0;
  let distanceTotal = 0;
  for (const [i, row] of squaredDistances.entries()) {
    for (let j = i + 1; j < row.length; j++) {
      residual += (Math.hypot(x[i] - x[j], y[i] - y[j]) - Math.sqrt(row[j])) ** 2;
      distanceTotal += row[j];
    }
  }
  const gramVariance = gram.reduce((sum, row) => sum + Dot(row, row), 0);
  const explained = (first?.eigenvalue ?? 0) ** 2 + (second?.eigenvalue ?? 0) ** 2;
  const displayY = NormalizeAxis(y);
  const points = SeparateMapPoints(NormalizeAxis(x).map((value, index) => [value, displayY[index]]));
  return {
    map: Object.fromEntries(ids.map((id, index) => [id, points[index]])),
    stress: distanceTotal ? Math.sqrt(residual / distanceTotal) : 0,
    varianceExplained: gramVariance ? Math.min(1, explained / gramVariance) : 0,
  };
}

function WriteOrCheckArtifact(name, data, check) {
  const path = new URL(`generated/${name}`, recommendationRoot);
  const bytes = Buffer.from(`${JSON.stringify(SortKeys(data), null, 2)}\n`);
  if (!check) {
    writeFileSync(path, bytes);
    return;
  }
  let existing;
  try {
    existing = readFileSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!existing?.equals(bytes)) throw new Error(`${name} is stale; run npm run recommendation:build`);
}

async function RunPipeline(check) {
  const taxonomy = ReadJson('taxonomy.json');
  RequireValid(ValidateTaxonomy(taxonomy));
  console.log('1/6 Loaded and validated taxonomy.');

  const gameFeatures = ReadJson('gameFeatures.json');
  const catalog = await ReadCatalog(gamesRoot);
  RequireValid(ValidateRecommendationData(taxonomy, gameFeatures, catalog));
  console.log('2/6 Validated game features against the official catalog.');

  const entries = Object.entries(gameFeatures.games);
  const games = Object.fromEntries(entries.map(([id, game]) => [id, {
    reviewStatus: game.reviewStatus,
    derivedFunctionTags: DeriveTagLevels(taxonomy, game.functionTags),
  }]));
  console.log('3/6 Derived tag levels.');

  const similarityScores = {};
  const fullScores = new Map();
  for (const [id, game] of Object.entries(games)) {
    const ranked = RankSimilarGames(taxonomy, gameFeatures, id);
    fullScores.set(id, new Map(ranked.map(({ gameId, score }) => [gameId, score])));
    game.neighbors = ranked.slice(0, 5).map(({ gameId, score }) => ({
      gameId, score: Number(score.toFixed(4)),
    }));
    // Keep one score per pair, including eligible matches beyond the admin top five.
    const scores = ranked.filter(({ gameId, score }) => id < gameId && score >= lobbySimilarityThreshold);
    if (scores.length) similarityScores[id] = Object.fromEntries(scores.map(({ gameId, score }) => [gameId, Number(score.toFixed(4))]));
  }
  console.log('4/6 Computed pairwise similarity and top-5 neighbors.');

  const { map, stress, varianceExplained } = BuildActivityMap(catalog.map(({ id }) => id), (a, b) => fullScores.get(a).get(b));
  console.log(`5/6 Computed public activity map. 2D stress: ${stress.toFixed(4)}. Gram variance explained: ${(100 * varianceExplained).toFixed(2)}%.`);

  const inputs = { taxonomy, gameFeatures, catalog: catalog.toSorted((a, b) => a.id < b.id ? -1 : 1), featureSpaceVersion, lobbySimilarityThreshold };
  const inputSha256 = createHash('sha256').update(JSON.stringify(SortKeys(inputs))).digest('hex');
  if (!check) mkdirSync(new URL('generated/', recommendationRoot), { recursive: true });
  WriteOrCheckArtifact('featureIndex.json', { taxonomyVersion: taxonomy.taxonomyVersion, featureSpaceVersion, inputSha256, games, similarityScores }, check);
  WriteOrCheckArtifact('activityMap.json', { featureInputSha256: inputSha256, layoutVersion, map }, check);
  console.log(`6/6 ${check ? 'Checked' : 'Wrote'} featureIndex.json and activityMap.json.`);

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
