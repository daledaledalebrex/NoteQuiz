#!/usr/bin/env node
import { ingestFolder } from './ingest.js';
import { runQuiz } from './quiz.js';

const USAGE = `
notequiz — offline study coach powered by QVAC

  notequiz ingest <folder>              Embed your .md/.txt notes on-device
  notequiz quiz "<topic>" [-n <count>]  Get quizzed on a topic from those notes

Examples:
  notequiz ingest ./notes
  notequiz quiz "light-dependent reactions" -n 5
`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === 'ingest') {
    const folder = rest[0];
    if (!folder) throw new Error('Usage: notequiz ingest <folder>');
    await ingestFolder(folder);
    return;
  }

  if (command === 'quiz') {
    const flagIndex = rest.findIndex((a) => a === '-n' || a === '--count');
    const count = flagIndex >= 0 ? Number(rest[flagIndex + 1]) : 3;
    const topic = rest.filter((_, i) => i !== flagIndex && i !== flagIndex + 1).join(' ').trim();

    if (!topic) throw new Error('Usage: notequiz quiz "<topic>" [-n <count>]');
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      throw new Error('-n must be an integer between 1 and 20.');
    }
    await runQuiz(topic, count);
    return;
  }

  console.log(USAGE);
  process.exitCode = command ? 1 : 0;
}

main().catch((error) => {
  console.error('✖', error.message);
  process.exit(1);
});
