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

function GetOptionalEnv(name) {
  return process.env[name]?.trim() || '';
}

function GetTurnstileConfiguration() {
  const siteKey = GetOptionalEnv('TURNSTILE_SITE_KEY');
  const secretKey = GetOptionalEnv('TURNSTILE_SECRET_KEY');
  const rawRequired = GetOptionalEnv('TURNSTILE_REQUIRED');
  const rawRecordsRequired = GetOptionalEnv('TURNSTILE_RECORDS_REQUIRED');
  if (rawRequired && !['0', '1'].includes(rawRequired)) {
    throw new Error('TURNSTILE_REQUIRED must be 0 or 1.');
  }
  if (rawRecordsRequired && !['0', '1'].includes(rawRecordsRequired)) {
    throw new Error('TURNSTILE_RECORDS_REQUIRED must be 0 or 1.');
  }
  if (Boolean(siteKey) !== Boolean(secretKey)) {
    throw new Error('TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together.');
  }

  const required = rawRequired || '0';
  const recordsRequired = rawRecordsRequired || '0';
  if ((required === '1' || recordsRequired === '1') && (!siteKey || !secretKey)) {
    throw new Error('Turnstile cannot be required without both the site key and secret key.');
  }
  return {
    recordsRequired,
    required,
    secretKey,
    siteKey,
  };
}

function GetPublicVariables(pagesApps, authBaseUrl) {
  const turnstile = GetTurnstileConfiguration();
  const variables = {
    AUTH_API_BASE: authBaseUrl,
    NEXT_PUBLIC_AUTH_API_BASE: authBaseUrl,
    VITE_AUTH_API_BASE: authBaseUrl,
  };
  const sharedPublicVariables = {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: turnstile.siteKey,
    NEXT_PUBLIC_TURNSTILE_AUTH_REQUIRED: turnstile.required,
    VITE_TURNSTILE_SITE_KEY: turnstile.siteKey,
    VITE_TURNSTILE_AUTH_REQUIRED: turnstile.required,
    VITE_TURNSTILE_RECORDS_REQUIRED: turnstile.recordsRequired,
    NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN: GetOptionalEnv('CF_WEB_ANALYTICS_TOKEN'),
    VITE_CF_WEB_ANALYTICS_TOKEN: GetOptionalEnv('CF_WEB_ANALYTICS_TOKEN'),
    VITE_AI_ASSET_BASE_URL: GetOptionalEnv('AI_ASSET_BASE_URL'),
  };
  Object.assign(variables, sharedPublicVariables);

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
  const turnstile = GetTurnstileConfiguration();
  const secrets = project.role === 'hub'
    ? {
        ...publicVariables,
        AUTH_BASE_URL: authBaseUrl,
        AUTH_ALLOWED_ORIGINS: allowedOrigins,
        AUTH_SESSION_SECRET: RequireEnv('AUTH_SESSION_SECRET'),
        AUTH_STATE_SECRET: RequireEnv('AUTH_STATE_SECRET'),
        GOOGLE_CLIENT_ID: RequireEnv('GOOGLE_CLIENT_ID'),
        GOOGLE_CLIENT_SECRET: RequireEnv('GOOGLE_CLIENT_SECRET'),
      }
    : { ...publicVariables };

  if (project.role === 'hub') {
    const assetPublicBaseUrl = GetOptionalEnv('ASSET_PUBLIC_BASE_URL')
      || GetOptionalEnv('AI_ASSET_BASE_URL');
    secrets.TURNSTILE_SECRET_KEY = turnstile.secretKey;
    secrets.TURNSTILE_REQUIRED = turnstile.required;
    secrets.TURNSTILE_RECORDS_REQUIRED = turnstile.recordsRequired;
    secrets.ASSET_PUBLIC_BASE_URL = assetPublicBaseUrl;
  }

  return secrets;
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
