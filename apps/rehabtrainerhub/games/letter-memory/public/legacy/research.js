(function () {
  'use strict';
  var configuredValue = 2000;
  function visit(nodes, apply, seen) {
    seen = seen || new Set();
    nodes.forEach(function(node) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      apply(node);
      if (Array.isArray(node.timeline)) visit(node.timeline, apply, seen);
    });
  }
  window.rehabConfigure = function(settings, timeline) {
    var value = settings && settings.itemExposureMs;
    if (value === undefined) value = 2000;
    if (!Number.isFinite(value) || value < 500 || value > 3000 || Math.abs((value - 500) / 100 - Math.round((value - 500) / 100)) > 1e-8) throw new Error('Invalid itemExposureMs');
    configuredValue = value;
    visit(timeline, function(node) { if (node.timing_stim === 2000) { node.timing_stim = value; node.timing_response = value; } });
  };
  function task(row) { return row.exp_stage === 'test' && row.trial_id === 'stim'; }
  function base(row) {
    var correct = typeof row.correct === 'boolean' ? row.correct : row.correct === 1 || row.correct === 'true' ? true : row.correct === 0 || row.correct === 'false' ? false : typeof row.correct_response === 'number' ? row.key_press === row.correct_response : null;
    return { trial_id: 'response', exp_stage: 'test', trial: row.trial_index, correct: correct, rt: typeof row.rt === 'number' && Number.isFinite(row.rt) && row.rt >= 0 ? row.rt : null, key: typeof row.key_press === 'number' ? row.key_press : null, setting: configuredValue };
  }
  function responses(row) {
    try { return JSON.parse(row.responses || '{}'); } catch { return {}; }
  }
  window.rehabResearchRows = function(rows) {
    var letters = []; return rows.flatMap(function(r) { if (r.exp_stage !== 'test') return []; if (r.trial_id === 'stim') { letters.push(String(r.stimulus).replace(/<[^>]*>/g, '').trim()); return []; } if (r.trial_id !== 'response') return []; var expected = letters.slice(-4).join('').toUpperCase(); var answer = String(responses(r).Q0 || '').replace(/[\s,;]+/g, '').toUpperCase(); var count = expected.split('').filter(function(letter, i) { return answer[i] === letter; }).length; var length = letters.length; letters = []; return [Object.assign(base(r), { correct: answer === expected, correctItems: count, load: length, requiredItems: 4 })]; });
  };
})();
