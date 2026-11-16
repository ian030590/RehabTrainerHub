# Chrome rollout batch 4

The six games below have been updated locally.

| Game | Version | Interrupted activity | Ending the activity |
| --- | --- | --- | --- |
| memory-match | 2.1.0 | The board, open cards, countdown, mismatch delay and response clock are frozen. | 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” |
| simon-says | 2.1.0 | During playback the current sequence restarts on Continue. During input the entered sequence is retained and the response clock is frozen. | 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” |
| hex-schulte | 1.1.0 | Found numbers remain; round time and the remaining centre-check interval or response window freeze. | 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” |
| whack-a-mole | 2.1.0 | The current target, its remaining display time, countdown and response clock freeze. Decorative effects are cleared. | 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” |
| ufov | 2.1.0 | An interrupted exposure or answer is discarded and the same trial is shown again. The existing display-synchronization pause uses the same panel and resumes its display check. | 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” |
| every-ball-response | 2.1.0 | An interrupted trial is discarded and starts again with a fresh fixation, stimulus and response window. Pixi's ticker and music stop; sensor responses are ignored during the pause. | 「結束後會返回設定，不會保存這次紀錄。」 / “Ending the activity will return to settings without saving this session.” |

The exit paths were checked in each component: they abort the runtime; every-ball-response returns to settings and the other games call `ExitGame`. Only the normal `finish` path sends the result. Fullscreen loss uses the same panel with an additional explanation. Automated logic and contract tests cover the local changes; browser and visual acceptance remain outstanding.
