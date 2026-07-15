#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const wranglerPrefix = ['--yes', 'wrangler@4'];
const dryRun = process.argv.includes('--dry-run');
const defaultPublicAppUrls = {
  REHABTRAINERHUB_URL: 'https://trainerhub.cc',
  STROKETRAINER_URL: 'https://stroke.trainerhub.cc',
  VISIONTRAINER_URL: 'https://vision.trainerhub.cc',
  BRAINTRAINER_URL: 'https://brain.trainerhub.cc',
};

function toPosixPath(path) {
  return path.replaceAll('\\', '/');
}

function readTomlString(toml, key) {
  const match = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']\\s*$`, 'm'));
  return match?.[1];
}

function discoverPagesProjects() {
  return readdirSync(appsRoot)
    .map((entry) => join(appsRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((appDir) => {
      const wranglerPath = join(appDir, 'wrangler.toml');
      if (!existsSync(wranglerPath)) return null;

      const toml = readFileSync(wranglerPath, 'utf8');
      const projectName = readTomlString(toml, 'name');
      if (!projectName) {
        throw new Error(`${toPosixPath(relative(repoRoot, wranglerPath))} must define name.`);
      }

      return {
        appPath: toPosixPath(relative(repoRoot, appDir)),
        projectName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.appPath.localeCompare(b.appPath));
}

function getAuthBaseUrl() {
  return defaultPublicAppUrls.REHABTRAINERHUB_URL;
}

function collectAllowedOrigins(authBaseUrl) {
  const origins = new Set([
    authBaseUrl,
    ...Object.values(defaultPublicAppUrls),
  ]);

  return [...origins].join(',');
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value && !dryRun) {
    throw new Error(`${name} must be provided as a GitHub Actions secret or environment variable.`);
  }
  return value || `<${name}>`;
}

function getProjectSecrets(project, authBaseUrl, allowedOrigins) {
  const hubUrl = defaultPublicAppUrls.REHABTRAINERHUB_URL;
  const strokeUrl = defaultPublicAppUrls.STROKETRAINER_URL;
  const visionUrl = defaultPublicAppUrls.VISIONTRAINER_URL;
  const brainUrl = defaultPublicAppUrls.BRAINTRAINER_URL;
  const sharedClientConfig = {
    AUTH_API_BASE: authBaseUrl,
    NEXT_PUBLIC_AUTH_API_BASE: authBaseUrl,
    NEXT_PUBLIC_REHABTRAINERHUB_URL: hubUrl,
    NEXT_PUBLIC_STROKETRAINER_URL: strokeUrl,
    NEXT_PUBLIC_VISIONTRAINER_URL: visionUrl,
    NEXT_PUBLIC_BRAINTRAINER_URL: brainUrl,
    VITE_AUTH_API_BASE: authBaseUrl,
    VITE_REHABTRAINERHUB_URL: hubUrl,
    VITE_STROKETRAINER_URL: strokeUrl,
    VITE_VISIONTRAINER_URL: visionUrl,
    VITE_BRAINTRAINER_URL: brainUrl,
  };

  if (project.projectName !== 'rehabtrainerhub') {
    return sharedClientConfig;
  }

  return {
    ...sharedClientConfig,
    AUTH_BASE_URL: authBaseUrl,
    AUTH_ALLOWED_ORIGINS: allowedOrigins,
    AUTH_SESSION_SECRET: requireEnv('AUTH_SESSION_SECRET'),
    AUTH_STATE_SECRET: requireEnv('AUTH_STATE_SECRET'),
    GOOGLE_CLIENT_ID: requireEnv('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: requireEnv('GOOGLE_CLIENT_SECRET'),
  };
}

function getCommand(file, args) {
  if (process.platform !== 'win32') return { file, args };
  return {
    file: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', file, ...args],
  };
}

function shellQuote(value) {
  return /[\s"'`$]/.test(value) ? JSON.stringify(value) : value;
}

function runWrangler(args) {
  const commandArgs = [...wranglerPrefix, ...args];
  console.log(`$ npx ${commandArgs.map(shellQuote).join(' ')}`);
  if (dryRun) return;

  const command = getCommand('npx', commandArgs);
  const result = spawnSync(command.file, command.args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`Wrangler failed with exit code ${result.status}: npx ${commandArgs.join(' ')}`);
  }
}

async function main() {
  const projects = discoverPagesProjects();
  if (projects.length === 0) {
    throw new Error('No Cloudflare Pages apps found under apps/*/wrangler.toml.');
  }

  const authBaseUrl = getAuthBaseUrl();
  const allowedOrigins = collectAllowedOrigins(authBaseUrl);
  const tempDir = dryRun ? '' : await mkdtemp(join(tmpdir(), 'rehab-auth-env-'));

  try {
    console.log(`Syncing auth environment to ${projects.length} Cloudflare Pages project(s).`);
    console.log(`Auth API base: ${authBaseUrl}`);

    for (const project of projects) {
      const secrets = getProjectSecrets(project, authBaseUrl, allowedOrigins);
      const secretNames = Object.keys(secrets).sort().join(', ');
      console.log(`- ${project.projectName}: ${secretNames}`);

      const secretFile = dryRun
        ? `${project.projectName}.auth-secrets.json`
        : join(tempDir, `${project.projectName}.auth-secrets.json`);

      if (!dryRun) {
        await writeFile(secretFile, JSON.stringify(secrets, null, 2), 'utf8');
      }

      runWrangler([
        'pages',
        'secret',
        'bulk',
        secretFile,
        `--project-name=${project.projectName}`,
      ]);
    }
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

await main();
