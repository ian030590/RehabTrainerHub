# Chrome rollout batch 9

## Asteroid Shield 2.1.0

The interrupt panel says「結束活動後不會保存這次紀錄。」(Ending the activity will not save this session). When fullscreen is lost, it also states that fullscreen ended. The existing exit path aborts the jsPsych lifecycle; only `finishGame` builds and sends the session result.

Pause keeps the current threats, shield position and accumulated elapsed time. The Pixi update and pointer input ignore activity while paused, so spawn timing, reaction time and the remaining duration continue from the same point. No camera is used by this game.

## Gesture Battler 2.1.0

The interrupt panel says「結束活動後不會保存這次紀錄。」(Ending the activity will not save this session). It identifies fullscreen loss or camera interruption when applicable. `exitGame` aborts the lifecycle and stops input, while `completeSession` alone sends the game result.

Pause preserves the current hold and attack, stops the Pixi ticker and clears transient feedback. The camera stays active for a manual pause, but its frames are ignored. The session and hold clocks exclude the paused interval. Attack recovery and the final completion delay advance on the ticker, so they also wait for Continue. A disconnected camera is restarted on Continue.

## Motor Cortex Rehab 2.2.0

The interrupt panel says「結束活動後不會保存這次紀錄。」(Ending the activity will not save this session), with the cause when fullscreen or camera input is lost. `exitGame` aborts the lifecycle; `completeSession` is the result-sending path.

Pause preserves the target and encounter state but discards an unfinished hold without scoring it. The active clock excludes the pause, the animation frame is cancelled, CSS animations and laser audio stop, and camera frames are ignored. The camera remains active for a manual pause; after a camera error Continue requests input again.

## Drawing Defense 2.1.0

The interrupt panel says「結束後不會保存這次紀錄；已送出的畫作樣本不受影響。」(Ending the activity will not save this session. Drawing samples already sent are not affected.) The fullscreen-loss sentence also identifies the cause. `finishGame` alone sends the result; `queueDrawingSampleUpload` independently sends an unmatched drawing sample, and the Hub posts it to `/api/drawing-samples` before the activity ends. A pending upload may finish after interruption.

Pause discards the unfinished drawing and cancels recognition and drawing-clear timers. It stops the Pixi ticker and ignores pointer input, preserving enemies, spawn progress and the elapsed clock until Continue. This game uses pointer input rather than a camera.
