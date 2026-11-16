# Active task — Phase 0a: public Moodle probe

Status: **drafted, not yet delegated** (waiting for the user's go-ahead)

## Goal

Find out, without logging in, what integration mechanisms Moodle ITESCAM exposes, and write the
findings to `docs/moodle-investigation.md`.

## Steps (read-only HTTP GETs, a handful of requests, no brute force)

1. `GET https://moodle.itescam.edu.mx/moodle4/login/index.php` — note Moodle version hints
   (generator meta, theme, `M.cfg`, JS/CSS revision paths), login form fields, SSO/CAPTCHA presence.
2. `GET /moodle4/lib/upgrade.txt` or similar public version files, only if publicly served.
3. `GET /moodle4/webservice/rest/server.php` (no token) — record the HTTP status and error body
   (distinguishes "web services disabled" from "invalid token").
4. `GET /moodle4/login/token.php` without credentials — record the response (whether the mobile
   token endpoint exists, e.g. for service `moodle_mobile_app`).
5. `GET /moodle4/admin/tool/mobile/launch.php` and `/moodle4/lib/ajax/service-nologin.php` existence
   only (status code), plus the public `tool_mobile_get_public_config` via the nologin AJAX endpoint
   if available — reports whether the mobile service is enabled.

## Files

- Create: `docs/moodle-investigation.md` (findings: request, status, relevant excerpt, conclusion).
- Optional: `scripts/probe-public.mjs` if a script is cleaner than manual requests (Node fetch only,
  no new dependency).

## Out of scope

- Any login, credential use, or authenticated request (that is Phase 0b, needs the user).
- Initializing the TypeScript project or installing dependencies.
- Editing `docs/requirements.md`, `AGENTS.md`, `CLAUDE.md`.

## Acceptance criteria

- Each finding cites the actual request and response evidence; unknowns are marked "unverified".
- A conclusion section: is Strategy A (Web Services / mobile token) plausible, what 0b must verify.
- No secrets or personal data in the document.

## Required tests

None (investigation). If a probe script is written, it must run with `node scripts/probe-public.mjs`
and its output must be pasted in the report.
