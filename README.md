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
```

## Shared UI

Shared code lives in `packages/ui` and is imported as `@rehab-trainer/ui/*`.
Current shared modules include:

- `components/GlobalPortalLinks`
- `components/RehabFooter`
- `components/UserSelector`
- `downloadFile`
- `hooks/useActiveUser`
- `storage/userStore`

App-specific training records, settings schemas, routes, and game logic stay in
their owning app until both apps share the same behavior contract.

## Deployment

Cloudflare Pages should be configured as three projects bound to this monorepo:

```text
rehabtrainerhub -> apps/rehabtrainerhub/out
stroketrainer   -> apps/stroketrainer/dist
visiontrainer   -> apps/visiontrainer/dist
```

See [docs/repository-settings.md](./docs/repository-settings.md) for exact build
commands, environment variables, custom-domain guidance, and archive steps for
the old repositories.

## Clinical Scope

This project is for rehabilitation workflow practice and software prototyping.
It is not medical diagnosis, treatment, or rehabilitation advice.
