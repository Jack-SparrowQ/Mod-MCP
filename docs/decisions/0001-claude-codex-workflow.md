# 0001 — Claude orchestrates, Codex implements, via Herdr

Date: 2026-11-16 · Status: accepted

**Context:** two AI agents and one human developer working on the same repo.

**Decision:** Claude (Herdr agent `claude`) writes specs in `planning/active-task.md`, delegates to
Codex (Herdr agent `codex`) through `herdr agent prompt`, and reviews the real `git diff`. Codex
implements, tests and reports using the format in `AGENTS.md`. The human approves commits, pushes
and any access to the real Moodle site. One active task at a time on `develop`; parallel tasks use
separate worktrees.

**Consequences:** Codex cannot message Claude, so Claude polls (`agent wait` + `agent read`).
Every task leaves a written spec and report, which doubles as documentation for the developer.
