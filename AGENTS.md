# AGENTS.md — shared engineering rules

## Roles

- **Claude** (Herdr agent `claude`): orchestrator. Writes specs in `planning/active-task.md`,
  reviews diffs, owns docs and Git integration.
- **Codex** (Herdr agent `codex`): implementer / QA. Implements the active task, writes tests,
  runs verification, reports back.
- **Human developer**: architectural oversight; approves commits, pushes and any real-Moodle access.

Either agent may push back on a decision; say why.

## Project

MCP server for Moodle ITESCAM (`docs/requirements.md`). Node.js 24 + TypeScript (ESM, strict),
npm. Planned stack: MCP TypeScript SDK, Zod, Playwright (fallback only), Vitest, Pino, dotenv.

## Commands

Keep this list in sync with `package.json`. In PowerShell use `npm.cmd` (execution policy blocks `npm.ps1`).

- `npm install` — install dependencies (commit `package-lock.json`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — compile to `dist/`
- `npm test` — Vitest (unit + in-memory MCP integration; real network is stubbed out)
- `npm run dev` — run the server with tsx
- `npm start` — run the built server (`dist/index.js`, loads the project-root `.env`)
- `npm run token` — interactive: exchange username/password for `MOODLE_TOKEN` in `.env` (user only)

## Rules

- Work only on the task in `planning/active-task.md`. Do not touch files listed as out of scope.
- Do not commit, push, or rewrite Git history; Claude integrates after review.
- Never hardcode or log credentials, tokens, cookies or session files. Secrets come from `.env`
  (gitignored); document variables in `.env.example` with placeholder values only.
- Do not log in to the real Moodle site or perform write operations (submit, upload, post) unless
  the active task explicitly authorizes it.
- Do not implement Moodle capabilities that are not verified in `docs/moodle-investigation.md`.
- MCP tools depend on the `MoodleAdapter` interface, never directly on HTTP or Playwright.
- Errors use the codes in requirements §12; dates are ISO 8601.
- No new dependency without a one-line justification in the report.
- New non-trivial logic ships with a test. Tests must not hit the real Moodle site (use fixtures).
- On Windows PowerShell, read files with `Get-Content -Encoding utf8` (default decoding garbles UTF-8).

## Report format (end of every task)

1. **Changed files** — one line each, what and why.
2. **Verification** — the exact command(s) run and the result line (tests run / failures / errors).
   No claim without output.
3. **Explanation** — what was implemented, execution flow, components involved, why this approach,
   alternatives rejected, remaining limitations. Short; for a student who must understand it.
4. **Open issues** — anything skipped, assumed or uncertain.
