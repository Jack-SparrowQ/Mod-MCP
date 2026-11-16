import { afterEach, expect, it, vi } from 'vitest';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { downloadFile } from '../../src/infrastructure/moodle/file-download.js';
import { downloadFixture, cleanupDownloadTests, fileUrl, baseUrl } from '../fixtures/downloads.js';
afterEach(cleanupDownloadTests);

it.each([
  'https://evil.invalid/moodle/webservice/pluginfile.php/1/file.pdf',
  'https://example.invalid/other/webservice/pluginfile.php/1/file.pdf',
  'https://example.invalid/moodle/pluginfile.php/1/file.pdf',
  'http://example.invalid/moodle/webservice/pluginfile.php/1/file.pdf',
  'https://example.invalid.evil.com/moodle/webservice/pluginfile.php/1/file.pdf',
  'https://moodle.itescam.edu.mx.evil.com/moodle4/webservice/pluginfile.php/1/file.pdf',
  baseUrl + 'webservice/pluginfile.php/../pluginfile.php/1/file.pdf',
  baseUrl + 'webservice/pluginfile.php/%2e%2e/pluginfile.php/1/file.pdf',
  baseUrl + 'webservice/pluginfile.php/%252e%252e/pluginfile.php/1/file.pdf',
  'https://user:password@example.invalid/moodle/webservice/pluginfile.php/1/file.pdf',
])('refuses unauthorized URL %s without fetch', async url => {
  const f = await downloadFixture();
  const error = await f.client.download(url, join(f.root, 'saved.pdf'), 1024).catch(error => error);
  expect(error).toMatchObject({code: 'PERMISSION_DENIED', suggestion: 'Only Moodle-hosted files can be downloaded'});
  expect(f.mock).not.toHaveBeenCalled();
  expect(await readdir(f.root)).toEqual([]);
});
it('streams a file, replaces an existing token query only in the fetch URL and logs only safe metrics', async () => {
  const f = await downloadFixture();
  const saved = await f.client.download(fileUrl + '&token=old', join(f.root, 'saved.pdf'), 1024);
  expect(await readFile(saved.path, 'utf8')).toBe('%PDFfake');
  expect(saved).toMatchObject({size: 8, mimeType: 'application/pdf'});
  const [url, options] = f.mock.mock.calls[0];
  expect(new URL(String(url)).searchParams.getAll('token')).toEqual(['fixture-secret-token']);
  expect(options).toMatchObject({method: 'GET', redirect: 'error'});
  expect(options!.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.stringify(saved) + f.logs.join('')).not.toMatch(/fixture-secret-token|pluginfile.php/);
  const log = JSON.parse(f.logs[0]);
  expect(log).toMatchObject({function: 'pluginfile', bytes: 8, outcome: 'OK'});
  expect(Object.keys(log).sort()).toEqual(['function', 'durationMs', 'bytes', 'outcome', 'pid', 'hostname', 'time', 'level'].sort());
  expect(f.logs.join('')).not.toContain('saved.pdf');
  expect((await readdir(f.root)).some(name => name.endsWith('.part'))).toBe(false);
});
it('never overwrites existing files, including concurrent same-name downloads', async () => {
  const f = await downloadFixture();
  const destination = join(f.root, 'saved.pdf');
  await writeFile(destination, 'original');
  const results = await Promise.all([f.client.download(fileUrl, destination, 1024), f.client.download(fileUrl, destination, 1024)]);
  expect(results.map(result => basename(result.path)).sort()).toEqual(['saved (1).pdf', 'saved (2).pdf']);
  expect(await readFile(destination, 'utf8')).toBe('original');
});
it.each([[404, 'RESOURCE_NOT_FOUND'], [401, 'PERMISSION_DENIED'], [403, 'PERMISSION_DENIED'], [503, 'MOODLE_UNAVAILABLE']])
  ('maps HTTP %s and leaves no files', async (status, code) => {
    const f = await downloadFixture();
    f.mock.mockResolvedValue(new Response('private', {status: Number(status)}));
    await expect(f.client.download(fileUrl, join(f.root, 'saved.pdf'), 1024)).rejects.toMatchObject({code});
    expect(await readdir(f.root)).toEqual([]);
  });
it.each(['invalidtoken', 'nopermissions', 'webservicesnotenabled', 'othererror'])('maps JSON Moodle %s without saving a file', async errorcode => {
  const f = await downloadFixture();
  f.mock.mockResolvedValue(new Response(JSON.stringify({errorcode, message: 'fixture-secret-token'}), {headers: {'content-type': 'application/json; charset=utf-8'}}));
  const error = await f.client.download(fileUrl, join(f.root, 'saved.pdf'), 1024).catch(error => error);
  expect(error.code).toBe(({invalidtoken: 'SESSION_EXPIRED', nopermissions: 'PERMISSION_DENIED', webservicesnotenabled: 'INTEGRATION_UNSUPPORTED'} as Record<string, string>)[errorcode] ?? 'OPERATION_FAILED');
  expect(`${error.stack}${JSON.stringify(error)}${f.logs.join('')}`).not.toContain('fixture-secret-token');
  expect(await readdir(f.root)).toEqual([]);
});
it('rejects excessive content-length before reading and writing', async () => {
  const f = await downloadFixture();
  const reader = vi.fn();
  f.mock.mockResolvedValue({ok: true, status: 200, headers: new Headers({'content-length': '999'}), body: {getReader: reader}} as unknown as Response);
  await expect(f.client.download(fileUrl, join(f.root, 'saved.pdf'), 4)).rejects.toMatchObject({code: 'VALIDATION_ERROR', context: {maxMb: 4 / (1024 * 1024)}});
  expect(reader).not.toHaveBeenCalled();
  expect(await readdir(f.root)).toEqual([]);
});
it('aborts on streamed overflow and removes the part/reservation', async () => {
  const f = await downloadFixture();
  f.mock.mockResolvedValue(new Response(new ReadableStream({start(controller) {
    controller.enqueue(new Uint8Array(3)); controller.enqueue(new Uint8Array(3)); controller.close();
  }})));
  await expect(f.client.download(fileUrl, join(f.root, 'saved.pdf'), 4)).rejects.toMatchObject({code: 'VALIDATION_ERROR'});
  expect(f.mock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  expect(await readdir(f.root)).toEqual([]);
});
it('removes partial files on stream failure and hides the original exception', async () => {
  const f = await downloadFixture();
  let reads = 0;
  f.mock.mockResolvedValue(new Response(new ReadableStream({pull(controller) {
    if (reads++ === 0) controller.enqueue(new Uint8Array(2));
    else controller.error(new Error('fixture-secret-token saved.pdf'));
  }})));
  const error = await f.client.download(fileUrl, join(f.root, 'saved.pdf'), 1024).catch(error => error);
  expect(error.code).toBe('MOODLE_UNAVAILABLE');
  expect(`${error.stack}${f.logs.join('')}`).not.toMatch(/fixture-secret-token|saved.pdf/);
  expect(await readdir(f.root)).toEqual([]);
});
it('removes a size-mismatched download and returns OPERATION_FAILED', async () => {
  const f = await downloadFixture();
  await expect(f.client.download(fileUrl, join(f.root, 'saved.pdf'), 1024, 100)).rejects.toMatchObject({code: 'OPERATION_FAILED'});
  expect(await readdir(f.root)).toEqual([]);
});
it('uses a bounded timeout and hides network errors', async () => {
  const f = await downloadFixture();
  f.mock.mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new Error('fixture-secret-token')), {once: true});
  }));
  await expect(downloadFile({baseUrl, fileUrl, token: 'fixture-secret-token', logger: f.logger,
    fetch: f.mock, destination: join(f.root, 'saved.pdf'), maxBytes: 1024, timeoutMs: 5})).rejects.toMatchObject({code: 'MOODLE_UNAVAILABLE'});
  expect(f.logs.join('')).not.toContain('fixture-secret-token');
});
it('saves JSON resources without errorcode instead of interpreting ordinary data as an exception', async () => {
  const f = await downloadFixture();
  const data = JSON.stringify({error: 'A field in a legitimate JSON resource'});
  f.mock.mockResolvedValue(new Response(data, {headers: {'content-type': 'application/json'}}));
  const saved = await f.client.download(fileUrl, join(f.root, 'data.json'), 1024);
  expect(await readFile(saved.path, 'utf8')).toBe(data);
});
