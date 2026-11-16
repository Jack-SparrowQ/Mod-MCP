# 0002 — Integrate through Moodle Web Services, not browser automation

Date: 2026-11-16 · Status: accepted

**Context:** Phase 0 (`docs/moodle-investigation.md`) verified that Moodle ITESCAM 4.1.1+ issues
`moodle_mobile_app` tokens to student accounts via `login/token.php`, and that the token can call
all functions the MVP needs (courses, contents, assignments, submissions, grades, calendar, forums).

**Decision:**
- The only `MoodleAdapter` implementation for the MVP is a REST client
  (`webservice/rest/server.php`, `moodlewsrestformat=json`, POST bodies).
- The adapter calls functions from an explicit allow-list in code; teacher/admin/write functions
  are not reachable from read tools. Write functions (Phase 5) are added individually behind the
  confirmation flow.
- Playwright is not added as a dependency. It stays the documented fallback if a needed capability
  is missing from the service.

**Consequences:** no HTML scraping, structured JSON responses, far fewer moving parts. The server
depends on ITESCAM keeping the mobile service enabled; if it is disabled, the server must return
`INTEGRATION_UNSUPPORTED`. How the token is obtained and stored (password in `.env` vs. storing
only the token) is decided in Phase 1.
