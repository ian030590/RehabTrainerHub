# Code Style

## Identifier naming

- Variables, parameters, object members, and class methods use `camelCase`.
- Classes, React components, types, enums, and named utility functions use `PascalCase`.
- React hooks retain the required `use...` prefix.
- Required but intentionally unused callback parameters may use an `_` prefix.
- Framework entrypoints retain their required names, including Next.js `generate...` functions and Cloudflare Pages `onRequest...` handlers.
- External contracts retain their supplied spelling: URL paths, CSS class names, storage keys, event names, environment variables, JSON fields, database columns, and third-party files are not renamed.

`npm run test:naming` checks authored JavaScript and TypeScript. Build output, public third-party assets, and generated directories are excluded.

## Dead code

- All TypeScript applications enable `noUnusedLocals` and `noUnusedParameters`.
- Remove unused locals, parameters, imports, and unreachable helpers instead of suppressing the compiler diagnostic.
- Keep exports only when they are consumed by an application, a package export contract, or framework discovery.
