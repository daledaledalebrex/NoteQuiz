# NoteQuiz

An offline study coach. Point it at your own notes and it quizzes you on them —
generating the questions, grading your answers, and citing which note each
question came from. Every model runs on your machine via the
[QVAC SDK](https://github.com/tetherto/qvac). No API key, no account, no
network calls after the one-time model download.

## How it works

1. `ingest` splits your `.md` / `.txt` notes into paragraph-sized chunks and
   embeds them into a local QVAC RAG workspace with `GTE_LARGE_FP16`.
2. `quiz` retrieves the chunks most relevant to your topic, then uses
   `LLAMA_3_2_1B_INST_Q4_0` to write one open-ended question per chunk.
3. You type an answer. The same model grades it against the source passage and
   returns a verdict plus one line of feedback.

## QVAC functions used

`loadModel` · `ragIngest` · `ragSearch` · `completion` · `unloadModel` ·
`ragCloseWorkspace`

## Requirements

- Node.js 20 or newer
- ~2 GB of disk space for the two models (downloaded once, on first run)

## Install

```bash
git clone [github.com](https://github.com/)<your-username>/notequiz.git
cd notequiz
npm install
```

## Run

Ingest the bundled sample notes — or swap in a folder of your own:

```bash
npm run ingest -- ./notes
```

Then start a quiz:

```bash
npm run quiz -- "light-dependent reactions" -n 3
```

Or install it globally and use the `notequiz` command:

```bash
npm link
notequiz ingest ~/Documents/lecture-notes
notequiz quiz "spaced repetition" -n 5
```

The first run downloads both models and prints a progress bar. Every run after
that works with the network switched off.

## Example session

```
▸ Loading embedding model…
▸ Searching your notes for "light-dependent reactions"…
▸ Loading tutor model…

── Quiz: light-dependent reactions — 3 question(s) ──

Q1. What is released as a by-product when photosystem II splits water?
   > oxygen
   ✔ correct  —  Correct; water splitting at PSII releases O2.
   from sample-photosynthesis.md
```

## Configuration

`qvac.config.json` controls SDK logging. Set `loggerConsoleOutput` to `true`
and `loggerLevel` to `"info"` to see what the runtime is doing.

## SDK version

Built and tested against `@qvac/sdk` **0.19.0**.

## License

MIT — see [LICENSE](./LICENSE).
