#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DiscoverPagesApps, defaultRepoRoot } from './pages-apps.mjs';

const wranglerPrefix = ['--yes', 'wrangler@4'];
const dryRun = process.argv.includes('--dry-run');

function NormalizeUrl(value) {
  return new URL(value.trim()).origin;
}

function RequireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value && !dryRun) {
    throw new Error(`${name} must be provided as a GitHub Actions secret or environment variable.`);
  }
  return value || `<${name}>`;
}

function GetPublicVariables(pagesApps, authBaseUrl) {
  const variables = {
    AUTH_API_BASE: authBaseUrl,
    NEXT_PUBLIC_AUTH_API_BASE: authBaseUrl,
    VITE_AUTH_API_BASE: authBaseUrl,
  };

  for (const app of pagesApps) {
    variables[app.urlEnvName] = app.siteUrl;
    variables[`NEXT_PUBLIC_${app.urlEnvName}`] = app.siteUrl;
    variables[`VITE_${app.urlEnvName}`] = app.siteUrl;
  }

  for (const [name, rawValue] of Object.entries(process.env)) {
    const value = rawValue?.trim();
    if (value && (name.startsWith('VITE_') || name.startsWith('NEXT_PUBLIC_'))) {
      variables[name] ??= value;
    }
  }

  return variables;
}

function GetProjectSecrets(project, publicVariables, authBaseUrl, allowedOrigins) {
  if (project.role !== 'hub') return publicVariables;

  return {
    ...publicVariables,
    AUTH_BASE_URL: authBaseUrl,
    AUTH_ALLOWED_ORIGINS: allowedOrigins,
    AUTH_SESSION_SECRET: RequireEnv('AUTH_SESSION_SECRET'),
    AUTH_STATE_SECRET: RequireEnv('AUTH_STATE_SECRET'),
    GOOGLE_CLIENT_ID: RequireEnv('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: RequireEnv('GOOGLE_CLIENT_SECRET'),
  };
}

function GetCommand(file, args) {
  if (process.platform !== 'win32') return { file, args };
  return {
    file: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', file, ...args],
  };
}

function ShellQuote(value) {
  return /[\s"'`$]/.test(value) ? JSON.stringify(value) : value;
}

function RunWrangler(args) {
  const commandArgs = [...wranglerPrefix, ...args];
  console.log(`$ npx ${commandArgs.map(ShellQuote).join(' ')}`);
  if (dryRun) return;

  const command = GetCommand('npx', commandArgs);
  const result = spawnSync(command.file, command.args, {
    cwd: defaultRepoRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`Wrangler failed with exit code ${result.status}: npx ${commandArgs.join(' ')}`);
  }
}

async function Main() {
  const pagesApps = DiscoverPagesApps();
  const hubs = pagesApps.filter((app) => app.role === 'hub');
  if (hubs.length !== 1) throw new Error('Exactly one Pages app must declare rehabTrainer.role as hub.');

  const authBaseUrl = NormalizeUrl(process.env.AUTH_API_BASE?.trim() || hubs[0].siteUrl);
  const allowedOrigins = [...new Set([
    authBaseUrl,
    ...pagesApps.map((app) => app.siteUrl),
    ...(process.env.AUTH_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ])].join(',');
  const publicVariables = GetPublicVariables(pagesApps, authBaseUrl);
  const tempDir = dryRun ? '' : await mkdtemp(join(tmpdir(), 'rehab-pages-env-'));

  try {
    console.log(`Syncing environment to ${pagesApps.length} discovered Cloudflare Pages project(s).`);
    console.log(`Auth API base: ${authBaseUrl}`);

    for (const project of pagesApps) {
      const secrets = GetProjectSecrets(project, publicVariables, authBaseUrl, allowedOrigins);
      console.log(`- ${project.projectName}: ${Object.keys(secrets).sort().join(', ')}`);
      const secretFile = dryRun
        ? `${project.projectName}.pages-env.json`
        : join(tempDir, `${project.projectName}.pages-env.json`);
      if (!dryRun) await writeFile(secretFile, JSON.stringify(secrets, null, 2), 'utf8');

      RunWrangler([
        'pages',
        'secret',
        'bulk',
        secretFile,
        `--project-name=${project.projectName}`,
      ]);
    }
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

await Main();
