# TrainerHub game SDK

Uploaded HTML/ZIP games use this small ES module to connect a jsPsych 8
timeline to the isolated game runner. Developers do not copy this source or
jsPsych into a submitted package. The runner build verifies and publishes:

```text
/runtime/jspsych-8.2.3.js
/runtime/jspsych-8.2.3.css
/runtime/trainerhub-game-sdk-0.1.0.js
```

Reference the exact root-relative paths so the runtime always comes from the
current runner origin and can be cached by the per-game service worker:

```html
<link rel="stylesheet" href="/runtime/jspsych-8.2.3.css" />
<script src="/runtime/jspsych-8.2.3.js"></script>
<script type="module">
  import { RunTrainerHubJsPsychGame } from '/runtime/trainerhub-game-sdk-0.1.0.js';

  async function startGame() {
    await RunTrainerHubJsPsychGame({
      initJsPsych: jsPsychModule.initJsPsych,
      timeline(settings) {
        return BuildTimeline(settings);
      },
      summarize(jsPsych, settings) {
        return {
          status: 'completed',
          score: jsPsych.data.get().filter({ correct: true }).count(),
          trialCount: jsPsych.data.get().count(),
        };
      },
    });
  }

  // Do not top-level await: the iframe load event supplies the private port.
  void startGame();
</script>
```

Only aggregate numbers, booleans, and null values are accepted. Do not include
names, account identifiers, tokens, free text, or raw trial data. The runner
transfers a one-time private `MessagePort` to the SDK and validates the same
schema again before relaying a result to `trainerhub.cc`.

The platform validates the root `settings.json` file before opening the game.
`timeline(settings)` receives only those validated slider, list, and checkbox
values. See [`examples/minimal-game.html`](examples/minimal-game.html) and
[`examples/settings.json`](examples/settings.json) for a complete package. The
game package contract and security restrictions are
documented in [`docs/developer-game-packages.md`](../../docs/developer-game-packages.md).
