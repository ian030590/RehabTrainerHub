(function () {
  'use strict';
  var configuredValue = 500;
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
    var value = settings && settings.exposureMs;
    if (value === undefined) value = 500;
    if (!Number.isFinite(value) || value < 100 || value > 1000 || Math.abs((value - 100) / 100 - Math.round((value - 100) / 100)) > 1e-8) throw new Error('Invalid exposureMs');
    configuredValue = value;
    visit(timeline, function(node) { if (node.timing_stim === 500 && node.timing_response === 2000) node.timing_stim = value; });
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
    return rows.filter(task).map(function(r) { return Object.assign(base(r), { load: r.load, match: String(r.stim).toLowerCase() === String(r.target).toLowerCase() }); });
  };
})();
