#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformRuntimeContract } from '../functions/_lib/runtime.js';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(appRoot, '../..');
const publicDirectory = resolve(appRoot, 'public');
const outputDirectory = resolve(appRoot, 'dist');
const runtimeDirectory = resolve(outputDirectory, 'runtime');

const jsPsychPackage = await ReadJson(resolve(workspaceRoot, 'node_modules/jspsych/package.json'));
const gameSdkPackage = await ReadJson(resolve(workspaceRoot, 'packages/game-sdk/package.json'));
if (jsPsychPackage.version !== platformRuntimeContract.jsPsychVersion) {
  throw new Error(
    `The game runner supports jsPsych ${platformRuntimeContract.jsPsychVersion}, but node_modules contains ${jsPsychPackage.version ?? 'an unknown version'}. Update the runtime contract deliberately before building.`,
  );
}
if (gameSdkPackage.version !== platformRuntimeContract.gameSdkVersion) {
  throw new Error(
    `The game runner supports Game SDK ${platformRuntimeContract.gameSdkVersion}, but the workspace package is ${gameSdkPackage.version ?? 'an unknown version'}. Update the versioned runtime URL deliberately before building.`,
  );
}

const runtimeAssets = [
  {
    label: 'jsPsych browser runtime',
    source: resolve(workspaceRoot, 'node_modules/jspsych/dist/index.browser.js'),
    destination: RuntimeDestination(platformRuntimeContract.jsPsychUrl),
    minimumBytes: 100 * 1024,
    maximumBytes: 512 * 1024,
    validate(source) {
      if (!source.includes('var initJsPsych = jsPsychModule.initJsPsych;')) {
        throw new Error('The jsPsych browser runtime does not expose the expected initJsPsych global.');
      }
    },
  },
  {
    label: 'TrainerHub Game SDK',
    source: resolve(workspaceRoot, 'packages/game-sdk/src/index.js'),
    destination: RuntimeDestination(platformRuntimeContract.gameSdkUrl),
    minimumBytes: 4 * 1024,
    maximumBytes: 128 * 1024,
    validate(source) {
      if (!source.includes('export async function RunTrainerHubJsPsychGame(')
        || !source.includes("const messageSchema = 'trainerhub.game-platform/v1';")) {
        throw new Error('The Game SDK does not expose the expected versioned lifecycle contract.');
      }
      if (/\bimport\s*(?:\(|[^;\n]*?\bfrom\s*)["']https?:/i.test(source)) {
        throw new Error('The Game SDK runtime must not load a module from a CDN.');
      }
    },
  },
  {
    label: 'jsPsych stylesheet',
    source: resolve(workspaceRoot, 'node_modules/jspsych/css/jspsych.css'),
    destination: RuntimeDestination(platformRuntimeContract.jsPsychCssUrl),
    minimumBytes: 100 * 1024,
    maximumBytes: 1024 * 1024,
    validate(source) {
      if (!source.includes('.jspsych-display-element') || !source.includes('.jspsych-btn')) {
        throw new Error('The jsPsych stylesheet does not contain the expected base selectors.');
      }
    },
  },
  {
    label: 'third-party notices',
    source: resolve(appRoot, 'THIRD_PARTY_NOTICES.txt'),
    destination: RuntimeDestination(platformRuntimeContract.noticesUrl),
    minimumBytes: 1000,
    maximumBytes: 32 * 1024,
    validate(source) {
      if (!source.includes('jsPsych 8.2.3')
        || !source.includes('Copyright (c) 2014-2022 Joshua R. de Leeuw')
        || !source.includes('MIT License')) {
        throw new Error('The third-party notice must retain the jsPsych MIT attribution.');
      }
    },
  },
  {
    label: '192px platform icon',
    source: resolve(workspaceRoot, 'apps/rehabtrainerhub/public/icons/pwa-192.png'),
    destination: RuntimeDestination(platformRuntimeContract.icon192Url),
    minimumBytes: 512,
    maximumBytes: 512 * 1024,
    validate(bytes) {
      ValidatePng(bytes, 192, '192px platform icon');
    },
  },
  {
    label: '512px platform icon',
    source: resolve(workspaceRoot, 'apps/rehabtrainerhub/public/icons/pwa-512.png'),
    destination: RuntimeDestination(platformRuntimeContract.icon512Url),
    minimumBytes: 512,
    maximumBytes: 1024 * 1024,
    validate(bytes) {
      ValidatePng(bytes, 512, '512px platform icon');
    },
  },
];

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await cp(publicDirectory, outputDirectory, { recursive: true });
await rm(runtimeDirectory, { force: true, recursive: true });

const builtAssets = [];
for (const asset of runtimeAssets) {
  const sourceStat = await stat(asset.source);
  if (!sourceStat.isFile()
    || sourceStat.size < asset.minimumBytes
    || sourceStat.size > asset.maximumBytes) {
    throw new Error(
      `${asset.label} must be a regular file between ${asset.minimumBytes} and ${asset.maximumBytes} bytes.`,
    );
  }
  const source = await readFile(asset.source);
  asset.validate(/\.(?:css|js|txt)$/.test(asset.destination) ? source.toString('utf8') : source);
  await mkdir(dirname(asset.destination), { recursive: true });
  await cp(asset.source, asset.destination);
  const copied = await readFile(asset.destination);
  const sourceHash = Sha256(source);
  const copiedHash = Sha256(copied);
  if (sourceHash !== copiedHash) {
    throw new Error(`${asset.label} changed while it was copied into the runner.`);
  }
  builtAssets.push({
    file: basename(asset.destination),
    bytes: copied.byteLength,
    sha256: copiedHash,
  });
}

console.log(`Built user game runner static shell at ${outputDirectory}`);
for (const asset of builtAssets) {
  console.log(`- runtime/${asset.file}: ${asset.bytes} bytes, sha256-${asset.sha256}`);
}

function RuntimeDestination(publicUrl) {
  if (!/^\/runtime\/[A-Za-z0-9._/-]+$/.test(publicUrl) || publicUrl.includes('..')) {
    throw new Error(`Invalid controlled runtime URL: ${publicUrl}`);
  }
  return resolve(outputDirectory, ...publicUrl.slice(1).split('/'));
}

async function ReadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function Sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function ValidatePng(bytes, expectedSize, label) {
  const pngSignature = '89504e470d0a1a0a';
  if (bytes.byteLength < 24
    || bytes.subarray(0, 8).toString('hex') !== pngSignature
    || bytes.readUInt32BE(16) !== expectedSize
    || bytes.readUInt32BE(20) !== expectedSize) {
    throw new Error(`${label} must be a ${expectedSize}x${expectedSize} PNG.`);
  }
}
