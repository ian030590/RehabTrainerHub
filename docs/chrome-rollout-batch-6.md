# In-game chrome rollout: batch 6

All six `public/game.json` manifests specify `higher-cognition`. These versions are local candidates, not releases.

Each interrupt panel says「結束後不會保存這次紀錄。」/ “Ending the activity will not save this session.” When fullscreen is lost, the same outcome sentence also identifies that cause. In each component, `exit` calls `stopRuntime`, which aborts the jsPsych lifecycle; inspection confirms `SendGameResult` is only called by the completed-session `finish` path. Ending while feedback or a final board is visible also aborts before the result is sent.

| Game | Candidate | Interrupted activity |
| --- | --- | --- |
| card-sorting | 1.1.0 | Re-present an unanswered card and restart its response clock. An answered card and its recorded result remain; its feedback timer freezes and resumes with the remaining delay. |
| number-letter | 2.1.0 | Discard an unanswered active trial and re-present the same planned pair with a fresh clock. Completed responses remain; an interruption during feedback advances to the next item on resume. Part introductions remain open. |
| plus-minus | 2.1.0 | Clear an unfinished entry and re-present the same number with a fresh clock. Keep completed responses; pause the remaining practice feedback or initial delay. List introductions remain open. |
| sliding-puzzle | 2.1.0 | Preserve tiles and moves; freeze elapsed and per-move time, the optional time limit, and final-board hold. |
| sudoku | 2.1.0 | Preserve entries and moves; freeze elapsed and per-entry time, the optional time limit, and final-board hold. |
| tic-tac-toe | 2.1.0 | Preserve the board and turn; freeze elapsed and per-move time, the computer turn, and final-board hold. |

The board and card games own their pause clocks. The per-game tests exercise frozen time and pending timers; card-sorting and plus-minus additionally test the resume behavior for unanswered items, and number-letter tests its trial runner's fresh response clock. Build and Brave interaction, focus, and visual checks are delegated to Claude.
