import { afterEach, expect, it } from 'vitest';
import { mkdir, writeFile, readFile, readdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadFixture, temporaryRoot, cleanupDownloadTests, fileUrl, baseUrl } from '../fixtures/downloads.js';
import { academicFixture, NOW, SECOND } from '../fixtures/academic.js';
import { downloadFile } from '../../src/infrastructure/moodle/file-download.js';
import { LocalSubmissionFiles } from '../../src/infrastructure/files/submission-files.js';
import { normalizeSubmissionStatus } from '../../src/shared/submission-status.js';
import { getAssignment } from '../../src/application/get-assignment.js';
afterEach(cleanupDownloadTests);

it.skipIf(process.platform !== 'win32')('Windows download root casing: canonical root accepts differently cased launch path (Windows-only)', async () => {
  const f = await downloadFixture();
  const root = join(f.root, 'MiXeDDownloads');
  await mkdir(root);
  const result = await downloadFile({baseUrl, fileUrl, token: 'fixture-secret-token', root: root.toLowerCase(),
    destination: join(root.toLowerCase(), '7', 'file.pdf'), maxBytes: 1024, logger: f.logger, fetch: f.mock});
  expect(await readFile(result.path, 'utf8')).toBe('%PDFfake');
});
it.skipIf(process.platform !== 'win32')('Windows submission root casing: inspection and hash recheck accept differently cased root (Windows-only)', async () => {
  const root = join(await temporaryRoot(), 'MiXeDSubmissions');
  await mkdir(root); await writeFile(join(root, 'file.pdf'), 'approved file');
  const files = new LocalSubmissionFiles(root.toLowerCase());
  const inspected = await files.inspect(['file.pdf']);
  expect((await files.readVerified(inspected))[0].bytes.toString()).toBe('approved file');
});
it('canonical download containment still rejects a junction escape', async () => {
  const f = await downloadFixture();
  const root = join(f.root, 'Downloads'); const outside = join(f.root, 'Outside');
  await mkdir(root); await mkdir(outside); await symlink(outside, join(root, '7'), 'junction');
  await expect(downloadFile({baseUrl, fileUrl, token: 'fixture-secret-token', root,
    destination: join(root, '7', 'file.pdf'), maxBytes: 1024, logger: f.logger, fetch: f.mock}))
    .rejects.toMatchObject({code: 'PERMISSION_DENIED'});
  expect(await readdir(outside)).toEqual([]);
});
it('shared first-attempt normalization reports new for a present attempt without submission, unknown for missing/malformed attempt', async () => {
  expect(normalizeSubmissionStatus({})).toEqual({status: 'new', lastModified: null});
  expect(normalizeSubmissionStatus(undefined)).toEqual({status: 'unknown', lastModified: null});
  expect(normalizeSubmissionStatus('malformed' as never)).toEqual({status: 'unknown', lastModified: null});
  const {adapter} = academicFixture({mod_assign_get_submission_status: {lastattempt: {canedit: true}}});
  expect((await adapter.getAssignmentSubmission(101)).submission.status).toBe('new');
  expect((await adapter.getSubmissionState(101)).status).toBe('new');
});
it('shared team status prefers submitted team over a new individual attempt, with the team modification date', async () => {
  const {adapter} = academicFixture({mod_assign_get_submission_status: {lastattempt: {
    submission: {status: 'new'}, teamsubmission: {status: 'submitted', timemodified: SECOND},
  }}});
  expect((await adapter.getAssignmentSubmission(101)).submission).toMatchObject({status: 'submitted', lastModified: '2026-11-16T12:00:00.000Z'});
  expect(await adapter.getSubmissionState(101)).toMatchObject({status: 'submitted', lastModified: '2026-11-16T12:00:00.000Z'});
  expect((await getAssignment(adapter, 101, NOW)).assignment.submission.overdue).toBe(false);
});
it.each([{}, {gradeformatted: null, graderaw: null, grademin: null, grademax: null,
  percentageformatted: null, feedback: null, gradedategraded: null, gradeishidden: null}])
  ('optional grade item fields can be absent/null and yield null public values: %j', async optional => {
    const {adapter} = academicFixture({gradereport_user_get_grade_items: {usergrades: [{userid: 42, gradeitems: [
      {itemname: 'Optional item', itemtype: 'mod', itemmodule: null, ...optional},
    ]}]}});
    expect(await adapter.getGradeItems((await adapter.getCourses())[0])).toEqual([{
      name: 'Optional item', itemType: 'mod', grade: null, rawGrade: null, min: null, max: null,
      percentage: null, feedback: null, gradedAt: null, graded: false,
    }]);
  });
it('an active download may outlast the inactivity interval if each chunk arrives in time', async () => {
  const f = await downloadFixture();
  let interval: ReturnType<typeof setInterval>;
  f.mock.mockResolvedValue(new Response(new ReadableStream({start(controller) {
    let chunks = 0;
    interval = setInterval(() => {
      controller.enqueue(new Uint8Array([1, 2]));
      if (++chunks === 4) { clearInterval(interval); controller.close(); }
    }, 200);
  }, cancel() { clearInterval(interval); }})));
  const started = performance.now();
  const saved = await downloadFile({baseUrl, fileUrl, token: 'fixture-secret-token', destination: join(f.root, 'slow.pdf'),
    maxBytes: 1024, logger: f.logger, fetch: f.mock, timeoutMs: 500});
  expect(saved.size).toBe(8);
  expect(performance.now() - started).toBeGreaterThan(500);
});
it('an inactive body times out, cancels the stream and removes its partial file', async () => {
  const f = await downloadFixture();
  let cancelled = false;
  f.mock.mockResolvedValue(new Response(new ReadableStream({cancel() { cancelled = true; }})));
  await expect(downloadFile({baseUrl, fileUrl, token: 'fixture-secret-token', destination: join(f.root, 'stalled.pdf'),
    maxBytes: 1024, logger: f.logger, fetch: f.mock, timeoutMs: 50})).rejects.toMatchObject({code: 'MOODLE_UNAVAILABLE'});
  expect(cancelled).toBe(true);
  expect(await readdir(f.root)).toEqual([]);
});
