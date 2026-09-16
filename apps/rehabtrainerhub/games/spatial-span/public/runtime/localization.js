window.rehabBilingualize = function () {
      function makeBilingualCenterbox(chinese, english) {
        var englishMarkup = String(english);
        var centerbox = englishMarkup.match(/^\s*<div\s+class\s*=\s*["']?centerbox["']?\s*>([\s\S]*)<\/div>\s*$/i);
        if (centerbox) englishMarkup = centerbox[1];
        return '<div class="centerbox bilingual-centerbox"><div class="bilingual-copy bilingual-copy-zh" lang="zh-TW"><p class="block-text">' + chinese + '</p></div><div class="bilingual-copy bilingual-copy-en" lang="en">' + englishMarkup + '</div></div>';
      }

      var chinesePages = ["方格會依序閃紅，請記住閃爍順序。每回合結束後，依剛才的順序點選方格。請靠記憶作答，不要抄寫或使用外部工具。結束說明後即開始。"];
      var instructions = window.instructions_block;
      if (instructions && Array.isArray(instructions.pages)) {
        instructions.pages = instructions.pages.map(function (english, index) {
          return makeBilingualCenterbox(chinesePages[index], english);
        });
      }

      var specs = [["start_test_block","text","請依原順序回想亮起的位置。準備好後按 Enter 開始。"],["start_reverse_block","text","接下來請依相反順序回想亮起的位置。準備好後按 Enter 開始。"],["end_block","text","本次作業已完成。按 Enter 查看當次紀錄。"]];
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
