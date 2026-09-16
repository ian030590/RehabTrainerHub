(function () {
  'use strict';
  var configuredValue = 1850;
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
    var value = settings && settings.responseWindowMs;
    if (value === undefined) value = 1850;
    if (!Number.isFinite(value) || value < 1000 || value > 3000 || Math.abs((value - 1000) / 50 - Math.round((value - 1000) / 50)) > 1e-8) throw new Error('Invalid responseWindowMs');
    configuredValue = value;
    visit(timeline, function(node) { if (node.timing_response === 1850) node.timing_response = value; });
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
    return rows.filter(task).map(function(r) { var stop = r.SS_trial_type === 'stop'; return Object.assign(base(r), { correct: stop ? r.key_press === -1 : r.key_press === r.correct_response, stop: stop, stopDelayMs: stop ? r.SS_delay : null, condition: r.condition === 'high' ? 1 : 0, omission: !stop && r.key_press === -1 }); });
  };
})();
