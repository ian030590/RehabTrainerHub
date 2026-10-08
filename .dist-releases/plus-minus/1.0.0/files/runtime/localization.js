window.rehabBilingualize = function () {
      function makeBilingualCenterbox(chinese, english) {
        var englishMarkup = String(english);
        var centerbox = englishMarkup.match(/^\s*<div\s+class\s*=\s*["']?centerbox["']?\s*>([\s\S]*)<\/div>\s*$/i);
        if (centerbox) englishMarkup = centerbox[1];
        return '<div class="centerbox bilingual-centerbox"><div class="bilingual-copy bilingual-copy-zh" lang="zh-TW"><p class="block-text">' + chinese + '</p></div><div class="bilingual-copy bilingual-copy-en" lang="en">' + englishMarkup + '</div></div>';
      }

      var chinesePages = ["本作業會進行數字加減，請盡量快速且正確作答。先熟悉輸入方式：下一頁請把每個數字照抄到空格。可按 Tab 切換欄位，並使用數字鍵盤輸入。"];
      var instructions = window.instructions_block;
      if (instructions && Array.isArray(instructions.pages)) {
        instructions.pages = instructions.pages.map(function (english, index) {
          return makeBilingualCenterbox(chinesePages[index], english);
        });
      }

      var specs = [["start_add_block","text","接下來每個數字都加三，輸入答案後送出。"],["start_minus_block","text","接下來每個數字都減三，輸入答案後送出。"],["start_alternate_block","text","接下來輪流加三與減三，輸入答案後送出。"],["end_block","text","本次作業已完成。按 Enter 查看當次紀錄。"]];
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
