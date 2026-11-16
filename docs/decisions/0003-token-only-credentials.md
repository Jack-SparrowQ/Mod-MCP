# 0003 — Store only the Moodle token, never the password

Date: 2026-11-16 · Status: accepted

**Context:** ADR 0002 uses a `moodle_mobile_app` token. The server needs a credential at runtime.

**Decision:**
- The server reads only `MOODLE_TOKEN` (and `MOODLE_BASE_URL`) from the environment / `.env`.
  It never sees the username or password.
- The token is obtained once with `npm run token`, which asks for username and password
  interactively (password hidden), exchanges them at `login/token.php`, and writes `MOODLE_TOKEN`
  into `.env` without ever printing it. The password is not stored anywhere.
- No `moodle_login` tool: credentials must never pass through the AI model (FR-01).
  "Logout" = revoke the key in Moodle (Preferences → Security keys) and delete the line from `.env`.

**Why:** a leaked token can be revoked without changing the institutional password, and
terminal output is readable by the agents in Herdr, so the token is never printed.

**Consequences:** `moodle_login`/`moodle_logout` from requirements §6.2 are replaced by
`npm run token` plus `moodle_auth_status`, which reports `AUTH_REQUIRED` / `SESSION_EXPIRED` with
the recovery instruction.
