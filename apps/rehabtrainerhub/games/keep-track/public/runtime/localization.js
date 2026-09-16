window.rehabBilingualize = function () {
      function makeBilingualCenterbox(chinese, english) {
        var englishMarkup = String(english);
        var centerbox = englishMarkup.match(/^\s*<div\s+class\s*=\s*["']?centerbox["']?\s*>([\s\S]*)<\/div>\s*$/i);
        if (centerbox) englishMarkup = centerbox[1];
        return '<div class="centerbox bilingual-centerbox"><div class="bilingual-copy bilingual-copy-zh" lang="zh-TW"><p class="block-text">' + chinese + '</p></div><div class="bilingual-copy bilingual-copy-en" lang="en">' + englishMarkup + '</div></div>';
      }

      var chinesePages = ["單字會依序出現，分屬動物、顏色、國家、距離、金屬與親屬六類。畫面會指定其中三至五類為目標；請記住每個目標類別最後出現的單字，並在回合結束後輸入。","下方列出各類別的英文單字。請確認每個字所屬的類別：animals＝動物、colors＝顏色、countries＝國家、distances＝距離、metals＝金屬、relatives＝親屬。作答時請輸入畫面呈現的英文單字。","每回合先顯示三至五個目標類別，再依序顯示六類中的單字。例如目標為顏色、動物、親屬，序列最後為 dog、aunt、China、red、titanium、bird，應回答 red、aunt、bird；類別輸入順序不限。結束說明後先進行練習。"];
      var instructions = window.instructions_block;
      if (instructions && Array.isArray(instructions.pages)) {
        instructions.pages = instructions.pages.map(function (english, index) {
          return makeBilingualCenterbox(chinesePages[index], english);
        });
      }

      var specs = [["end_practice_block","text","練習區段已完成。請確認每個指定類別最後出現的項目。"],["start_test_block","text","接下來進入正式試次。持續追蹤每個指定類別最後出現的項目，按 Enter 開始。"],["end_block","text","本次作業已完成。按 Enter 查看當次紀錄。"]];
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
