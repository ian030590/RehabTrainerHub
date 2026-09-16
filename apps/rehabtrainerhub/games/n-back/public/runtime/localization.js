window.rehabBilingualize = function () {
      function makeBilingualCenterbox(chinese, english) {
        var englishMarkup = String(english);
        var centerbox = englishMarkup.match(/^\s*<div\s+class\s*=\s*["']?centerbox["']?\s*>([\s\S]*)<\/div>\s*$/i);
        if (centerbox) englishMarkup = centerbox[1];
        return '<div class="centerbox bilingual-centerbox"><div class="bilingual-copy bilingual-copy-zh" lang="zh-TW"><p class="block-text">' + chinese + '</p></div><div class="bilingual-copy bilingual-copy-en" lang="en">' + englishMarkup + '</div></div>';
      }

      var chinesePages = ["字母會逐一出現，不分大小寫。若目前字母與指定的前一、二或三回合字母相同，按左方向鍵；不同則按下方向鍵。每個區段開始前會告知比較間隔。例如間隔為二，序列 g、G、v、T、b、t、b 的最後 t 與 b 應按左鍵，其餘按下鍵。零間隔區段改為比對指定目標字母，例如目標 t 時，t 或 T 都按左鍵。"];
      var instructions = window.instructions_block;
      if (instructions && Array.isArray(instructions.pages)) {
        instructions.pages = instructions.pages.map(function (english, index) {
          return makeBilingualCenterbox(chinesePages[index], english);
        });
      }

      var specs = [["start_practice_block","text","接下來先進行練習。判斷目前字母是否與指定間隔前相同，按 Enter 開始。"],["start_test_block","text","練習結束，接下來進入正式試次。按 Enter 開始。"],["start_control_block","text","接下來進入控制區段。依畫面規則判斷並按 Enter 開始。"],["start_delay_block","text","作答間隔即將改變。請依畫面提示的新規則作答。"],["end_block","text","本次作業已完成。按 Enter 查看當次紀錄。"]];
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
