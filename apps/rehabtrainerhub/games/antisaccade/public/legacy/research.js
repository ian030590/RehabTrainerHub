(function () {
  'use strict';
  var configuredValue = 150;
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
    if (value === undefined) value = 150;
    if (!Number.isFinite(value) || value < 50 || value > 300 || Math.abs((value - 50) / 25 - Math.round((value - 50) / 25)) > 1e-8) throw new Error('Invalid exposureMs');
    configuredValue = value;
    visit(timeline, function(node) { if (node.data && node.data.trial_id === 'target') { node.timing_stim = value; node.timing_response = value; } });
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
    return rows.flatMap(function(r, index) { if (r.exp_stage !== 'test' || r.trial_id !== 'target') return []; var mask = rows[index + 1]; var duringTarget = typeof r.rt === 'number' && r.rt >= 0; var duringMask = mask && mask.trial_id === 'mask' && typeof mask.rt === 'number' && mask.rt >= 0; var answer = duringTarget ? r.key_press : duringMask ? mask.key_press : -1; return [Object.assign(base(r), { correct: answer === r.correct_response, rt: duringTarget ? r.rt : duringMask ? configuredValue + mask.rt : null, omission: answer === -1, location: r.arrow_placement === 'left' ? 0 : 1, key: answer, exposureMs: configuredValue })]; });
  };
})();
