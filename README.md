# RehabTrainerHub

RehabTrainerHub is a Turborepo + npm workspace that combines the home
rehabilitation portal, StrokeTrainer, and VisionTrainer in one monorepo.

## Structure

```text
.
|-- apps/
|   |-- rehabtrainerhub/   # Next.js static-export landing site
|   |-- stroketrainer/     # Stroke rehabilitation Vite app
|   `-- visiontrainer/     # Vision rehabilitation Vite app
|-- packages/
|   |-- ui/                # Shared UI/components/browser utilities
|   |-- config-eslint/     # Shared ESLint base config
|   `-- config-tailwind/   # Shared design tokens and Tailwind config
|-- package-lock.json
`-- turbo.json
```

## Commands

Use npm from Node.js 24 or newer:

```bash
npm install --workspaces=false
npm run build
```

Useful filtered commands:

```bash
npm run dev:hub
npm run dev:stroke
npm run dev:vision
npm run build:hub
npm run build:stroke
npm run build:vision
npm run build:cloudflare
npm run deploy:cloudflare
```

## Shared UI

Shared code lives in `packages/ui` and is imported as `@rehab-trainer/ui/*`.
Current shared modules include:

- `components/RehabFooter`
- `components/UserSelector`
- `downloadFile`
- `hooks/useActiveUser`
- `storage/userStore`

App-specific training records, settings schemas, routes, and game logic stay in
their owning app until both apps share the same behavior contract.

## Deployment

Cloudflare Pages is deployed from GitHub Actions. Configure these repository
secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The deploy workflow runs `npm run build:cloudflare`, discovers Pages apps from
`apps/*/wrangler.toml`, creates missing Cloudflare Pages projects, and deploys
each app's configured output directory. The Cloudflare build removes bundled
StrokeTrainer Vosk model archives that exceed Cloudflare Pages' per-file limit;
serve those models from the configured external model URLs instead. A
deployable app needs:

- `apps/<app>/package.json` with `scripts.build`.
- `apps/<app>/wrangler.toml` with `name` and `pages_build_output_dir`.

Current projects:

```text
rehabtrainerhub -> apps/rehabtrainerhub/out
stroketrainer   -> apps/stroketrainer/dist
visiontrainer   -> apps/visiontrainer/dist
```

For SEO, set these GitHub repository variables to the canonical production
URLs. The build uses them for cross-site links and canonical metadata:

- `REHABTRAINERHUB_URL`
- `STROKETRAINER_URL`
- `VISIONTRAINER_URL`

See [docs/repository-settings.md](./docs/repository-settings.md) for exact build
commands, environment variables, custom-domain guidance, and redirect notes for
the archived repositories.

## Clinical Scope

This project is for rehabilitation workflow practice and software prototyping.
It is not medical diagnosis, treatment, or rehabilitation advice.
