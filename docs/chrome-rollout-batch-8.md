# Chrome rollout batch 8

## gabor-patching 2.1.0

- The interrupt panel says 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Fullscreen loss adds its cause to the same sentence. The existing abort test confirms that aborting the jsPsych trial produces no completed result; `SendGameResult` runs only in the normal completion callback.
- This is a continuous activity rather than a sequence of separate trials. Pausing freezes the existing patches, animation and elapsed time; continuing preserves their positions and remaining lifetimes. The pause tests cover scoring, input, elapsed time and renderer initialization during a pause.
- The game has its own `scripts/gabor-patching-browser.mjs` fixture rather than a `brain-r2-browser.mjs` entry. The fixture now checks the interrupt panel and fullscreen-loss pause; browser execution remains pending.

## moving-card 2.1.0

- The interrupt panel says 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Fullscreen loss adds its cause. The abort test confirms that a cancelled trial does not produce a result; the game sends results only after the full timeline completes.
- The interrupted search is discarded. Continue presents the same target again with a fresh clock and reset attempts; completed rounds remain in the timeline. The game owns a dedicated browser fixture, updated for pause and fullscreen loss, which still requires a browser run.

## reading-training 2.1.0

- The interrupt panel says 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Fullscreen loss adds its cause. The abort test confirms there is no completed result on exit; results are sent only when the timeline completes.
- The interrupted countdown or text batch is shown again for its full interval; the paused duration is excluded. An interrupted comprehension question remains visible and receives a fresh response clock. Its dedicated browser fixture is updated and awaits a browser run.

## hart-chart 2.1.0

- The interrupt panel says 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Fullscreen loss adds its cause. Exit aborts the external jsPsych lifecycle; only the completed decoder sends a result.
- Decoding and completed answers are retained, elapsed time is frozen, and unfinished IME composition is cleared. Continuing restores the same chart. The dedicated browser fixture is updated and awaits a browser run.

## driving-rehab 2.2.0

- The interrupt panel says 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Fullscreen loss or a disconnected wheel adds its cause. An aborted trial exits without sending a result; only the completed timeline sends one.
- The driving scene, active hazard and vehicle state are retained. Simulation, feedback and lane-reset timers pause; reaction clocks exclude the interruption. A disconnected calibrated wheel must be reconnected before Continue is enabled. The dedicated browser fixture is updated and awaits a browser run.

## hart-chart 2.2.0

The default decoder dock follows viewport orientation until a saved or player-selected dock exists. Tutorial panels use available space around their target and scroll when constrained, keeping the chart visible where space permits.
