# Backlog

Roadmap from `docs/requirements.md` §14. Move items to "Done" with the date.

## Next

- [ ] **Phase 0 — Discovery & feasibility**
  - [x] 0a. Public probe — done 2026-11-16: Moodle 4.1.x, WS + mobile service enabled, typeoflogin=1
  - [ ] 0b. Authenticated probe (needs the user's account, run with explicit approval):
        token via `login/token.php?service=moodle_mobile_app`, `core_webservice_get_site_info`,
        list of granted functions vs. requirements §4.1
  - [ ] 0c. Decision record: integration strategy (API vs. Playwright)

## Later

- [ ] Phase 1 — MCP foundation (SDK, tool registry, errors, logging, config, `moodle_auth_status`)
- [ ] Phase 2 — Authentication, profile, courses, course contents
- [ ] Phase 3 — Assignments, submission status, grades, announcements, calendar
- [ ] Phase 4 — Resources and downloads
- [ ] Phase 5 — Authorized submission (explicit confirmation, duplicate protection)
- [ ] Phase 6 — Optimization, docs, client integration tests

## Done

- [x] 2026-11-16 — Workflow setup: Herdr Claude↔Codex verified, AGENTS/CLAUDE rules, .gitignore, ADR 0001
