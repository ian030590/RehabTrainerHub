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
  MOUTHTRAINER_URL: 'https://mouth.trainerhub.cc',
};
const optionalTrainerVariableNames = [
  'VITE_VOSK_MODEL_ZH_URL',
  'VITE_VOSK_MODEL_EN_URL',
  'VITE_VOSK_MODEL_ZH_VOCAB_URL',
  'VITE_VOSK_MODEL_EN_VOCAB_URL',
  'VITE_VOSK_MODEL_MIN_BYTES',
];

function ToPosixPath(path) {
  return path.replaceAll('\\', '/');
}

function ReadTomlString(toml, key) {
  const match = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']\\s*$`, 'm'));
  return match?.[1];
}

function DiscoverPagesProjects() {
  return readdirSync(appsRoot)
    .map((entry) => join(appsRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((appDir) => {
      const wranglerPath = join(appDir, 'wrangler.toml');
      if (!existsSync(wranglerPath)) return null;

      const toml = readFileSync(wranglerPath, 'utf8');
      const projectName = ReadTomlString(toml, 'name');
      if (!projectName) {
        throw new Error(`${ToPosixPath(relative(repoRoot, wranglerPath))} must define name.`);
      }

      return {
        appPath: ToPosixPath(relative(repoRoot, appDir)),
        projectName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.appPath.localeCompare(b.appPath));
}

function NormalizeUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function GetPublicAppUrls() {
  return Object.fromEntries(
    Object.entries(defaultPublicAppUrls).map(([name, fallback]) => [
      name,
      NormalizeUrl(process.env[name]?.trim() || fallback),
    ]),
  );
}

function GetAuthBaseUrl(publicAppUrls) {
  return NormalizeUrl(
    process.env.AUTH_API_BASE?.trim() ||
    process.env.AUTH_BASE_URL?.trim() ||
    publicAppUrls.REHABTRAINERHUB_URL,
  );
}

function CollectAllowedOrigins(authBaseUrl, publicAppUrls) {
  const origins = new Set([
    authBaseUrl,
    ...Object.values(publicAppUrls),
    ...(process.env.AUTH_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ]);

  return [...origins].join(',');
}

function GetOptionalTrainerVariables() {
  return Object.fromEntries(
    optionalTrainerVariableNames
      .map((name) => [name, process.env[name]?.trim()])
      .filter(([, value]) => Boolean(value)),
  );
}

function RequireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value && !dryRun) {
    throw new Error(`${name} must be provided as a GitHub Actions secret or environment variable.`);
  }
  return value || `<${name}>`;
}

function GetProjectSecrets(project, authBaseUrl, allowedOrigins, publicAppUrls) {
  const hubUrl = publicAppUrls.REHABTRAINERHUB_URL;
  const strokeUrl = publicAppUrls.STROKETRAINER_URL;
  const visionUrl = publicAppUrls.VISIONTRAINER_URL;
  const brainUrl = publicAppUrls.BRAINTRAINER_URL;
  const mouthUrl = publicAppUrls.MOUTHTRAINER_URL;
  const sharedClientConfig = {
    AUTH_API_BASE: authBaseUrl,
    REHABTRAINERHUB_URL: hubUrl,
    STROKETRAINER_URL: strokeUrl,
    VISIONTRAINER_URL: visionUrl,
    BRAINTRAINER_URL: brainUrl,
    MOUTHTRAINER_URL: mouthUrl,
    NEXT_PUBLIC_AUTH_API_BASE: authBaseUrl,
    NEXT_PUBLIC_REHABTRAINERHUB_URL: hubUrl,
    NEXT_PUBLIC_STROKETRAINER_URL: strokeUrl,
    NEXT_PUBLIC_VISIONTRAINER_URL: visionUrl,
    NEXT_PUBLIC_BRAINTRAINER_URL: brainUrl,
    NEXT_PUBLIC_MOUTHTRAINER_URL: mouthUrl,
    VITE_AUTH_API_BASE: authBaseUrl,
    VITE_REHABTRAINERHUB_URL: hubUrl,
    VITE_STROKETRAINER_URL: strokeUrl,
    VITE_VISIONTRAINER_URL: visionUrl,
    VITE_BRAINTRAINER_URL: brainUrl,
    VITE_MOUTHTRAINER_URL: mouthUrl,
    ...GetOptionalTrainerVariables(),
  };

  if (project.projectName !== 'rehabtrainerhub') {
    return sharedClientConfig;
  }

  return {
    ...sharedClientConfig,
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
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`Wrangler failed with exit code ${result.status}: npx ${commandArgs.join(' ')}`);
  }
}

async function Main() {
  const projects = DiscoverPagesProjects();
  if (projects.length === 0) {
    throw new Error('No Cloudflare Pages apps found under apps/*/wrangler.toml.');
  }

  const publicAppUrls = GetPublicAppUrls();
  const authBaseUrl = GetAuthBaseUrl(publicAppUrls);
  const allowedOrigins = CollectAllowedOrigins(authBaseUrl, publicAppUrls);
  const tempDir = dryRun ? '' : await mkdtemp(join(tmpdir(), 'rehab-auth-env-'));

  try {
    console.log(`Syncing auth environment to ${projects.length} Cloudflare Pages project(s).`);
    console.log(`Auth API base: ${authBaseUrl}`);

    for (const project of projects) {
      const secrets = GetProjectSecrets(project, authBaseUrl, allowedOrigins, publicAppUrls);
      const secretNames = Object.keys(secrets).sort().join(', ');
      console.log(`- ${project.projectName}: ${secretNames}`);

      const secretFile = dryRun
        ? `${project.projectName}.auth-secrets.json`
        : join(tempDir, `${project.projectName}.auth-secrets.json`);

      if (!dryRun) {
        await writeFile(secretFile, JSON.stringify(secrets, null, 2), 'utf8');
      }

      RunWrangler([
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

await Main();
