# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript app. Main application code lives in `src/`.
Use `src/pages/` for route-level screens, `src/components/` for shared UI,
`src/utils/` for browser/storage/helpers, and `src/i18n/` for bilingual strings.
Training modules live under `src/pages/training/`; keep module-specific helpers
near the module unless they are reused. Static assets and local models live in
`public/`. Cloudflare Pages functions are in `functions/`. Build/deployment
helpers are in `scripts/` and config files in `config/`. `dist/` is generated
output.

## Build, Test, and Development Commands

- `npm run dev`: start the local Vite dev server.
- `npm run build`: type-check, build `dist/`, then prune assets for Pages deploy.
- `npm run build:full`: full local build without pruning.
- `npm run build:cloudflare`: Cloudflare Pages build mode.
- `npm run preview`: preview the built app locally.
- `npm run r2:upload-vosk`: upload Vosk model assets to R2.

There is no dedicated test script today; use `npm run build` as the minimum
verification before handing off changes.

## Coding Style & Naming Conventions

Use TypeScript with `strict` enabled. Keep React components in PascalCase
(`SpeechTraining.tsx`) and helpers/functions in camelCase. Prefer existing
component patterns, route names, i18n key prefixes, and storage helpers over new
abstractions. Keep UI text in `src/i18n/zh.ts` and `src/i18n/en.ts`; do not
hard-code user-facing strings. Shared trainer shell CSS belongs in
`packages/ui/src/components/TrainerApp.css`; `src/index.css` should keep
StrokeTrainer-specific game, sensor, and app-only overrides. CSS should reuse
existing variables such as `--bg-card`, `--accent`, and `--radius-m`.

## Testing Guidelines

No formal test framework is configured. For non-trivial logic, add the smallest
runnable check available, or verify through `npm run build` plus focused manual
browser testing. Exercise both Chinese and English UI paths when adding text.

## Commit & Pull Request Guidelines

Recent history uses short conventional-style prefixes: `feat:`, `fix:`,
`doc:`, and `style:`. Keep commits focused and describe user-visible impact.
Pull requests should include a short summary, verification steps, linked issue
or reason for the change, and screenshots for UI changes.

## Deployment & Configuration Tips

The app must remain deployable to GitHub Pages and Cloudflare Pages. Keep Vite
`base: './'` behavior intact. Put environment-specific model URLs and secrets in
deployment environment variables, not source files.
