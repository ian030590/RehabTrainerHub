# Built-in game score contract

Each built-in game owns `games/{gameId}/settings.json` and `score.json`. Vite bundles its runtime and dependencies into its own output directory. Hub reads JSON definitions; it does not import game engines or scoring rules.

Flow: `training-overlay-config` → validated settings message → game → score message → `training-overlay-score`. After accepting a score, Hub unmounts the game, exits fullscreen, and displays the shared results component. Every accepted score is sent through `/api/records` into D1 `training_records`, with `runtime_id = hub` and a browser-generated pseudonymous `subject_id`. Signed-in records also include `user_id`; unsigned records never appear in account progress and cannot be retrieved by `subject_id`. The score remains in the existing JSON payload.

## Definition

`score.json` uses schema `rehab-trainer.game-score/v1`, the game's `gameId`, `presentation`, `columns`, and `summary`. Each field declares `key`, bilingual `label`, and `sources` (numeric/boolean properties from the game's result record). `unit` is optional. A column can declare `total: "sum"` for per-round points or `total: "last"` for cumulative points.

`presentation` contains semantic rendering hints owned by the game: `primarySummaryKeys` selects and orders one to four key outcomes, `qualitySummaryKeys` selects up to four data-quality/context fields, `defaultRoundMetricKey` selects the initial chart/table metric, and `chartType` is either `line` or `bar`. Every referenced key must exist in `summary` or `columns` as appropriate, and primary and quality keys cannot overlap.

The Hub owns the result component, visual hierarchy, responsive layout, styles, interaction, statistics, and chart implementation. A score definition cannot provide CSS, class names, colors, spacing, arbitrary components, or executable renderers. This boundary lets every game express what its results mean without forking how results are rendered.

`columns` read `detailRows`, or jsPsych `results`; a game with only a session result supplies one row from `details`. `summary` reads `details`. Missing numeric values remain `null`, shown as `—`. Boolean results become 0/1. Non-scoring instruction rows without any declared numeric fields are excluded. Scoring formulas remain game-owned; the shared adapter only projects declared fields.

The game shell registers its imported definition. Existing `SaveTrainingRecord` / `SaveTrainingSessionRecord` calls send the projected score to the verified Hub parent while embedded. Standalone games retain their existing local/account storage behavior.

## Message

```json
{
  "type": "rehab-trainer:game-score",
  "sessionNonce": "nonce received with settings",
  "sequence": 1,
  "score": {
    "schema": "rehab-trainer.game-score/v1",
    "gameId": "moving-card",
    "rounds": [{ "score": 1, "responseMs": 320 }],
    "summary": { "total": null, "accuracy": null, "responseMs": null }
  }
}
```

Hub validates iframe origin/source, nonce, first completion sequence, game ID, and exact declared metric keys. It accepts one completion per iframe. Subsequent lifecycle or score messages cannot overwrite the results. D1 retries reuse the same record ID. The server validates numeric fields, sensitive keys, game identity, and payload bounds independently.

Limits: 12 columns, 12 summary fields, 4,000 scored rows, 450 KiB score JSON, finite values with absolute magnitude ≤ 10¹². Oversized scores are rejected, never silently truncated. Results show 50 rows per page; chart and table use the same page, while statistics use all rows.

This contract applies to the 40 built-in games. Third-party uploaded packages retain their separate origin, strict sandbox, private MessageChannel, and one-time run-session API.

D1 keeps all rounds in `payload_json`; `summary_json` omits rounds and includes `scoreRoundCount` so account record lists do not load large trial arrays. The completion response and current Hub result view retain full rounds.

Verification: `npm run test:embedded-training`, `npm run test:hub-functions`, `npm run test:game-architecture`, `npm run test:entrypoints`, `npm run build:hub`, and `npm run test:game-architecture:browser`.
