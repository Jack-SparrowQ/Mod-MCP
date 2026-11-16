# Phase 4 — resource downloads

## 1. Changed files

- `.env.example` — document MAX_DOWNLOAD_MB=50 without creating an env file.
- `README.md` — only the authorized edits: tool row, size-setting row, download folder/limit text, and removal of the no-download limitation while retaining no submissions.
- `src/domain/moodle-adapter.ts` — file filepath metadata, download input/output models and adapter method.
- `src/shared/config.ts` — validate MAX_DOWNLOAD_MB as an integer 1–500, default 50; safe configuration diagnostic.
- `src/shared/download-path.ts` — pure filename sanitization, suffix generation and resolved directory containment.
- `src/index.ts` — inject the project-root downloads directory and configured byte limit independently of cwd.
- `src/infrastructure/moodle/response-schemas.ts` — validate file filepath with `/` as its missing-field default.
- `src/infrastructure/moodle/moodle-error.ts` — shared safe Moodle error mapping, extracted from REST for reuse by downloads.
- `src/infrastructure/moodle/file-download.ts` — URL authorization, tokenized GET, bounded streaming, exclusive name reservation, part-file promotion/cleanup and safe metrics.
- `src/infrastructure/moodle/rest-client.ts` — expose the infrastructure download operation and reuse extracted REST error mapping.
- `src/infrastructure/moodle/rest-adapter.ts` — resolve modules/files from contents, select exact filename/filepath, construct safe local paths and return metadata only.
- `src/application/download-resource.ts` — enrolled-course check before accessing contents or downloading.
- `src/mcp/tools/download-resource.ts` — strict identifiers/selector input, local-write annotations and existing result helper.
- `src/mcp/server.ts` — register the eleventh tool.
- `tests/fixtures/downloads.ts` — isolated temporary roots, synthetic contents, injected fetch and captured logs.
- `tests/unit/download-path.test.ts` — traversal/reserved/control/long-name sanitization and containment tests.
- `tests/unit/file-download.test.ts` — origin/path authorization, HTTP/JSON/stream failures, limits, metrics, timeout, no overwrite and cleanup coverage.
- `tests/integration/download-resource.test.ts` — SDK in-memory download flow, selections, membership gate, metadata, mismatch and strict-input cases.
- `tests/unit/config.test.ts` — default and range/type validation for the new setting.
- `tests/unit/rest-adapter.test.ts` — update exact metadata expectations to include filepath.
- `tests/integration/mcp.test.ts` — update fake adapter and registry expectations.
- `tests/integration/academic-tools.test.ts` — eleven-tool registry and distinct download annotations; retain prior read-tool expectations.
- `planning/reports/phase-4.md` — this report and live-check assumptions.

No dependencies, package scripts, docs, AGENTS.md, CLAUDE.md or existing scripts
were edited. The ADR was already untracked and backlog already modified on
entry. Claude updated planning/active-task.md during the turn after the initial
file still said no active task; I reread the complete new spec before editing.
Those planning inputs and the ADR were not edited by Codex. No commit was made.

## 2. Verification

No network, npm install or real Moodle request was made. Fetch is mocked in all
download tests; MCP uses paired in-memory SDK transports. Every download test
writes exclusively beneath a newly created OS temporary directory, with checked
recursive cleanup. Neither the real project downloads directory nor a repository
`.env` was created or used. The unchanged Phase 1 env-loader tests retain their
temporary fixture env files containing only non-secret test values.

Initial `npm.cmd run typecheck` exited 0:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit
```

The first full run passed types/build and exposed two test failures:

```text
Test Files  2 failed | 13 passed (15)
     Tests  2 failed | 254 passed (256)
```

One found a Windows-specific behavior: path.basename interpreted a filename
starting with `a:` as a drive and discarded text before sanitization. The helper
now splits normalized path separators directly and removes illegal characters
after selecting the last segment. The other was an overly broad assertion that
matched the allowed filename in the output path followed by the separate log's
function key; output and log privacy checks were corrected to test their actual
contracts. After fixes, all 256 tests passed. Two additional cases cover C1
control characters and ordinary JSON resources without a Moodle errorcode.

Final exact command:

```powershell
npm.cmd run typecheck; if ($LASTEXITCODE -eq 0) { npm.cmd run build }; if ($LASTEXITCODE -eq 0) { npm.cmd test }
```

Exit code **0**. Output:

```text
> moodle-itescam-mcp@0.1.0 typecheck
> tsc --noEmit

> moodle-itescam-mcp@0.1.0 build
> tsc

> moodle-itescam-mcp@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Carlo/Projects/mod-mcp

 Test Files  15 passed (15)
      Tests  258 passed (258)
   Start at  15:02:10
   Duration  1.30s (import 45%, tests 30%, transform 18%, setup 6%, worker 2%)
```

The new tests demonstrate:

- Foreign/look-alike origins, HTTP, another same-origin path, ordinary pluginfile.php, credential-bearing URLs and raw/encoded/double-encoded traversal are refused with zero fetch calls.
- A valid download GET sends the token only in its authorized fetch URL, replaces an existing token query value, rejects redirect following, and has an abort signal.
- Local output contains the saved path/metadata without URL/token; logs contain only standard Pino fields plus function=pluginfile, durationMs, outcome and bytes, never URL/filename/token.
- Dangerous filenames, Windows reserved names, C0/C1 control characters and long names are sanitized; resolved paths remain inside the selected course directory.
- An existing file remains unchanged; two simultaneous downloads receive distinct suffixes rather than overwriting it.
- Content-length overflow is rejected before reading/writing; streaming overflow aborts and removes part/reserved files. Stream failures, JSON Moodle errors and metadata size mismatch also leave no downloaded file behind.
- 404 maps to RESOURCE_NOT_FOUND; 401/403 to PERMISSION_DENIED; server/timeout/stream failures to MOODLE_UNAVAILABLE; JSON Moodle errors share the REST mappings without free-text diagnostics.
- A legitimate JSON resource containing an ordinary error field but no errorcode remains downloadable.
- Eleven tools and the specified readOnlyHint=false/destructiveHint=false/idempotentHint=false/openWorldHint=true annotations.
- Single-file selection; multiple files require filename; duplicate filenames can be resolved by filepath; missing module/file and non-file contents fail without binary requests.
- A non-enrolled course fails before contents; foreign URLs in server metadata fail before binary fetch. Input URL/fileUrl/userid fields are rejected before fetch.
- Metadata mismatch returns OPERATION_FAILED with no retained final/part file. Folder metadata exposes filepath but still omits URLs.
- MAX_DOWNLOAD_MB accepts 1–500 integers and rejects zero, oversized, fractional, empty and nonnumeric values.

Final review commands:

```powershell
git diff --check; Write-Output "DIFF_CHECK_EXIT=$LASTEXITCODE"
git diff -- README.md
git status --short
```

Whitespace-check output:

```text
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/active-task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'planning/backlog.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/domain/moodle-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/response-schemas.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-adapter.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/infrastructure/moodle/rest-client.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/mcp/server.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/config.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/academic-tools.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/integration/mcp.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/unit/config.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/unit/rest-adapter.test.ts', LF will be replaced by CRLF the next time Git touches it
DIFF_CHECK_EXIT=0
```

README diff inspection showed only the four authorized topics. Status showed the
listed source/tests, environment example and README changes plus the independent
planning/ADR changes. Git warned its global ignore file was unreadable. This
report was created after that status capture.

## 3. Explanation

The strict MCP input contains only courseId, moduleId and optional filename and
filepath. The use case first checks the own enrolled list. The adapter then
fetches course contents, finds the requested module, selects type=file records
and matches selectors exactly. A module with multiple files requires filename;
duplicates additionally require filepath. Folder filepath is a metadata selector,
never part of a local directory path. No download URL crosses the tool boundary.

Only after selection does infrastructure validate the file URL against the exact
configured origin and `<base path>webservice/pluginfile.php/` prefix. HTTPS is
required; URL credentials, fragments and traversal forms are refused. It adds
the configured token query parameter to that authorized URL, performs a GET
with redirect:error and a 60-second timeout, and never logs that URL. REST calls
continue using their existing POST bodies; the new query-token rule applies to
pluginfile downloads only.

The composition root injects `<project>/downloads` using the module location,
independent of process cwd. Files are stored directly under the numeric course
directory. The helper takes only the last filename segment, removes forbidden
characters, handles reserved Windows names, trims trailing dots/spaces and caps
the name while retaining a normal extension. Existing names receive (1), (2),
and so on. Resolved containment is asserted, and a noncanonical symlink/junction
directory is refused rather than followed outside the chosen destination.

An exclusive empty final-path reservation prevents concurrent downloads from
choosing the same name. Bytes are written incrementally to its exclusive .part
file; only a completed, size-checked part replaces that owned reservation via
rename. Failures close the handle and remove both owned paths. Oversized
content-length is refused before file creation, and the streamed byte count
independently enforces the configured limit. Bytes use 1024*1024 per configured MB.
Metadata filesize, when present, must exactly equal the saved byte count; mismatch
fails before promotion and removes the files.

JSON responses are collected alongside their bounded disk stream only when the
response advertises application/json, allowing Moodle errorcode bodies to use
the same safe mappings as REST. Ordinary JSON files without errorcode remain
resources. MIME output prefers the Moodle metadata value, falling back to the
response Content-Type. The result contains only the absolute local path, saved
and original filename, saved size, MIME type, courseId and moduleId.

The download tool correctly advertises local filesystem effects through its MCP
annotations. It is still a read operation against Moodle under ADR 0004, so no
confirmation flow or Moodle write function was added. Logs remain on the injected
stderr logger; no stdout diagnostics were introduced.

## 4. Open issues and live-check assumptions

The following remain **unverified live in this task**; Claude should verify:

1. Selected type=file contents have string fileurl values already using the
   configured origin and `<base>webservice/pluginfile.php/` path. Ordinary
   pluginfile.php URLs are intentionally refused rather than rewritten. External
   hosts/CDNs/redirects are not supported, even when supplied by Moodle metadata.
2. File metadata fields follow the existing schemas: filename string, filepath
   string when present (otherwise `/`), filesize finite nonnegative number when
   present, optional string mimetype. Selection compares the original metadata
   names and paths, preserving case and exact slash conventions.
3. Folder modules expose all selectable files in module.contents. Only type=file
   entries are candidates; external link and directory entries are not fetched.
4. A valid token query parameter authorizes the GET without needing cookies or
   another credential. The server must not require redirect following. Test a
   representative PDF and a folder file with an explicit filepath separately.
5. Metadata filesize matches the actual decoded response bytes. Transfer or server
   changes yielding a different count fail safely and leave no file. Unknown
   sizes can download, but both header and stream limit checks still apply.
6. Moodle error responses advertise application/json and include errorcode for
   the shared mapping. HTTP authorization/not-found/server status mappings are
   independent of JSON bodies. Unusual error content types remain outside this
   verified response-shape assumption.
7. Local permissions permit creating the numeric course directory, exclusive
   reservation/part files and final rename. Pre-existing symlinks/junctions in
   the effective directory path are refused. The tool does not support a custom
   download folder, bulk ZIP/folder downloads or assignment intro attachments.

JSON resources temporarily use memory up to their allowed size to distinguish
Moodle error objects; ordinary binary files are streamed without whole-file
buffering. Cleanup attempts can only succeed while filesystem permissions allow
deletion; normal error/overflow paths are covered by temporary-directory tests.
No live download, real downloads-directory write, dependency installation,
repository `.env` or commit was performed.
