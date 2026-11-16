# 0005 — Assignment submission: strict elicitation, files only from submissions/

Date: 2026-11-16 · Status: accepted (chosen by the user)

**Context:** Phase 5 is the only feature that writes to Moodle. Requirements §11.2/§11.4 demand
explicit user confirmation; NFR-02 demands no duplicate submissions. An AI could otherwise call a
"confirm" step itself, or upload arbitrary local files (exfiltration).

**Decision:**
- Confirmation uses **MCP elicitation only**: the server asks the client to show the user a
  confirmation form (course, assignment, files, late/replace warnings). The model cannot answer it.
  Clients without elicitation support get `CONFIRMATION_REQUIRED` and nothing is written.
- Files can only come from `<project>/submissions/` (gitignored); paths resolving elsewhere,
  symlinks and non-regular files are refused.
- File submissions only (no online text) in this phase. Already-submitted assignments are refused
  (no resubmission). One in-flight submission per assignment; writes are never retried.
- Success is reported only after `mod_assign_get_submission_status` shows `submitted`.
- Write functions are callable only through an explicit write path in the REST client.

**Consequences:** works in Claude Code (supports elicitation); may be unavailable in clients without
it (possibly Codex). A real end-to-end test can only happen when the user chooses to submit a real
assignment.
