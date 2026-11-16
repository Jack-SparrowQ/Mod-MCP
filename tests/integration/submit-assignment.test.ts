import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { writeFile, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from '../../src/mcp/server.js';
import { submissionFixture } from '../fixtures/submissions.js';
import { cleanupDownloadTests } from '../fixtures/downloads.js';
import { NOW, SECOND, day } from '../fixtures/academic.js';

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(cleanupDownloadTests);
type Fixture = Awaited<ReturnType<typeof submissionFixture>>;
type Handler = (request: any, fixture: Fixture) => Promise<any>;
async function session(run: (client: Client, fixture: Fixture) => Promise<void>, options: {
  supported?: boolean; handler?: Handler; configure?: (fixture: Fixture) => void | Promise<void>;
} = {}) {
  const fixture = await submissionFixture();
  await options.configure?.(fixture);
  const server = createServer(fixture.adapter, {submissionFiles: fixture.files});
  const client = new Client({name: 'submission-offline', version: '1'},
    {capabilities: options.supported === false ? {} : {elicitation: {form: {}}}});
  if (options.supported !== false) client.setRequestHandler(ElicitRequestSchema, async request => {
    if (options.handler) return options.handler(request, fixture);
    return {action: 'accept', content: {confirm: true,
      ...(request.params.mode !== 'url' && request.params.requestedSchema.properties.acceptStatement ? {acceptStatement: true} : {})}};
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try { await server.connect(st); await client.connect(ct); await run(client, fixture); }
  finally { await client.close(); await server.close(); }
}
async function submit(client: Client, input: Record<string, unknown> = {assignmentId: 101, files: ['unit/report.pdf']}) {
  const result = await client.callTool({name: 'moodle_submit_assignment', arguments: input});
  if (result.structuredContent) expect(result.content).toEqual([{type: 'text', text: JSON.stringify(result.structuredContent)}]);
  return result;
}
it('requires an elicitation-capable client and makes zero writes otherwise', async () => {
  await session(async (client, fixture) => {
    const result = await submit(client);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({error: {code: 'CONFIRMATION_REQUIRED',
      suggestion: 'Use an MCP client that supports elicitation, such as Claude Code'}});
    expect(fixture.writes()).toHaveLength(0);
  }, {supported: false});
});
it.each([
  {action: 'decline'}, {action: 'cancel'}, {action: 'accept', content: {confirm: false}},
  {action: 'accept', content: {confirm: true}},
  {action: 'accept', content: {confirm: true, acceptStatement: false}},
  {action: 'accept', content: {confirm: 'true', acceptStatement: true}},
])('cancels without writes for %j including a missing required statement', async response => {
  await session(async (client, fixture) => {
    const result = await submit(client);
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({submitted: false, cancelled: true});
    expect(fixture.writes()).toHaveLength(0);
  }, {configure: fixture => { fixture.policy.requiresubmissionstatement = 1; }, handler: async () => response});
});
it('elicits exact assignment/files/warnings, reuses draft itemid, writes once in order and verifies success', async () => {
  let message = '';
  await session(async (client, fixture) => {
    const tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(12);
    expect(tools.find(tool => tool.name === 'moodle_submit_assignment')?.annotations)
      .toEqual({readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true});
    const result = await submit(client, {assignmentId: 101, files: ['unit/report.pdf', 'extra.pdf']});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({submitted: true, status: 'submitted', assignmentId: 101,
      assignmentName: 'Fixture assignment', courseName: 'SISTEMAS OPERATIVOS',
      files: [{name: 'unit/report.pdf', size: 18}, {name: 'extra.pdf', size: 11}], submittedAt: '2026-11-16T12:00:00.000Z', late: true});
    expect(message).toContain('SISTEMAS OPERATIVOS'); expect(message).toContain('Fixture assignment');
    expect(message).toContain('LATE'); expect(message).toContain('2026-11-15T12:00:00.000Z');
    expect(message).toContain('unit/report.pdf (18 bytes)'); expect(message).toContain('replaces 2 existing draft files');
    expect(message).toContain('submitted for grading (final)'); expect(message).toContain('This work is my own.');
    const operations = fixture.calls();
    expect(operations.slice(-5).map(call => call.name)).toEqual(['upload', 'upload', 'mod_assign_save_submission',
      'mod_assign_submit_for_grading', 'mod_assign_get_submission_status']);
    const uploads = fixture.writes().filter(call => call.name === 'upload');
    expect(uploads.map(call => (call.options.body as FormData).get('itemid'))).toEqual(['0', '900']);
    for (const upload of uploads) {
      expect(upload.url).toBe('https://example.invalid/moodle/webservice/upload.php');
      expect(upload.options).toMatchObject({method: 'POST', redirect: 'error'});
      expect((upload.options.body as FormData).get('filearea')).toBe('draft');
      expect((upload.options.body as FormData).get('token')).toBe('fixture-secret-token');
      expect((upload.options.body as FormData).has('userid')).toBe(false);
    }
    const save = fixture.writes().find(call => call.name === 'mod_assign_save_submission')!;
    expect(Object.fromEntries(save.options.body as URLSearchParams)).toEqual({assignmentid: '101', 'plugindata[files_filemanager]': '900',
      wstoken: 'fixture-secret-token', wsfunction: 'mod_assign_save_submission', moodlewsrestformat: 'json'});
    const final = fixture.writes().find(call => call.name === 'mod_assign_submit_for_grading')!;
    expect((final.options.body as URLSearchParams).get('acceptsubmissionstatement')).toBe('1');
    // Only the existing own-enrolment read needs userid; none of the submission endpoints send it.
    for (const call of operations.filter(call => call.name !== 'core_enrol_get_users_courses')) {
      expect((call.options.body as FormData | URLSearchParams).has('userid')).toBe(false);
    }
    expect(fixture.logs.join('')).not.toMatch(/report.pdf|extra.pdf|fixture-secret-token|sha256|https:/);
    expect(JSON.stringify(result)).not.toMatch(/fixture-secret-token|sha256/);
  }, {configure: fixture => { fixture.policy.requiresubmissionstatement = 1; }, handler: async request => {
    expect(request.params.mode).toBe('form');
    expect(request.params.requestedSchema.required).toEqual(['confirm', 'acceptStatement']);
    message = request.params.message;
    return {action: 'accept', content: {confirm: true, acceptStatement: true}};
  }});
});
it('saves once without submit_for_grading when drafts are disabled and still verifies submitted', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client)).structuredContent).toMatchObject({submitted: true});
    expect(fixture.writes().map(call => call.name)).toEqual(['upload', 'mod_assign_save_submission']);
    expect(fixture.calls().at(-1)?.name).toBe('mod_assign_get_submission_status');
  }, {configure: fixture => { fixture.policy.submissiondrafts = 0; }});
});
it('fails verification without claiming success if Moodle still reports draft', async () => {
  await session(async (client, fixture) => {
    const result = await submit(client);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({error: {code: 'OPERATION_FAILED',
      message: 'Files were saved in Moodle as a draft but the submission was not confirmed.',
      context: {status: 'draft', draftSaved: true},
      suggestion: 'Open the assignment in Moodle to check it; do not retry blindly.'}});
    expect(result.structuredContent).not.toHaveProperty('submitted');
    expect(fixture.calls().at(-1)?.name).toBe('mod_assign_get_submission_status');
  }, {configure: fixture => { fixture.verified.lastattempt.submission.status = 'draft'; }});
});
it.each([
  ['../outside.pdf'], ['/absolute.pdf'], ['C:\\absolute.pdf'], ['https://evil.invalid/file.pdf'],
  ['unit'], ['empty.pdf'], ['unit/report.pdf', 'unit/report.pdf'], ['unit/report.pdf', 'alias/report.pdf'],
  ['unit/report.pdf:secret'],
].map(files => ({files})))('rejects unsafe local files %j with zero HTTP calls', async ({files}) => {
  await session(async (client, fixture) => {
    const result = await submit(client, {assignmentId: 101, files});
    expect(result.structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR'}});
    expect(fixture.mock).not.toHaveBeenCalled();
  }, {configure: async fixture => {
    await writeFile(join(fixture.submissionRoot, 'empty.pdf'), '');
    await mkdir(join(fixture.submissionRoot, 'alias'));
    await writeFile(join(fixture.submissionRoot, 'alias', 'report.pdf'), 'duplicate basename');
  }});
});
it('refuses a junction escape before any HTTP call', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client, {assignmentId: 101, files: ['link/secret.pdf']})).structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR'}});
    expect(fixture.mock).not.toHaveBeenCalled();
  }, {configure: async fixture => {
    const external = join(fixture.root, 'outside'); await mkdir(external);
    await writeFile(join(external, 'secret.pdf'), 'not approved');
    await symlink(external, join(fixture.submissionRoot, 'link'), 'junction');
  }});
});
it.each([
  ['already_submitted', (f: Fixture) => { f.preflight.lastattempt.submission.status = 'submitted'; }],
  ['cutoff_passed', (f: Fixture) => { f.policy.cutoffdate = SECOND - 1; }],
  ['not_open', (f: Fixture) => { f.policy.allowsubmissionsfromdate = SECOND + day; }],
  ['too_many_files', (f: Fixture) => { f.setting('maxfilesubmissions', '0'); }],
  ['file_too_large', (f: Fixture) => { f.setting('maxsubmissionsizebytes', '1'); }],
  ['file_extension', (f: Fixture) => { f.setting('filetypeslist', '.docx'); }],
  ['cannot_edit', (f: Fixture) => { f.preflight.lastattempt.canedit = false; }],
  ['cannot_submit', (f: Fixture) => { f.preflight.lastattempt.cansubmit = false; }],
] as const)('refuses %s before any remote write', async (reason, configure) => {
  await session(async (client, fixture) => {
    expect((await submit(client)).structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR', context: {reason}}});
    expect(fixture.writes()).toHaveLength(0);
  }, {configure});
});
it.each(['disabled', 'team'])('refuses unsupported %s assignments without writes', async mode => {
  await session(async (client, fixture) => {
    expect((await submit(client)).structuredContent).toMatchObject({error: {code: 'INTEGRATION_UNSUPPORTED'}});
    expect(fixture.writes()).toHaveLength(0);
  }, {configure: fixture => { if (mode === 'team') fixture.policy.teamsubmission = 1; else fixture.setting('enabled', '0'); }});
});
it('refuses an assignment not in enrolled-course assignment results without writes', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client, {assignmentId: 999, files: ['unit/report.pdf']})).structuredContent).toMatchObject({error: {code: 'RESOURCE_NOT_FOUND'}});
    expect(fixture.writes()).toHaveLength(0);
  });
});
it('detects file modification during confirmation before the first upload', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client)).structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR'}});
    expect(fixture.writes()).toHaveLength(0);
  }, {handler: async (_request, fixture) => {
    await writeFile(join(fixture.submissionRoot, 'unit', 'report.pdf'), 'different PDF data');
    return {action: 'accept', content: {confirm: true}};
  }});
});
it('validates all changed files before uploading even the first unchanged file', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client, {assignmentId: 101, files: ['unit/report.pdf', 'extra.pdf']})).structuredContent)
      .toMatchObject({error: {code: 'VALIDATION_ERROR'}});
    expect(fixture.writes()).toHaveLength(0);
  }, {handler: async (_request, fixture) => {
    await writeFile(join(fixture.submissionRoot, 'extra.pdf'), 'changed');
    return {action: 'accept', content: {confirm: true}};
  }});
});
it('skips local extension checks for Moodle file-type groups and accepts a zero unlimited-size config', async () => {
  await session(async client => {
    expect((await submit(client)).structuredContent).toMatchObject({submitted: true});
  }, {configure: fixture => { fixture.setting('filetypeslist', 'document,.docx'); fixture.setting('maxsubmissionsizebytes', '0'); }});
});
it('rejects a concurrent submission while the first confirmation is pending', async () => {
  let ready!: () => void; const pending = new Promise<void>(resolve => { ready = resolve; });
  let finish!: (result: any) => void;
  await session(async (client, fixture) => {
    const first = submit(client);
    await pending;
    expect((await submit(client)).structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR', message: 'submission already in progress'}});
    expect(fixture.writes()).toHaveLength(0);
    finish({action: 'accept', content: {confirm: true}});
    expect((await first).structuredContent).toMatchObject({submitted: true});
    expect(fixture.writes().filter(call => call.name === 'upload')).toHaveLength(1);
  }, {handler: async () => { ready(); return new Promise(resolve => { finish = resolve; }); }});
});
it.each(['upload', 'mod_assign_save_submission', 'mod_assign_submit_for_grading'])('never retries a failed write at %s', async failed => {
  await session(async (client, fixture) => {
    const result = await submit(client);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).not.toHaveProperty('submitted');
    expect(fixture.writes().filter(call => call.name === failed)).toHaveLength(1);
    if (failed === 'mod_assign_submit_for_grading') {
      expect(result.structuredContent).toMatchObject({error: {code: 'OPERATION_FAILED',
        message: 'Files were saved in Moodle as a draft but the submission was not confirmed.',
        context: {draftSaved: true, warningcodes: 'submission_warning'},
        suggestion: 'Open the assignment in Moodle to check it; do not retry blindly.'}});
    } else {
      expect((result.structuredContent!.error as {context: object}).context).not.toHaveProperty('draftSaved');
    }
    expect(fixture.writes().at(-1)?.name).toBe(failed);
    expect(JSON.stringify(result) + fixture.logs.join('')).not.toContain('PRIVATE_WARNING');
    if (failed !== 'upload') expect(fixture.logs.map(line => JSON.parse(line)).findLast(line => line.function === failed)?.outcome).toBe('OPERATION_FAILED');
  }, {configure: fixture => {
    fixture.replies[failed] = failed === 'upload' ? {errorcode: 'nopermissions', message: 'PRIVATE_WARNING'}
      : [{warningcode: 'submission_warning', message: 'PRIVATE_WARNING'}];
  }});
});
it('preserves the original error code when finalization fails after save', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client)).structuredContent).toEqual({error: {code: 'PERMISSION_DENIED',
      message: 'Files were saved in Moodle as a draft but the submission was not confirmed.',
      context: {errorcode: 'nopermissions', draftSaved: true},
      suggestion: 'Open the assignment in Moodle to check it; do not retry blindly.'}});
    expect(fixture.writes().map(call => call.name)).toEqual(['upload', 'mod_assign_save_submission', 'mod_assign_submit_for_grading']);
  }, {configure: fixture => { fixture.replies.mod_assign_submit_for_grading = {errorcode: 'nopermissions', message: 'PRIVATE_WARNING'}; }});
});
it('preserves a verification transport failure after save with draftSaved and no retry', async () => {
  await session(async (client, fixture) => {
    expect((await submit(client)).structuredContent).toEqual({error: {code: 'MOODLE_UNAVAILABLE',
      message: 'Files were saved in Moodle as a draft but the submission was not confirmed.',
      context: {draftSaved: true}, suggestion: 'Open the assignment in Moodle to check it; do not retry blindly.'}});
    expect(fixture.calls().filter(call => call.name === 'mod_assign_get_submission_status')).toHaveLength(2);
  }, {configure: fixture => {
    const original = fixture.mock.getMockImplementation()!;
    let statusCalls = 0;
    fixture.mock.mockImplementation(async (url, options) => {
      if (!(options!.body instanceof FormData) && (options!.body as URLSearchParams).get('wsfunction') === 'mod_assign_get_submission_status' && ++statusCalls === 2) {
        throw new Error('PRIVATE_TRANSPORT_ERROR');
      }
      return original(url, options);
    });
  }});
});
it.each([{userid: 42}, {confirm: true}, {url: 'https://evil.invalid'}, {files: []}, {files: Array(21).fill('x.pdf')}])
  ('rejects extra fields or invalid input %j before any HTTP call', async extra => {
    await session(async (client, fixture) => {
      expect((await submit(client, {assignmentId: 101, files: ['unit/report.pdf'], ...extra})).isError).toBe(true);
      expect(fixture.mock).not.toHaveBeenCalled();
    });
  });
