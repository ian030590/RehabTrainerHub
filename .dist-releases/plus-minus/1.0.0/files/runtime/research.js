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
    var questionnaire = timeline.indexOf(window.post_task_block);
    if (questionnaire >= 0) timeline.splice(questionnaire, 1);
    [window.add_block, window.minus_block, window.alternate_block].forEach(function(node) { node.questions = node.questions.slice(0, value); });
  };
  function task(row) { return row.trial_id === 'stim' && (row.exp_stage === 'practice' || row.exp_stage === 'test'); }
  function values(serialized) {
    try { return JSON.parse(serialized || '{}'); } catch { return {}; }
  }
  window.rehabResearchRows = function(rows) {
    return rows.filter(task).flatMap(function(r) {
      var practice = r.exp_stage === 'practice';
      var condition = practice ? -1 : ['add','subtract','alternate'].indexOf(r.condition);
      var answers = values(r.responses);
      var responseTimes = values(r.response_times);
      var count = practice ? window.practice_numbers.length : configuredValue;
      return Array.from({ length: count }, function(_, i) {
        var original = Number(practice ? window.practice_numbers[i] : window.numbers[condition * 30 + i]);
        var expected = practice ? original : original + (condition === 0 || (condition === 2 && i % 2 === 0) ? 3 : -3);
        var entry = answers['Q' + i];
        var responseMs = responseTimes['Q' + i];
        return {
          trial_id: 'response', exp_stage: 'test', trial: r.trial_index, question: i + 1,
          practice: practice, condition: condition,
          correct: typeof entry === 'string' && entry.trim() !== '' && Number(entry) === expected,
          rt: typeof responseMs === 'number' && Number.isFinite(responseMs) && responseMs >= 0 ? responseMs : null,
          setting: configuredValue
        };
      });
    });
  };
})();
