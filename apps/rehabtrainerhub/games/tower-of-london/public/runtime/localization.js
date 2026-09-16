window.rehabBilingualize = function () {
      function makeBilingualCenterbox(chinese, english) {
        var englishMarkup = String(english);
        var centerbox = englishMarkup.match(/^\s*<div\s+class\s*=\s*["']?centerbox["']?\s*>([\s\S]*)<\/div>\s*$/i);
        if (centerbox) englishMarkup = centerbox[1];
        if (englishMarkup.indexOf('tol_topbox') !== -1) englishMarkup = '<div class="legacy-board-example">' + englishMarkup + '</div>';
        return '<div class="centerbox bilingual-centerbox"><div class="bilingual-copy bilingual-copy-zh" lang="zh-TW"><p class="block-text">' + chinese + '</p></div><div class="bilingual-copy bilingual-copy-en" lang="en">' + englishMarkup + '</div></div>';
      }

      var chinesePages = ["畫面同時顯示目標盤與你的盤面，彩球套在柱子上。第一根柱可放三球，第二根可放兩球，第三根可放一球。","請用最少移動次數，把你的盤面排成目標盤的樣子。目標球固定，只有你的球可移動；有時須先移走上面的球，才能取出下面的球。原版每題提供二十秒作答。","此例中，把你的盤面第一根柱上的紅球移到第三根柱，就會與目標相同。","點選柱子會將最上方的球拿到「手上」，再點另一根柱就會把球放上去。空柱無法取球，已滿的柱無法放球。排成目標後會進入下一題；先用簡單範例熟悉操作。"];
      var instructions = window.instructions_block;
      if (instructions && Array.isArray(instructions.pages)) {
        instructions.pages = instructions.pages.map(function (english, index) {
          return makeBilingualCenterbox(chinesePages[index], english);
        });
      }

      var specs = [["start_test_block","text","請用最少移動次數把起始配置變成目標配置。按 Enter 開始。"],["end_block","text","本次作業已完成。按 Enter 查看當次紀錄。"]];
      specs.push(['feedback_instruct_block', 'text', '歡迎進入本作業。請閱讀操作說明，準備好後按 Enter 繼續。']);
      specs.forEach(function (spec) {
        var trial = window[spec[0]];
        var property = spec[1];
        if (!trial || (typeof trial[property] !== 'string' && typeof trial[property] !== 'function')) return;
        var original = trial[property];
        trial[property] = function () {
          var english = typeof original === 'function' ? original.apply(this, arguments) : original;
          return makeBilingualCenterbox(spec[2], english);
        };
      });
      var questionnaire = window.post_task_block;
      if (questionnaire && Array.isArray(questionnaire.questions) && questionnaire.questions.length) {
        var prompt = '<p class="center-block-text" lang="zh-TW">請簡述這個作業要求你做什麼。</p>';
        if (Array.isArray(questionnaire.questions[0])) questionnaire.questions[0][0] = prompt + questionnaire.questions[0][0];
        else questionnaire.questions[0] = prompt + questionnaire.questions[0];
      }
    };
