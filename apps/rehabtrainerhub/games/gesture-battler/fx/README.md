# Battle feedback

Vendored from pixelfx commit `a84159688af3ca37a4be05a0d422b94451b2e24e`.
The unmodified core, four effects and the arcane helper live in
`public/runtime/pixelfx/`; Vite bundles the imports into this game's classic script.
This keeps the third-party code and its original names intact. The MIT license
and upstream notices are in `public/runtime/pixelfx/LICENSE-pixelfx.md`.

| Event | Effect | Playback | Reason |
| --- | --- | --- | --- |
| Gesture 1 | arcane/mana-burst | 700 ms | A compact blue spell burst matches the water move. |
| Gesture 2 | melee/sword-slash | 700 ms | A clear crescent reads as a physical strike. |
| Gesture 3 | melee/sword-slash | 700 ms | A tilted green crescent distinguishes the leaf move. |
| Gesture 4 | impacts/hit-spark | 350 ms | A small flare matches the spark move without a screen flash. |
| Gesture 5 | arcane/mana-burst | 700 ms | The existing yellow accent distinguishes thunder. |
| Interrupted hold | impacts/hit-spark | 180 ms | A small, subdued mark at the player acknowledges the interruption. |
| Enemy HP reaches zero | spawn/poof | 600 ms | A soft smoke burst finishes before the existing results transition. |

Longer upstream timelines run faster to complete naturally inside these limits.
Effects have their own seed and never consume gameplay randomness. Palettes,
including secondary spark/star ramps, use the existing CSS theme. The overlay
stays below the camera and combat HUD and never receives pointer events.

The controller runs only during combat. Reduced motion, blur, hidden pages,
portrait orientation, resizing, leaving combat and disposal clear the pixels and
cancel its animation frame. Restoring focus does not replay an interrupted effect.

Tests run through `scripts/check-gesture-battler-migration.test.mjs`, already part
of `test:game-architecture` and `test:ci`. Run the real camera-fixture flow with
`node scripts/check-r2-game-browser.mjs --game gesture-battler --lobby`;
`--mobile` and `--directed` cover landscape phone and directed gestures. These
browser flows use local SQLite and prerecorded hand images, not physical hands.
