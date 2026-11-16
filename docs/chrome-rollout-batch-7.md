# In-game chrome rollout: batch 7

These are local candidate versions. The games remain independent and do not share UI code.

| Game | Candidate | Interrupted activity |
| --- | --- | --- |
| time-perception | 1.1.0 | Cancel the active timer or hold and re-present the current unanswered item with a fresh clock. If an answer was already recorded, keep it and advance after continuing. An introduction stays on the introduction. |
| tower-of-london | 2.1.0 | Keep the board, held ball and moves. Freeze the deadline, notices, feedback and elapsed/planning clocks until continuing. |
| complex-search | 1.1.0 | Discard the interrupted unanswered item and re-present the same item with a fresh clock; completed items remain recorded. |
| conjunction-search | 1.1.0 | Discard the interrupted unanswered item and re-present the same item with a fresh clock; completed items remain recorded. |
| popout-search | 1.1.0 | Discard the interrupted unanswered item and re-present the same item with a fresh clock; completed items remain recorded. |
| exploratory-saccade | 1.1.0 | Discard the current screen's finds and elapsed time, then re-present the same screen with a fresh clock. Completed screens and their feedback are retained. Input is mouse, touchpad or touch; there is no camera or eye-tracking input. |

For all six, the interrupt panel says “結束後不會保存這次紀錄。” / “Ending the activity will not save this session.” On fullscreen loss it also states that fullscreen ended. This follows the existing exit paths: they stop or abort the runtime, while `SendGameResult` runs only on normal completion. Completed portions kept in memory while paused are therefore discarded on End activity. The existing browser harness checks that stopping makes no save attempt; the new interrupt-panel scenarios are configured for each game and require the separate build and Brave run.

The search games already detect field-size changes and can require restarting a block when a changed viewport cannot safely reuse its layout. Exploratory saccade likewise reports a layout error when the field changes during a screen. Fullscreen-loss and resize interactions should be exercised in the browser before acceptance.
