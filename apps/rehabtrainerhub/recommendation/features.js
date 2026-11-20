export const featureSpaceVersion = '2.0.0';
export const similarityWeights = Object.freeze({ function: 0.7, taskDemand: 0.3 });
export const lobbySimilarityThreshold = 0.5;

const tagFields = { function: 'functionTags', taskDemand: 'taskDemandTags' };
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const dimensionPattern = /^[a-z][a-z0-9_]*$/;
const tagPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const capabilityPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const frameworkPattern = /^[a-z][a-z0-9-]*$/;
const levelValues = new Set([0, 1, 2]);
const mediaRules = {
  none: { camera: false, microphone: false, mediaFree: true },
  camera: { camera: true, microphone: false, mediaFree: false },
  'camera-optional': { camera: true, microphone: false, mediaFree: true },
  'camera-or-microphone': { camera: true, microphone: true, mediaFree: false },
};

function IsRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function HasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function ValidateText(value, path, report) {
  if (!IsRecord(value) || !HasText(value['zh-TW']) || !HasText(value.en)) {
    report('R06', path, '須提供繁體中文與英文。');
  }
  if (/治療|診斷|療效|改善|提升|矯正/u.test(typeof value?.['zh-TW'] === 'string' ? value['zh-TW'] : '')
    || /\b(?:treat\w*|therap\w*|diagnos\w*|cur(?:e|es|ed|ing|ative)|improv\w*|efficacy)\b/i
      .test(typeof value?.en === 'string' ? value.en : '')) {
    report('R07', path, '含限制用詞。');
  }
}

function IndexDefinitions(items, idKey, pattern, path, rule, report) {
  const index = new Map();
  if (!Array.isArray(items) || items.length === 0) {
    report(rule, path, '須提供至少一筆定義。');
    return index;
  }
  for (const [position, item] of items.entries()) {
    const id = item?.[idKey];
    if (!IsRecord(item) || typeof id !== 'string' || !pattern.test(id)) {
      report(rule, `${path}[${position}].${idKey}`, '識別碼格式無效。');
      continue;
    }
    if (index.has(id)) report(rule, `${path}.${id}`, '識別碼重複。');
    index.set(id, item);
  }
  return index;
}

function CheckTaxonomy(taxonomy, report) {
  if (typeof taxonomy?.taxonomyVersion !== 'string' || !versionPattern.test(taxonomy.taxonomyVersion)) {
    report('R01', 'taxonomy.taxonomyVersion', '須使用語意化版本號。');
  }
  const frameworks = IndexDefinitions(taxonomy?.frameworks, 'id', frameworkPattern, 'taxonomy.frameworks', 'R02', report);
  const dimensions = IndexDefinitions(taxonomy?.dimensions, 'id', dimensionPattern, 'taxonomy.dimensions', 'R03', report);
  const tags = IndexDefinitions(taxonomy?.tags, 'id', tagPattern, 'taxonomy.tags', 'R03', report);
  const icfCodes = IndexDefinitions(taxonomy?.icfCodes, 'code', /^[bd]\d{3,5}$/, 'taxonomy.icfCodes', 'R04', report);
  const capabilities = IndexDefinitions(taxonomy?.capabilities, 'id', capabilityPattern, 'taxonomy.capabilities', 'R16', report);
  const parents = new Set();
  const usedCodes = new Set();
  for (const [id, framework] of frameworks) {
    if (!HasText(framework.name) || !HasText(framework.citation)) {
      report('R02', `taxonomy.frameworks.${id}`, '須提供框架名稱與引文。');
    }
  }
  for (const [id, dimension] of dimensions) {
    const path = `taxonomy.dimensions.${id}`;
    if (!frameworks.has(dimension.frameworkId)) report('R02', `${path}.frameworkId`, '找不到對應的框架。');
    if (!Object.hasOwn(tagFields, dimension.group) || !['single', 'multiple'].includes(dimension.selection)
      || dimension.required !== (dimension.group === 'taskDemand')
      || (dimension.group === 'function' && dimension.selection !== 'multiple')) {
      report('R03', path, '維度的群組、選擇方式或必填設定無效。');
    }
    ValidateText(dimension.labels, `${path}.labels`, report);
  }
  for (const [id, capability] of capabilities) {
    ValidateText(capability.labels, `taxonomy.capabilities.${id}.labels`, report);
  }
  for (const [id, tag] of tags) {
    const path = `taxonomy.tags.${id}`;
    const dimension = dimensions.get(tag.dimension);
    if (!dimension || !id.startsWith(`${tag.dimension}.`)) {
      report('R03', path, '標籤 ID 須以所屬維度加句點開頭。');
    }
    if (!['active', 'deprecated'].includes(tag.status)) report('R03', `${path}.status`, '標籤狀態無效。');
    if (dimension?.group === 'function' || Object.hasOwn(tag, 'icfCode')) {
      if (!icfCodes.has(tag.icfCode)) report('R04', `${path}.icfCode`, '須使用字典收錄的 ICF 代碼。');
      else usedCodes.add(tag.icfCode);
    }
    if (Object.hasOwn(tag, 'parent')) {
      const parent = tags.get(tag.parent);
      if (!parent || parent.dimension !== tag.dimension) {
        report('R05', `${path}.parent`, '父標籤須存在於同一維度。');
      } else {
        parents.add(parent.id);
        const visited = new Set([id]);
        for (let ancestor = parent; ancestor; ancestor = tags.get(ancestor.parent)) {
          if (visited.has(ancestor.id)) {
            report('R05', `${path}.parent`, '父標籤形成循環。');
            break;
          }
          visited.add(ancestor.id);
        }
      }
    }
    ValidateText(tag.labels, `${path}.labels`, report);
    ValidateText(tag.definition, `${path}.definition`, report);
    if (tag.status === 'deprecated' || Object.hasOwn(tag, 'replacementTagId')) {
      const replacement = tags.get(tag.replacementTagId);
      if (tag.status !== 'deprecated' || replacement?.status !== 'active' || replacement.dimension !== tag.dimension) {
        report('R08', `${path}.replacementTagId`, '停用標籤須指定同維度的啟用標籤。');
      }
    }
    if (tag.dimension === 'response_modality' && (!Array.isArray(tag.requiresAnyCapability)
      || !tag.requiresAnyCapability.length || tag.requiresAnyCapability.some(id => !capabilities.has(id)))) {
      report('R16', `${path}.requiresAnyCapability`, '反應方式須指定已登記的裝置能力。');
    }
  }
  for (const [code, entry] of icfCodes) {
    if (!IsRecord(entry.title) || !HasText(entry.title.en) || !HasText(entry.title['zh-TW'])) {
      report('R04', `taxonomy.icfCodes.${code}.title`, '須提供英文與繁體中文名稱。');
    }
    if (!usedCodes.has(code)) {
      report('R04', `taxonomy.icfCodes.${code}`, '須有標籤引用此代碼。');
    }
  }

  const leaves = new Map(Array.from(dimensions.keys(), id => [id, []]));
  for (const [id, tag] of tags) {
    if (!parents.has(id) && tag.status === 'active') leaves.get(tag.dimension)?.push(tag);
  }
  for (const [id, dimension] of dimensions) {
    if (!leaves.get(id).length && dimension.required) report('R12', `taxonomy.dimensions.${id}`, '必填維度須有啟用的葉標籤。');
  }
  return { dimensions, tags, capabilities, leaves };
}

export function ValidateTaxonomy(taxonomy) {
  const errors = [];
  CheckTaxonomy(taxonomy, (rule, path, message) => errors.push(`[${rule}] ${path} ${message}`));
  return { ok: errors.length === 0, errors };
}

function CheckGameTags(game, taxonomy, path, report) {
  const { tags, dimensions, leaves } = taxonomy;
  const activeLeaves = new Set(Array.from(leaves.values()).flat().map(tag => tag.id));
  const primary = new Set();
  for (const [group, field] of Object.entries(tagFields)) {
    if (!IsRecord(game[field])) {
      report('R11', `${path}.${field}`, '須提供標籤與等級的對照。');
      continue;
    }
    for (const [id, level] of Object.entries(game[field])) {
      if (!activeLeaves.has(id) || dimensions.get(tags.get(id)?.dimension)?.group !== group || !levelValues.has(level)) {
        report('R11', `${path}.${field}.${id}`, '須為此群組啟用的葉標籤，等級須為 0、1 或 2。');
      } else if (group === 'function' && level === 2) {
        primary.add(id);
      }
    }
  }
  for (const [id, dimension] of dimensions) {
    if (dimension.group !== 'taskDemand') continue;
    const levelMap = game.taskDemandTags;
    const pathToDimension = `${path}.taskDemandTags.${id}`;
    const levels = leaves.get(id).map(tag => Object.hasOwn(levelMap ?? {}, tag.id) ? levelMap[tag.id] : undefined);
    if (dimension.required && levels.some(level => !levelValues.has(level))) {
      report('R12', pathToDimension, '須標註此維度的每個啟用葉標籤。');
    }
    if (dimension.selection === 'single'
      && (levels.filter(level => level === 2).length !== 1 || levels.some(level => level !== 0 && level !== 2))) {
      report('R13', pathToDimension, '單選維度限一項為 2，其餘為 0。');
    }
  }
  if (!primary.size) report('R14', `${path}.functionTags`, '至少須有一個主要功能標籤。');
  if (!IsRecord(game.evidence)) report('R15', `${path}.evidence`, '須提供主要功能標籤的中文依據。');
  for (const id of primary) {
    if (typeof game.evidence?.[id] !== 'string' || !/\p{Script=Han}/u.test(game.evidence[id])) {
      report('R15', `${path}.evidence.${id}`, '須提供一則中文玩家行為描述。');
    }
  }
  for (const id of Object.keys(game.evidence ?? {})) {
    if (!primary.has(id)) report('R15', `${path}.evidence.${id}`, '僅主要功能標籤可填寫依據。');
  }
}

function CheckSetups(game, taxonomy, mediaPermission, path, report) {
  const setups = game.supportedSetups;
  const location = `${path}.supportedSetups`;
  if (!Array.isArray(setups) || !setups.length) {
    report('R16', location, '須提供至少一種裝置配置。');
    return;
  }
  const responses = (taxonomy.leaves.get('response_modality') ?? [])
    .filter(tag => levelValues.has(game.taskDemandTags?.[tag.id]) && game.taskDemandTags[tag.id] >= 1);
  const justified = new Set(responses.flatMap(tag => tag.requiresAnyCapability ?? []));
  const used = new Set();
  const setupIds = new Set();
  let mediaFree = false;
  let cameraWithoutMicrophone = false;
  let microphoneWithoutCamera = false;
  for (const [index, setup] of setups.entries()) {
    const setupPath = `${location}[${index}]`;
    if (!HasText(setup?.id) || setupIds.has(setup.id)) report('R16', `${setupPath}.id`, '裝置配置 ID 須有值且不可重複。');
    setupIds.add(setup?.id);
    const capabilities = setup?.allCapabilities;
    if (!Array.isArray(capabilities) || !capabilities.length || new Set(capabilities).size !== capabilities.length) {
      report('R16', `${setupPath}.allCapabilities`, '須列出裝置能力，且不可重複。');
      continue;
    }
    for (const id of capabilities) {
      const capability = taxonomy.capabilities.get(id);
      if (!capability || (!justified.has(id) && capability.auxiliary !== true)) {
        const name = typeof id === 'string' ? id : '（格式無效）';
        report('R16', `${setupPath}.allCapabilities`, `裝置能力 ${name} 未登記或無相應的反應方式。`);
      }
      used.add(id);
    }
    const camera = capabilities.includes('camera');
    const microphone = capabilities.includes('microphone');
    mediaFree ||= !camera && !microphone;
    cameraWithoutMicrophone ||= camera && !microphone;
    microphoneWithoutCamera ||= microphone && !camera;
  }
  for (const tag of responses) {
    if (!Array.isArray(tag.requiresAnyCapability) || !tag.requiresAnyCapability.some(id => used.has(id))) {
      report('R16', `${path}.taskDemandTags.${tag.id}`, '須有相容的裝置配置。');
    }
  }
  const media = typeof mediaPermission === 'string' && Object.hasOwn(mediaRules, mediaPermission)
    ? mediaRules[mediaPermission]
    : undefined;
  if (!media || used.has('camera') !== media.camera || used.has('microphone') !== media.microphone
    || mediaFree !== media.mediaFree
    || (mediaPermission === 'camera-or-microphone' && (!cameraWithoutMicrophone || !microphoneWithoutCamera))) {
    const permission = typeof mediaPermission === 'string' ? mediaPermission : '（權限缺漏或格式無效）';
    report('R17', location, `相機／麥克風配置與官方目錄的 ${permission} 權限不符。`);
  }
}

export function ValidateRecommendationData(taxonomy, gameFeatures, catalog) {
  const errors = [];
  const report = (rule, path, message) => errors.push(`[${rule}] ${path} ${message}`);
  const indexed = CheckTaxonomy(taxonomy, report);
  if (gameFeatures?.taxonomyVersion !== taxonomy?.taxonomyVersion) {
    report('R01', 'gameFeatures.taxonomyVersion', '須與標籤字典版本相同。');
  }
  if (gameFeatures?.schemaVersion !== 2) report('R01', 'gameFeatures.schemaVersion', '須為 2。');
  if (!IsRecord(gameFeatures?.games) || !Array.isArray(catalog)) {
    report('R10', 'gameFeatures.games', '須提供活動資料與官方目錄。');
    return { ok: false, errors };
  }

  const expected = new Map();
  for (const entry of catalog) {
    if (!HasText(entry?.id) || expected.has(entry.id)) {
      report('R10', 'catalog', '官方目錄 ID 須有值且不可重複。');
      continue;
    }
    expected.set(entry.id, entry.mediaPermission);
    if (!Object.hasOwn(gameFeatures.games, entry.id)) {
      report('R10', `gameFeatures.games.${entry.id}`, '缺少官方活動資料。');
    }
  }
  for (const [id, game] of Object.entries(gameFeatures.games)) {
    const path = `gameFeatures.games.${id}`;
    if (!expected.has(id)) report('R10', path, '此活動未登記於官方目錄。');
    if (!IsRecord(game)) {
      report('R11', path, '須提供活動的標籤資料。');
      continue;
    }
    CheckGameTags(game, indexed, path, report);
    CheckSetups(game, indexed, expected.get(id), path, report);
    if (game.reviewStatus !== 'draft' && game.reviewStatus !== 'confirmed') {
      report('R18', `${path}.reviewStatus`, '須為 draft 或 confirmed。');
    }
  }
  return { ok: errors.length === 0, errors };
}

export function DeriveTagLevels(taxonomy, tags) {
  const active = new Map(taxonomy.tags.filter(tag => tag.status === 'active').map(tag => [tag.id, tag]));
  const levels = { ...tags };
  for (const [id, level] of Object.entries(tags)) {
    for (let parent = active.get(active.get(id)?.parent); parent; parent = active.get(parent.parent)) {
      levels[parent.id] = Math.max(levels[parent.id] ?? 0, level);
    }
  }
  return levels;
}

function CompareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function ActiveGroupTags(taxonomy, group) {
  const dimensions = new Set(taxonomy.dimensions.filter(dimension => dimension.group === group).map(dimension => dimension.id));
  return taxonomy.tags.filter(tag => tag.status === 'active' && dimensions.has(tag.dimension));
}

function CompareTagGroup(tags, a, b) {
  let dot = 0;
  let sharedSquaresA = 0;
  let sharedSquaresB = 0;
  let unionSquares = 0;
  for (const { id } of tags) {
    const levelA = Object.hasOwn(a, id) ? a[id] : null;
    const levelB = Object.hasOwn(b, id) ? b[id] : null;
    const squareA = (levelA ?? 0) ** 2;
    const squareB = (levelB ?? 0) ** 2;
    unionSquares += squareA + squareB;
    if (levelA === null || levelB === null) continue;
    dot += levelA * levelB;
    sharedSquaresA += squareA;
    sharedSquaresB += squareB;
  }
  const coverage = unionSquares ? (sharedSquaresA + sharedSquaresB) / unionSquares : null;
  const score = sharedSquaresA && sharedSquaresB
    ? (dot / Math.sqrt(sharedSquaresA * sharedSquaresB)) * coverage
    : null;
  return { score, coverage };
}

export function GameSimilarity(taxonomy, a, b) {
  const functional = CompareTagGroup(ActiveGroupTags(taxonomy, 'function'),
    DeriveTagLevels(taxonomy, a.functionTags), DeriveTagLevels(taxonomy, b.functionTags));
  const demand = CompareTagGroup(ActiveGroupTags(taxonomy, 'taskDemand'),
    DeriveTagLevels(taxonomy, a.taskDemandTags), DeriveTagLevels(taxonomy, b.taskDemandTags));
  const score = functional.score === null && demand.score === null
    ? null
    : (functional.score ?? 0) * similarityWeights.function + (demand.score ?? 0) * similarityWeights.taskDemand;
  return {
    score,
    function: functional.score,
    taskDemand: demand.score,
    coverage: { function: functional.coverage, taskDemand: demand.coverage },
  };
}

function SharedTags(taxonomy, a, b) {
  const levelsA = DeriveTagLevels(taxonomy, a.functionTags);
  const levelsB = DeriveTagLevels(taxonomy, b.functionTags);
  return ActiveGroupTags(taxonomy, 'function')
    .filter(({ id }) => levelsA[id] >= 1 && levelsB[id] >= 1)
    .map(({ id }) => ({ id, level: levelsA[id] + levelsB[id] }))
    .sort((first, second) => second.level - first.level || CompareIds(first.id, second.id))
    .map(tag => tag.id);
}

export function RankSimilarGames(taxonomy, gameFeatures, gameId) {
  if (!Object.hasOwn(gameFeatures.games, gameId)) return [];
  const target = gameFeatures.games[gameId];
  const matches = [];
  for (const [id, game] of Object.entries(gameFeatures.games)) {
    if (id === gameId) continue;
    const { score } = GameSimilarity(taxonomy, target, game);
    if (score !== null) matches.push({ gameId: id, score });
  }
  return matches.sort((a, b) => b.score - a.score || CompareIds(a.gameId, b.gameId));
}

export function SimilarGames(taxonomy, gameFeatures, gameId, { limit = 5 } = {}) {
  if (limit <= 0) return [];
  const target = gameFeatures.games[gameId];
  return RankSimilarGames(taxonomy, gameFeatures, gameId)
    .slice(0, limit)
    .map(match => ({ ...match, sharedTags: SharedTags(taxonomy, target, gameFeatures.games[match.gameId]) }));
}
