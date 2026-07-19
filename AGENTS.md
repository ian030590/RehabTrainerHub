# Repository Guidelines

## Project Structure & Module Organization

This is an npm workspace / Turborepo monorepo. Application code lives in `apps/`:

- `apps/rehabtrainerhub`: Next.js hub site and Cloudflare Pages Functions.
- `apps/stroketrainer`, `apps/visiontrainer`, `apps/braintrainer`: Vite React trainer apps.

Shared UI, auth helpers, layout, settings, and storage utilities live in `packages/ui/src`. Static assets are under each app's `public/` directory, commonly `public/assets/`. Cloudflare D1 migrations live in `apps/rehabtrainerhub/migrations/`.

## Build, Test, and Development Commands

- `npm run dev`: run all app dev servers through Turbo.
- `npm run dev:hub`, `npm run dev:stroke`, `npm run dev:vision`, `npm run dev:brain`: run one app locally.
- `npm run build`: build all apps through `scripts/build-apps.mjs`.
- `npm run build:cloudflare`: build Cloudflare Pages outputs.
- `npm run build:hub|stroke|vision|brain`: build one app.
- `npm --prefix apps/<app> run preview`: preview a built Vite app or hub output.

Run `npm run test:entrypoints` for high-risk trainer changes before reporting done. High-risk includes edits to trainer app entrypoints, routing, shared layout/UI imported by trainer entrypoints, or code that could pull Pixi, jsPsych, Three.js, MediaPipe, TensorFlow, or Vosk into an app entry bundle and cause a blank screen.

There is no full test suite at present; use targeted builds as the minimum verification for changes.

## Coding Style & Naming Conventions

Use TypeScript, React functional components, and existing local patterns. Keep shared behavior in `packages/ui` rather than duplicating logic across trainer apps. Prefer CSS variables and existing theme tokens over hard-coded colors. Use 2-space indentation, PascalCase for components, camelCase for functions and variables, and descriptive file names matching the component or feature.

## Shared Logic First

If logic, UI, styling, auth behavior, settings behavior, routing helpers, or footer/navbar behavior can be shared, it must not be reimplemented separately in each trainer. Put reusable code in `packages/ui/src` or another shared helper, then pass only app-specific data such as labels, colors, URLs, or module lists. This is critical because StrokeTrainer, VisionTrainer, and BrainTrainer are intentionally parallel products: duplicated logic will drift, create inconsistent accessibility behavior, and require the same bug fix three times. Before editing an app-specific file, check whether the change belongs in `TrainerNavbar`, `TrainerAppLayout`, `AuthPanel`, shared settings utilities, shared CSS, or shared storage/auth helpers. App files should compose shared pieces; they should not fork them.

Shared CSS belongs in `packages/ui/src/components/TrainerApp.css` or another package-level stylesheet when it styles common shells such as cards, dialogs, trainer setup panels, result summaries, result tables, routed module selection, buttons, form controls, or layout primitives. App `index.css` files should keep only product-specific visuals, game/stimulus rendering, and app-only overrides. When moving a shared component to `packages/ui`, move the matching reusable CSS at the same time and delete local duplicate rules where practical.

Use consistent file and folder names for pages or components with the same role across trainers. For example, route pages should follow shared placement such as `pages/settings/SettingsPage.tsx` and `pages/links/LinksPage.tsx` when the role matches in StrokeTrainer, VisionTrainer, and BrainTrainer. Do not keep differently named local files for the same concept unless the behavior is genuinely different; if it is different, keep the name explicit about that app-specific role.

## Testing Guidelines

No formal test framework is configured. For UI, auth, routing, or shared package changes, run the affected app builds and at least one representative trainer build. For Cloudflare Function changes, also run `node --check` on edited function files where possible.

## Commit & Pull Request Guidelines

Recent commits use short Conventional Commit-style subjects, usually `feat:` or `chore:` (for example, `feat: change auth ui`, `chore: unify setting`). Keep commits focused and imperative. Pull requests should include a concise summary, affected apps/packages, verification commands, screenshots for visual changes, and notes for migrations or environment variables.

## Security & Configuration Tips

Do not put secrets in frontend code. Auth/session secrets and OAuth credentials must stay in deployment environment variables. Password and session logic belongs in Cloudflare Functions, not client-only code. Apply new D1 migrations before relying on related production features.
