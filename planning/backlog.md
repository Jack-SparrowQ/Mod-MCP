# Backlog

Roadmap from `docs/requirements.md` §14. Move items to "Done" with the date.

## Next

- [x] **Phase 0 — Discovery & feasibility** — done 2026-11-16
  - [x] 0a. Public probe: Moodle 4.1.x, WS + mobile service enabled, typeoflogin=1
  - [x] 0b. Authenticated probe: student token works, 393 functions, all 12 MVP functions available
  - [x] 0c. ADR 0002: Web Services REST only; Playwright not needed for MVP
- [x] **Phase 1 — MCP foundation** — done 2026-11-16, live `moodle_auth_status` OK (commit 5b488bd)
- [x] **Phase 2 — Profile, courses, course contents** — done 2026-11-16, live-verified on 32 courses
- [x] LOW: `@types/node` pinned to 24.x (Phase 6a)

## Later

- [x] **Phase 3 — Assignments, deadlines, calendar, grades, announcements** — done 2026-11-16, live-verified
- [x] **Phase 4 — Resource downloads** — done 2026-11-16, live-verified (commit c53ad41)
- [x] **Phase 5 — Assignment submission** — done 2026-11-16, reviewed + live dry run (writes blocked); real submission untested by design
- [x] LOW: draftSaved error after a partial submission (Phase 6a)
- [ ] **Phase 6 — Release hardening**: 6a code done; Codex MCP client verified (auth_status + elicitation probe); final review pending

## Done

- [x] 2026-11-16 — README (installation, token, client setup, tools, errors): MVP Definition of Done complete
- [x] 2026-11-16 — Workflow setup: Herdr Claude↔Codex verified, AGENTS/CLAUDE rules, .gitignore, ADR 0001
