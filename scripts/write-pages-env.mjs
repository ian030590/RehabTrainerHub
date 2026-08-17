#!/usr/bin/env node
import { DiscoverPagesApps } from './pages-apps.mjs';

const pagesApps = DiscoverPagesApps();
const hub = pagesApps.find((app) => app.role === 'hub');
if (!hub) throw new Error('Exactly one Pages app must declare rehabTrainer.role as hub.');
const gamehosts = pagesApps.filter((app) => app.role === 'gamehost');
if (gamehosts.length > 1) {
  throw new Error('At most one Pages app may declare rehabTrainer.role as gamehost.');
}

const values = new Map();
for (const app of pagesApps) {
  values.set(app.urlEnvName, app.siteUrl);
  values.set(`NEXT_PUBLIC_${app.urlEnvName}`, app.siteUrl);
  values.set(`VITE_${app.urlEnvName}`, app.siteUrl);
}

values.set('AUTH_API_BASE', hub.siteUrl);
values.set('AUTH_BASE_URL', hub.siteUrl);
values.set('NEXT_PUBLIC_AUTH_API_BASE', hub.siteUrl);
values.set('NEXT_PUBLIC_SITE_URL', hub.siteUrl);
values.set('VITE_AUTH_API_BASE', hub.siteUrl);
if (gamehosts[0]) values.set('GAME_RUNNER_ORIGIN', gamehosts[0].siteUrl);

for (const [name, value] of [...values].sort(([left], [right]) => left.localeCompare(right))) {
  process.stdout.write(`${name}=${value}\n`);
}
