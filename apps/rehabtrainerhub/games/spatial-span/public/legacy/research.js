(function () {
  'use strict';
  var configuredValue = 1000;
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
    if (value === undefined) value = 1000;
    if (!Number.isFinite(value) || value < 250 || value > 2000 || Math.abs((value - 250) / 250 - Math.round((value - 250) / 250)) > 1e-8) throw new Error('Invalid itemExposureMs');
    configuredValue = value;
    window.stim_time = value; window.setStims();
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
    return rows.filter(function(r) { return r.exp_stage === 'test' && r.trial_id === 'response'; }).map(function(r) { return Object.assign(base(r), { load: r.num_spaces, reverse: r.condition === 'reverse' }); });
  };
})();
