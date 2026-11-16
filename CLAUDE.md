# CLAUDE.md

Shared rules, commands and report format: see `AGENTS.md`. Requirements: `docs/requirements.md`.
Architecture: `docs/architecture.md`.

## Claude's workflow (orchestrator)

- Codex runs in Herdr as agent `codex` (pane `w3:p2` at setup; always resolve by name, check
  with `herdr agent list`). If it is missing, start it in an idle shell pane:
  `herdr agent start codex --kind codex --pane <pane-id>`.
- Delegate (three steps — `prompt --wait` can return before Codex starts its turn):
  1. `herdr agent prompt codex "<self-contained task>"`
  2. `herdr agent wait codex --until working --timeout 15000`
  3. `herdr agent wait codex --timeout <ms>` then
     `herdr agent read codex --source recent-unwrapped --lines 120`.
  If the report is truncated, ask Codex to write it to `planning/reports/<task>.md` and read that.
  Never assume delivery or completion; a timeout is not proof of non-delivery — read before resending.
- Codex cannot message Claude; Claude polls. If Codex is `blocked` (approval dialog), read the pane
  and ask the user before answering.
- Before delegating: write the spec in `planning/active-task.md` (goal, files, expected behavior,
  out of scope, acceptance criteria, required tests). Move finished/pending items in `planning/backlog.md`.
- After Codex reports: inspect the real `git diff`, rerun `npm test` / `npm run typecheck` if in
  doubt, classify findings CRITICAL / HIGH / MEDIUM / LOW, send fixes back. No approval with open
  CRITICAL findings.
- One task at a time on `develop`; parallel work only in separate worktrees/branches.
- Ask the user before commits to shared branches, merges, pushes, or destructive Git operations.
- Ask the user before any action against the real Moodle site that needs their credentials or
  performs a write (submission, upload).
- Record real architectural decisions as short files in `docs/decisions/NNNN-title.md`.
