(function () {
  'use strict';
  var configuredValue = 0;
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
    if (value === undefined) value = 0;
    if (!Number.isFinite(value) || value < 0 || value > 5000 || Math.abs((value - 0) / 250 - Math.round((value - 0) / 250)) > 1e-8) throw new Error('Invalid responseWindowMs');
    configuredValue = value;
    visit(timeline, function(node) { if (node.data && node.data.trial_id === 'stim') { node.timing_response = value || -1; if (!node.stimulus && typeof node.data.stim_id === 'string') node.stimulus = node.data.stim_id; var match = String(node.data.stim_id).match(/([A-Z])([2-9])/); if (match) { node.data.stim_id = match[0]; node.data.correct_response = node.data.stim_place.indexOf('top') === 0 ? (Number(match[2]) % 2 ? 90 : 77) : ('AEIU'.indexOf(match[1]) < 0 ? 90 : 77); } } });
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
    var previous = null; return rows.filter(task).map(function(r) { var top = String(r.stim_place).indexOf('top') === 0; var mixed = r.condition === 'rotate_switch'; var switched = mixed && previous !== null ? previous !== top : null; previous = mixed ? top : null; return Object.assign(base(r), { condition: ['top_oddeven','bottom_consonantvowel','rotate_switch'].indexOf(r.condition), top: top, switched: switched }); });
  };
})();
