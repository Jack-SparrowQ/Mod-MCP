# Active task — Phase 4: resource downloads

Status: **delegated to Codex** — 2026-11-16

## Goal

`moodle_download_resource` per `docs/decisions/0004-resource-downloads.md` (read it first) and
requirements FR-08, NFR-01. Reuse existing patterns (adapter, schemas, `read-tool`, enrolled-course
check, `rest-client` logging/redaction).

## Changes

1. **Course contents file metadata** (`moodle_get_course_contents`): add `filepath` (Moodle `filepath`,
   default `/`) to each file so folder files can be told apart. Still no URLs.
2. **rest-client `download(fileUrl, destination, maxBytes)`** (or equivalent in infrastructure):
   - Accept only URLs whose origin equals `MOODLE_BASE_URL`'s origin and whose path starts with
     `<base path>webservice/pluginfile.php/`. Anything else → `PERMISSION_DENIED`
     (suggestion: "Only Moodle-hosted files can be downloaded"), **zero fetch calls**.
   - Append `token=<token>` as a query param (pluginfile requires it); `redirect: 'error'`; timeout
     (60 s); GET.
   - HTTP 404 → `RESOURCE_NOT_FOUND`; 403/401 → `PERMISSION_DENIED`; network/5xx → `MOODLE_UNAVAILABLE`.
     A JSON body (`content-type` application/json with `errorcode`) is a Moodle error, not a file:
     map like REST errors.
   - Reject when `content-length` > maxBytes before reading; while streaming, abort once bytes
     exceed maxBytes. Over limit → `VALIDATION_ERROR` with `context: {maxMb}`.
   - Stream to `<final>.part`, then rename; delete the `.part` on any failure.
   - Log one line: `function: 'pluginfile'`, duration, outcome, bytes. Never the URL, filename or token.
3. **Path safety** (pure helper in `src/shared/`, unit-tested):
   - filename → basename only; remove `/ \ : * ? " < > |` and control chars; trim trailing dots/spaces;
     prefix `_` for Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`, with or
     without extension); empty → `file`; max 150 chars keeping the extension.
   - Destination dir `<project root>/downloads/<courseId>/` (project root resolved like the `.env`
     loading in `src/index.ts`); create recursively. Final path must resolve inside that dir (assert).
   - Existing file → `name (1).ext`, `name (2).ext`, … never overwrite.
4. **Config**: `MAX_DOWNLOAD_MB` (int 1–500, default 50) in `src/shared/config.ts` and `.env.example`.
5. **Tool `moodle_download_resource`**
   - Input (strict): `courseId` int>0, `moduleId` int>0, `filename?` string 1–255, `filepath?` string.
   - Flow: enrolled check (not enrolled → `RESOURCE_NOT_FOUND`, zero contents calls) →
     `core_course_get_contents` → find module by id (missing → `RESOURCE_NOT_FOUND`) → its
     `type=file` contents → select: if `filename` given match filename (+ filepath if given);
     if not given and exactly one file, use it; several → `VALIDATION_ERROR` whose context has
     `fileCount` (suggestion: pass filename; see moodle_get_course_contents); none → `RESOURCE_NOT_FOUND`.
   - Output: `{ file: { path (absolute local), filename (as saved), originalFilename, size, mimeType,
     courseId, moduleId } }`. If Moodle metadata has `filesize` and the saved size differs → delete the
     file and return `OPERATION_FAILED`.
   - Annotations: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`,
     `openWorldHint: true`. Description says files are saved locally and never overwritten.
6. **README.md** (only these edits): add the tool to the tools table, add `MAX_DOWNLOAD_MB` to the
   `.env` table, mention `downloads/<courseId>/` and the size limit, and remove "no descarga
   recursos" from the limitations (keep "no entrega tareas"). Claude reviews the wording.

## Out of scope

Zip/folder bulk download, assignment intro attachments, submissions/uploads (Phase 5), real Moodle
calls (Claude runs the live check), `.env`, new dependencies (use `node:fs`, `node:stream`).

## Acceptance criteria

- `npm run typecheck`, `npm run build`, `npm test` pass (paste result lines).
- Tests (mocked fetch, temp directories only — never the real `downloads/`):
  - host/path validation: foreign host, same host other path, `http:`, look-alike host
    (`moodle.itescam.edu.mx.evil.com`), path traversal in URL → refused with zero fetch calls.
  - token appears only in the fetch URL, never in output, errors or logs.
  - sanitization cases incl. `../../x.pdf`, `C:\\Windows\\a.txt`, `CON.txt`, `nul`, control chars,
    long names; final path stays inside the course dir.
  - no overwrite (suffixes); `.part` removed on error and on size overflow (content-length and
    streamed); size mismatch with metadata → file deleted + `OPERATION_FAILED`.
  - JSON error body mapped; 404/403 mapped.
  - tool via in-memory MCP client: single-file module, multi-file without filename →
    `VALIDATION_ERROR`, with filename, not enrolled, module missing; tool list has 11 tools.
- Report `planning/reports/phase-4.md` (AGENTS.md format) with assumptions for the live check.
