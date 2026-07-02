import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelPath = path.join(
  rootDir,
  'public',
  'models',
  'vosk-model-small-zh-tw-0.3.tar.gz',
);
const vocabularyPath = path.join(
  rootDir,
  'public',
  'models',
  'vosk-model-small-zh-tw-0.3-vocabulary.txt',
);

const archive = await fs.readFile(modelPath);
const tar = gunzipSync(archive);
const graph = findTarEntry(tar, '/Gr.fst');
const inputSymbols = readFstSymbolTable(graph, 0);
const outputSymbols = readFstSymbolTable(graph, inputSymbols.nextOffset);

if (inputSymbols.entries.length !== outputSymbols.entries.length) {
  throw new Error(
    `Vosk symbol table size mismatch (${inputSymbols.entries.length}/${outputSymbols.entries.length}).`,
  );
}

let repairedCount = 0;
for (let index = 0; index < inputSymbols.entries.length; index += 1) {
  const input = inputSymbols.entries[index];
  const output = outputSymbols.entries[index];
  if (input.key !== output.key) {
    throw new Error(`Vosk symbol ID mismatch at index ${index} (${input.key}/${output.key}).`);
  }
  if (input.bytes.length !== output.bytes.length) {
    throw new Error(
      `Vosk symbol byte length mismatch for ID ${input.key}: "${input.symbol}" / "${output.symbol}".`,
    );
  }
  if (!input.bytes.equals(output.bytes)) {
    input.bytes.copy(graph, output.offset);
    repairedCount += 1;
  }
}

const vocabulary = new Set(
  (await fs.readFile(vocabularyPath, 'utf8'))
    .replace(/\r/g, '')
    .split('\n')
    .map((word) => word.trim())
    .filter(Boolean),
);
const unsupportedWords = inputSymbols.entries
  .map((entry) => entry.symbol)
  .filter((symbol) => !isSpecialSymbol(symbol) && !vocabulary.has(symbol));
if (unsupportedWords.length > 0) {
  throw new Error(
    `The Vosk vocabulary index is missing ${unsupportedWords.length} symbols, including "${unsupportedWords[0]}".`,
  );
}

if (repairedCount > 0) {
  const repairedArchive = gzipSync(tar, { level: 9 });
  await fs.writeFile(modelPath, repairedArchive);
  console.log(`Repaired ${repairedCount} Chinese Vosk output symbols.`);
  console.log(`Model archive size: ${repairedArchive.length} bytes.`);
} else {
  console.log('Chinese Vosk input and output symbols already match.');
  console.log(`Model archive size: ${archive.length} bytes.`);
}

function findTarEntry(tarBuffer, suffix) {
  let offset = 0;
  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    const name = readNullTerminated(header.subarray(0, 100));
    if (!name) break;
    const prefix = readNullTerminated(header.subarray(345, 500));
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = readNullTerminated(header.subarray(124, 136)).trim();
    const size = Number.parseInt(sizeText || '0', 8);
    const contentOffset = offset + 512;
    if (fullName.endsWith(suffix)) {
      return tarBuffer.subarray(contentOffset, contentOffset + size);
    }
    offset = contentOffset + Math.ceil(size / 512) * 512;
  }
  throw new Error(`Unable to find ${suffix} in the Vosk archive.`);
}

function readFstSymbolTable(buffer, offset) {
  const cursor = { offset };
  if (offset === 0) {
    readInt32(buffer, cursor);
    readString(buffer, cursor);
    readString(buffer, cursor);
    readInt32(buffer, cursor);
    const flags = readInt32(buffer, cursor);
    if ((flags & 3) !== 3) {
      throw new Error('The Vosk grammar FST does not contain both symbol tables.');
    }
    cursor.offset += 8 * 4;
  }

  const magic = readInt32(buffer, cursor);
  if (magic !== 0x7eb2fb74) {
    throw new Error(`Unexpected OpenFst symbol table magic at byte ${offset}.`);
  }
  readString(buffer, cursor);
  cursor.offset += 8;
  const count = Number(readInt64(buffer, cursor));
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const length = readInt32(buffer, cursor);
    const symbolOffset = cursor.offset;
    const bytes = buffer.subarray(symbolOffset, symbolOffset + length);
    cursor.offset += length;
    entries.push({
      symbol: bytes.toString('utf8'),
      bytes: Buffer.from(bytes),
      offset: symbolOffset,
      key: Number(readInt64(buffer, cursor)),
    });
  }
  return { entries, nextOffset: cursor.offset };
}

function readInt32(buffer, cursor) {
  const value = buffer.readInt32LE(cursor.offset);
  cursor.offset += 4;
  return value;
}

function readInt64(buffer, cursor) {
  const value = buffer.readBigInt64LE(cursor.offset);
  cursor.offset += 8;
  return value;
}

function readString(buffer, cursor) {
  const length = readInt32(buffer, cursor);
  const value = buffer.subarray(cursor.offset, cursor.offset + length).toString('utf8');
  cursor.offset += length;
  return value;
}

function readNullTerminated(buffer) {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end < 0 ? buffer.length : end).toString('utf8');
}

function isSpecialSymbol(symbol) {
  return symbol.startsWith('<')
    || symbol.startsWith('[')
    || symbol.startsWith('#')
    || symbol.startsWith('!');
}
