import { readdir, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { ragIngest } from '@qvac/sdk';
import { loadEmbedder, shutdown, WORKSPACE } from './qvac.js';

const ALLOWED = new Set(['.md', '.txt', '.markdown']);
const MIN_CHARS = 120;
const MAX_CHARS = 1200;

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(full)));
    else if (ALLOWED.has(extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

/** Split text into readable chunks, merging short paragraphs and splitting long ones. */
export function chunkText(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (para.length > MAX_CHARS) {
      if (buffer) { chunks.push(buffer); buffer = ''; }
      for (let i = 0; i < para.length; i += MAX_CHARS) {
        chunks.push(para.slice(i, i + MAX_CHARS));
      }
      continue;
    }
    buffer = buffer ? `${buffer} ${para}` : para;
    if (buffer.length >= MIN_CHARS) { chunks.push(buffer); buffer = ''; }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export async function ingestFolder(dir) {
  const files = await collectFiles(dir);
  if (files.length === 0) {
    throw new Error(`No .md or .txt files found under "${dir}".`);
  }

  const documents = [];
  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    for (const chunk of chunkText(raw)) {
      // The source tag rides along in the text, so retrieval keeps provenance.
      documents.push(`[source: ${basename(file)}]\n${chunk}`);
    }
  }

  console.log(`▸ ${files.length} file(s) → ${documents.length} chunk(s)`);

  let embedderId;
  try {
    embedderId = await loadEmbedder();
    console.log('▸ Embedding and storing locally…');

    const result = await ragIngest({
      modelId: embedderId,
      workspace: WORKSPACE,
      documents,
      chunk: false,
      onProgress: (stage, current, total) => {
        process.stdout.write(`\r  ${stage}: ${current}/${total}   `);
      },
    });

    process.stdout.write('\n');
    console.log(`✔ Ingested ${result.processed.length} chunk(s) into "${WORKSPACE}".`);
    if (result.droppedIndices?.length) {
      console.log(`  (${result.droppedIndices.length} chunk(s) skipped)`);
    }
  } finally {
    await shutdown([embedderId]);
  }
}
