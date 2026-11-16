# Backlog

Roadmap from `docs/requirements.md` §14. Move items to "Done" with the date.

## Next

- [x] **Phase 0 — Discovery & feasibility** — done 2026-11-16
  - [x] 0a. Public probe: Moodle 4.1.x, WS + mobile service enabled, typeoflogin=1
  - [x] 0b. Authenticated probe: student token works, 393 functions, all 12 MVP functions available
  - [x] 0c. ADR 0002: Web Services REST only; Playwright not needed for MVP
- [x] **Phase 1 — MCP foundation** — done 2026-11-16, live `moodle_auth_status` OK (commit 5b488bd)
- [x] **Phase 2 — Profile, courses, course contents** — done 2026-11-16, live-verified on 32 courses
- [ ] LOW: pin `@types/node` to `^24` to match the Node 24 runtime (currently 26)

## Later

- [x] **Phase 3 — Assignments, deadlines, calendar, grades, announcements** — done 2026-11-16, live-verified
- [ ] **Phase 4 — Resource downloads** (in progress, ADR 0004)
- [ ] Phase 5 — Authorized submission (explicit confirmation, duplicate protection)
- [ ] Phase 6 — Optimization, docs, client integration tests

## Done

- [x] 2026-11-16 — README (installation, token, client setup, tools, errors): MVP Definition of Done complete
- [x] 2026-11-16 — Workflow setup: Herdr Claude↔Codex verified, AGENTS/CLAUDE rules, .gitignore, ADR 0001
