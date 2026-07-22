![MotorTrainer logo](./public/assets/logo.svg)

# MotorTrainer

MotorTrainer is a React rehabilitation training web app for upper- and lower-limb motor practice. It
combines game-like upper-limb training modules with local settings, user
selection, calibration, and training record helpers. Cognitive games now live
under BrainTrainer Thinking Training, while speech and oral exercises live under
MouthTrainer.

> **Disclaimer:** This application is for programming practice and experimental
> purposes. It is not medical diagnosis, treatment, or rehabilitation advice. If
> you have medical needs, seek professional medical assistance.

## Tech Stack

- **React 19** + **TypeScript**: UI and typed app code
- **React Router v7**: client-side routing
- **PixiJS v8**: 2D rendering for drawing and game screens
- **jsPsych 8** + **WebGazer.js**: calibration and training data flow
- **MediaPipe Tasks Vision** + **TensorFlow.js**: gesture and vision helpers
- **Three.js**: 3D/visual training support
- **Vite**: development and production builds

## Training Modules

### Motor Training

- **Drawing Tower Defense**: draw circles, crosses, squares, triangles, and
  straight lines with mouse or touch.
- **Gesture Battler**: camera-based hand gesture practice.

## Project Structure

```text
src/
|-- main.tsx                         # App entry point
|-- App.tsx                          # Routes
|-- index.css                        # Global styles
|-- theme.ts                         # Design tokens
|-- components/                      # Shared UI components
|-- i18n/                            # Language resources
|-- pages/
|   |-- HomePage.tsx                 # Home / module menu
|   |-- home/                        # Home page cards and module metadata
|   |-- training/                    # Training pages and games
|   |   |-- MotorTraining.tsx
|   |   |-- DrawingTowerDefenseGame.tsx
|   |   |-- GestureBattlerGame.tsx
|   |   |-- AsteroidShieldGame.tsx
|   |   `-- MotorCortexRehabGame.tsx
|   |-- settings/                    # Settings and calibration
|   |-- credits/                     # Credits page
|   `-- links/                       # Related links page
`-- utils/                           # Storage, records, settings, downloads
```

## Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

Useful build commands:

```bash
npm run build:full        # Keep bundled assets
npm run build:cloudflare  # Force Cloudflare Pages pruning
npm run r2:upload-vosk    # Upload Vosk assets to Cloudflare R2
```

## Discord Image Upload

Drawing Tower Defense outputs missed recognition samples as 256x256 transparent
PNG files and sends them to `/api/drawing-samples` as `multipart/form-data`.
Upload progress and counts are intentionally not shown in the game UI. The
frontend does not store the Discord webhook; the webhook must be provided by
backend environment variables.

Set in Cloudflare Pages environment variables:

```text
DISCORD_DRAWING_WEBHOOK_URL=your Discord webhook URL
```

If the frontend and API are on different domains, also set:

```text
VITE_DRAWING_SAMPLE_UPLOAD_URL=https://your-api.example.com/api/drawing-samples
DRAWING_UPLOAD_ALLOWED_ORIGINS=https://your-frontend.example.com
```

GitHub Pages only supports static files and cannot execute
`functions/api/drawing-samples.js`. If deploying to GitHub Pages, point
`VITE_DRAWING_SAMPLE_UPLOAD_URL` to another service capable of executing this
API.

## Cloudflare Pages and Vosk Models

Cloudflare Pages has a 25 MiB limit per uploaded asset. The default build
detects Cloudflare Pages through `CF_PAGES=1` and removes the bundled Chinese
Vosk archive from `dist`; Voice Defender will use Web Speech fallback unless an
external model URL is configured.

To keep offline Chinese recognition on Cloudflare Pages and GitHub Pages,
upload the local Vosk files to a public Cloudflare R2 bucket and set the model
URLs at build time. The helper script uploads:

- `public/models/vosk-model-small-zh-tw-0.3.tar.gz`
- `public/models/vosk-model-small-zh-tw-0.3-vocabulary.txt`
- `public/models/vosk-model-small-en-us-0.15-vocabulary.txt`
- `public/models/vosk-model-small-en-us-0.15.tar.gz`, if you add it locally

First authenticate Wrangler with `npx wrangler login`, or set
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Then expose the bucket
through a custom R2 domain, or enable the `r2.dev` public development URL for
testing.

PowerShell example:

```text
$env:R2_BUCKET='motor-trainer-vosk-models'
$env:R2_PREFIX='models'
$env:R2_PUBLIC_BASE_URL='https://vosk-models.example.com'
npm run r2:upload-vosk
```

The script also applies `config/r2-cors.json`. Update that file if your
Cloudflare Pages or GitHub Pages origin is different.

Set the printed frontend variables in Cloudflare Pages environment variables
and GitHub repository variables:

```text
VITE_VOSK_MODEL_ZH_URL=https://vosk-models.example.com/models/vosk-model-small-zh-tw-0.3.tar.gz
VITE_VOSK_MODEL_ZH_VOCAB_URL=https://vosk-models.example.com/models/vosk-model-small-zh-tw-0.3-vocabulary.txt
VITE_VOSK_MODEL_EN_VOCAB_URL=https://vosk-models.example.com/models/vosk-model-small-en-us-0.15-vocabulary.txt
```

## Voice Defender Models

Voice Defender first checks the browser Cache API for the selected Vosk model.
If it is missing, the app downloads and caches the archive. The default Chinese
and English models and download timeout can be configured with:

```text
VITE_VOSK_MODEL_ZH_URL=https://your-cdn.example.com/vosk-model-small-zh-tw.tar.gz
VITE_VOSK_MODEL_EN_URL=https://your-cdn.example.com/vosk-model-small-en-us.tar.gz
VITE_VOSK_MODEL_ZH_VOCAB_URL=https://your-cdn.example.com/vosk-model-small-zh-tw-vocabulary.txt
VITE_VOSK_MODEL_EN_VOCAB_URL=https://your-cdn.example.com/vosk-model-small-en-us-vocabulary.txt
VITE_VOSK_MODEL_TIMEOUT_MS=90000
VITE_VOSK_MODEL_RETRY_MS=10000
VITE_VOSK_MODEL_MIN_BYTES=1048576
```

When `VITE_VOSK_MODEL_ZH_URL` is set during `npm run build`,
`scripts/prune-cloudflare-pages-assets.mjs` removes the bundled Chinese model
from `dist` so GitHub Pages and Cloudflare Pages both use the external R2 copy.
The monorepo Cloudflare Pages deploy workflow reads these values from GitHub
repository or environment variables with the same names.

The model host must allow cross-origin requests. Downloads begin only after
Voice Defender is opened. If a download fails, the page keeps retrying in the
background until a complete model is cached or the browser tab closes. Cached
archives must include completion metadata, match their recorded byte length,
meet the configured minimum size, and have a gzip signature; incomplete or
legacy cache entries are deleted and downloaded again. The default Chinese and
English archives are also checked against their exact published byte sizes.

The bundled Chinese model uses matching Traditional Chinese input and output
symbol tables, so Vosk grammar entries and recognition results use the same
words shown on screen. The frontend does not perform Simplified/Traditional
conversion. Its compact vocabulary index is loaded only after Voice Defender is
opened. Custom words are added only when they exist in the model vocabulary;
unsupported words produce a visible warning.

If the model download or initialization fails, Voice Defender automatically
falls back to the browser Web Speech API and compares transcripts with visible
word cards using Levenshtein similarity. Vosk audio is processed locally; Web
Speech processing depends on the browser and may use its online speech service.
