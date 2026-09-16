(function () {
  'use strict';
  var configuredValue = 30;
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
    var value = settings && settings.itemsPerList;
    if (value === undefined) value = 30;
    if (!Number.isFinite(value) || value < 6 || value > 30 || Math.abs((value - 6) / 6 - Math.round((value - 6) / 6)) > 1e-8) throw new Error('Invalid itemsPerList');
    configuredValue = value;
    [window.add_block, window.minus_block, window.alternate_block].forEach(function(node) { node.questions = node.questions.slice(0, value); });
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
    return rows.filter(task).map(function(r) { var condition = ['add','subtract','alternate'].indexOf(r.condition); var answer = responses(r); var count = 0; for (var i = 0; i < configuredValue; i++) { var original = Number(window.numbers[condition * 30 + i]); var expected = original + (condition === 0 || (condition === 2 && i % 2 === 0) ? 3 : -3); var entry = answer['Q' + i]; if (typeof entry === 'string' && entry.trim() !== '' && Number(entry) === expected) count++; } return Object.assign(base(r), { correct: count === configuredValue, correctItems: count, requiredItems: configuredValue, condition: condition }); });
  };
})();
