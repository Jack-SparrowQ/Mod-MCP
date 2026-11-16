# 0004 — Resource downloads to a local project folder

Date: 2026-11-16 · Status: accepted

**Context:** FR-08 needs authorized file downloads. Moodle serves course files from
`webservice/pluginfile.php`, which requires the token in the URL. Course contents already expose
file metadata (Phase 2), so a separate listing tool is not needed.

**Decision:**
- One tool, `moodle_download_resource`, downloads a file identified by enrolled `courseId` +
  `moduleId` (+ `filename`/`filepath` when the module has several files). The file URL is taken only
  from Moodle's own `core_course_get_contents` response; it is never a tool input.
- The token is sent only to `<MOODLE_BASE_URL>webservice/pluginfile.php/…` on the configured host;
  any other URL (external links, other hosts) is refused without a request.
- Files go to `<project>/downloads/<courseId>/` (gitignored), names sanitized, never overwritten
  (suffix ` (n)`), written as `.part` then renamed; limit 50 MB per file (`MAX_DOWNLOAD_MB`).
- Downloads count as read operations (requirements §11.1): no confirmation step.

**Consequences:** the AI receives the local path, never the download URL or token. Folder files are
downloaded one at a time (no zip). Changing the download folder is not supported yet.
