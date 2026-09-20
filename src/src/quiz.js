import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ragSearch, ragCloseWorkspace } from '@qvac/sdk';
import { loadEmbedder, loadTutor, ask, shutdown, WORKSPACE } from './qvac.js';

/** RagSearchResult field names vary by version; read whichever is present. */
function passageOf(hit) {
  return hit.document ?? hit.text ?? hit.content ?? hit.chunk ?? '';
}

function sourceOf(passage) {
  const match = passage.match(/^\[source: (.+?)\]/);
  return match ? match[1] : 'your notes';
}

function stripTag(passage) {
  return passage.replace(/^\[source: .+?\]\s*/, '');
}

const QUESTION_SYSTEM =
  'You are a strict exam writer. You write one short, open-ended question that ' +
  'can be answered only from the passage you are given. Never write multiple ' +
  'choice. Never include the answer. Output the question and nothing else.';

const GRADE_SYSTEM =
  'You are a fair grader. Compare a student answer against a reference passage. ' +
  'Reply in exactly two lines:\n' +
  'VERDICT: correct | partial | wrong\n' +
  'FEEDBACK: one sentence, under 25 words.';

async function makeQuestion(tutorId, passage) {
  const question = await ask({
    modelId: tutorId,
    system: QUESTION_SYSTEM,
    user: `Passage:\n"""${stripTag(passage)}"""\n\nWrite one question.`,
  });
  return question.split('\n').find((l) => l.trim())?.trim() ?? question;
}

async function grade(tutorId, question, answer, passage) {
  const raw = await ask({
    modelId: tutorId,
    system: GRADE_SYSTEM,
    user:
      `Question: ${question}\n` +
      `Reference passage: """${stripTag(passage)}"""\n` +
      `Student answer: """${answer}"""`,
  });

  const verdict = raw.match(/VERDICT:\s*(correct|partial|wrong)/i)?.[1].toLowerCase() ?? 'partial';
  const feedback =
    raw.match(/FEEDBACK:\s*(.+)/i)?.[1].trim() ?? raw.split('\n').pop().trim();
  return { verdict, feedback };
}

const MARKS = { correct: '✔ correct', partial: '~ partial', wrong: '✘ wrong' };
const POINTS = { correct: 1, partial: 0.5, wrong: 0 };

export async function runQuiz(topic, count) {
  let embedderId, tutorId;
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    embedderId = await loadEmbedder();

    console.log(`▸ Searching your notes for "${topic}"…`);
    const hits = await ragSearch({
      modelId: embedderId,
      query: topic,
      topK: count,
      workspace: WORKSPACE,
    });

    const passages = hits.map(passageOf).filter((p) => p.length > 60);
    if (passages.length === 0) {
      console.log('✖ Nothing relevant found. Run `ingest` first, or try another topic.');
      return;
    }

    tutorId = await loadTutor();

    console.log(`\n── Quiz: ${topic} — ${passages.length} question(s) ──\n`);
    let score = 0;

    for (const [i, passage] of passages.entries()) {
      const question = await makeQuestion(tutorId, passage);
      console.log(`Q${i + 1}. ${question}`);
      const answer = (await rl.question('   > ')).trim();

      if (!answer) {
        console.log(`   ✘ skipped  ·  from ${sourceOf(passage)}\n`);
        continue;
      }

      const { verdict, feedback } = await grade(tutorId, question, answer, passage);
      score += POINTS[verdict] ?? 0;
      console.log(`   ${MARKS[verdict]}  —  ${feedback}`);
      console.log(`   from ${sourceOf(passage)}\n`);
    }

    const pct = Math.round((score / passages.length) * 100);
    console.log(`── Score: ${score}/${passages.length} (${pct}%) ──`);
  } finally {
    rl.close();
    await ragCloseWorkspace({ workspace: WORKSPACE }).catch(() => {});
    await shutdown([tutorId, embedderId]);
  }
}
