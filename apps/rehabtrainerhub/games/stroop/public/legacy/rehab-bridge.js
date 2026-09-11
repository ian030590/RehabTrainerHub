(function () {
  'use strict';

  var startType = 'rehab-expfactory:start';
  var abortType = 'rehab-expfactory:abort';
  var completeType = 'rehab-expfactory:complete';
  var started = false;
  var aborted = false;
  var gameId = document.body.dataset.gameId;
  var timelineName = document.body.dataset.timeline;

  function post(message) {
    window.parent.postMessage(message, window.location.origin);
  }

  function isCorrect(value) {
    return value === true || value === 1 || value === 'true';
  }

  function summarize(rows) {
    var testRows = rows.filter(function (row) {
      return row && row.exp_stage === 'test'
        && (row.trial_id === 'stim' || row.trial_id === 'response' || row.trial_id === 'to_board');
    });
    var taskRows = testRows.length ? testRows : rows.filter(function (row) {
      return row && (row.trial_id === 'stim' || row.trial_id === 'response' || row.trial_id === 'to_board');
    });
    var scoredRows = taskRows.filter(function (row) {
      return typeof row.correct === 'boolean' || row.correct === 0 || row.correct === 1 || row.correct === 'true' || row.correct === 'false';
    });
    var correctTrials = scoredRows.filter(function (row) {
      return isCorrect(row.correct);
    }).length;
    var responseTimes = taskRows.map(function (row) {
      return typeof row.rt === 'number' ? row.rt : NaN;
    }).filter(function (rt) {
      return Number.isFinite(rt) && rt >= 0;
    });

    return {
      rows: taskRows,
      summary: {
        totalTrials: taskRows.length,
        scoredTrials: scoredRows.length,
        correctTrials: correctTrials,
        accuracyPercent: scoredRows.length ? correctTrials / scoredRows.length * 100 : null,
        meanRtMs: responseTimes.length
          ? responseTimes.reduce(function (total, rt) { return total + rt; }, 0) / responseTimes.length
          : null
      }
    };
  }

  function startExperiment(settings) {
    if (started) return;
    started = true;

    try {
      if (typeof window.rehabBilingualize === 'function') window.rehabBilingualize();
      var originalTimeline = window[timelineName];
      if (!Array.isArray(originalTimeline)) throw new Error('Original jsPsych timeline was not found.');
      var timeline = originalTimeline.slice();
      if (window.rehabConfigure) window.rehabConfigure(settings, timeline);

      window.jsPsych.init({
        timeline: timeline,
        display_element: 'getDisplayElement',
        fullscreen: false,
        on_trial_finish: function () {
          if (typeof window.addID === 'function') window.addID(gameId);
        },
        on_finish: function () {
          if (aborted) return;
          var rows = JSON.parse(window.jsPsych.data.dataAsJSON());
          var result = summarize(window.rehabResearchRows ? window.rehabResearchRows(rows) : rows);
          post({
            type: completeType,
            gameId: gameId,
            summary: result.summary,
            trials: result.rows
          });
        }
      });
    } catch (error) {
      post({
        type: 'rehab-expfactory:error',
        gameId: gameId,
        message: error instanceof Error ? error.message : 'Unable to start the original experiment.'
      });
    }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent || !event.data) return;
    if (event.data.type === startType) {
      startExperiment(event.data.settings);
    } else if (event.data.type === abortType) {
      aborted = true;
      if (started && window.jsPsych && typeof window.jsPsych.endExperiment === 'function') {
        window.jsPsych.endExperiment();
      }
    }
  });
})();
