import {
  loadModel,
  unloadModel,
  completion,
  close,
  LLAMA_3_2_1B_INST_Q4_0,
  GTE_LARGE_FP16,
} from '@qvac/sdk';

export const WORKSPACE = 'notequiz';

const mb = (n) => (n / 1e6).toFixed(0);

function progressFor(label) {
  let lastPrinted = -1;
  return (p) => {
    const pct = Math.floor(p.percentage ?? 0);
    if (pct === lastPrinted) return;
    lastPrinted = pct;
    const filled = Math.round(pct / 4);
    const bar = '█'.repeat(filled) + '░'.repeat(25 - filled);
    process.stdout.write(
      `\r  ${label} ${bar} ${pct}% (${mb(p.downloaded ?? 0)}/${mb(p.total ?? 0)} MB)`
    );
    if (pct >= 100) process.stdout.write('\n');
  };
}

/** Load the embedding model used for ingest and retrieval. */
export async function loadEmbedder() {
  console.log('▸ Loading embedding model (first run downloads it)…');
  const modelId = await loadModel({
    modelSrc: GTE_LARGE_FP16,
    onProgress: progressFor('embeddings'),
  });
  return modelId;
}

/** Load the small instruct model used to write and grade questions. */
export async function loadTutor() {
  console.log('▸ Loading tutor model (first run downloads it)…');
  const modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    onProgress: progressFor('tutor     '),
  });
  return modelId;
}

/**
 * Run a single-turn completion and return the full text.
 * Streaming is used because it is the documented shape; tokens are
 * accumulated so callers get a plain string back.
 */
export async function ask({ modelId, system, user }) {
  const history = [];
  if (system) history.push({ role: 'system', content: system });
  history.push({ role: 'user', content: user });

  const run = completion({ modelId, history, stream: true });
  let out = '';
  for await (const token of run.tokenStream) out += token;
  return out.trim();
}

export async function shutdown(modelIds = []) {
  for (const modelId of modelIds) {
    if (modelId) await unloadModel({ modelId }).catch(() => {});
  }
  await close().catch(() => {});
}
