# In-game chrome rollout: batch 5

All six games are candidates at version `2.1.0`. Their `public/game.json` files classify them as `higher-cognition`.

Each interrupt panel says「結束後不會保存這次紀錄。」/ “Ending the activity will not save this session.” After fullscreen is lost it says「已退出全螢幕，結束後不會保存這次紀錄。」/ “Fullscreen ended; ending the activity will not save this session.” For each game, inspection of `stopRuntime`, `exit`, and `finish` confirms that ending aborts the runtime, while only `finish` sends the result through `SendGameResult`. This includes the interval after an outcome appears and before its result is sent.

| Game | Interrupted activity |
| --- | --- |
| connect4 | Preserve the board and turn. Freeze elapsed and per-move time, a pending computer move, and the final-board hold; continue their remaining time on resume. |
| dots-and-boxes | Preserve the board, scores, and turn. Freeze elapsed and per-move time, pending computer moves, and the final-board hold; continue their remaining time on resume. |
| hex | Preserve the board and turn. Freeze elapsed and per-move time, a pending computer move, and the final-board hold; continue their remaining time on resume. |
| lights-out | Preserve the puzzle and moves. Freeze elapsed and per-move time, the optional time limit, and the final-board hold; continue their remaining time on resume. |
| maze | Preserve the maze, position, and moves. Freeze elapsed and per-move time, the optional time limit, and the final-board hold; continue their remaining time on resume. |
| minesweeper | Preserve the field, revealed cells, flags, and moves. Freeze elapsed and per-action time and the final-board hold; continue their remaining time on resume. |

Each game owns its pause clock. Its game test checks that the clock and pending timer do not advance while paused and that the timer resumes with its remaining delay. Music stops during the pause. Browser interaction and presentation still require the delegated Brave verification.
