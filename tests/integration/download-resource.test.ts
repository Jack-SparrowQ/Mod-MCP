import { afterEach, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readdir, readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { createServer } from '../../src/mcp/server.js';
import { cleanupDownloadTests, downloadFixture, resourceSections, resourceFile } from '../fixtures/downloads.js';
afterEach(cleanupDownloadTests);

async function session(run: (client: Client, fixture: Awaited<ReturnType<typeof downloadFixture>>) => Promise<void>, sections?: unknown) {
  const fixture = await downloadFixture(sections);
  const server = createServer(fixture.adapter);
  const client = new Client({name: 'download-offline', version: '1'});
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try { await server.connect(st); await client.connect(ct); await run(client, fixture); }
  finally { await client.close(); await server.close(); }
}
async function call(client: Client, input: Record<string, unknown>) {
  const result = await client.callTool({name: 'moodle_download_resource', arguments: input});
  expect(result.content).toEqual([{type: 'text', text: JSON.stringify(result.structuredContent)}]);
  return result;
}
it('registers twelve tools and downloads a single file without exposing its URL/token', async () => {
  await session(async (client, fixture) => {
    const tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(12);
    expect(tools.find(tool => tool.name === 'moodle_download_resource')?.annotations)
      .toEqual({readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true});
    const result = await call(client, {courseId: 7, moduleId: 71});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({file: {path: join(fixture.downloadRoot, '7', 'notes.pdf'),
      filename: 'notes.pdf', originalFilename: 'notes.pdf', size: 8, mimeType: 'application/pdf', courseId: 7, moduleId: 71}});
    const file = result.structuredContent!.file as {path: string};
    expect(isAbsolute(file.path)).toBe(true);
    expect(await readFile(file.path, 'utf8')).toBe('%PDFfake');
    expect(JSON.stringify(result)).not.toMatch(/fixture-secret-token|pluginfile.php|forcedownload/);
    expect(fixture.logs.join('')).not.toMatch(/notes.pdf|pluginfile.php|fixture-secret-token/);
  });
});
it('lists filepath metadata but still no download URL', async () => {
  await session(async client => {
    const result = await client.callTool({name: 'moodle_get_course_contents', arguments: {courseId: 7}});
    expect(result.structuredContent).toMatchObject({sections: [{modules: [{files: [{filename: 'notes.pdf', filepath: '/unit1/'}]}]}]});
    expect(JSON.stringify(result)).not.toMatch(/fileurl|pluginfile.php/);
  }, resourceSections([{...resourceFile, filepath: '/unit1/'}]));
});
it('requires a filename for multi-file modules and matches filename/optional filepath exactly', async () => {
  await session(async (client, fixture) => {
    const ambiguous = await call(client, {courseId: 7, moduleId: 71});
    expect(ambiguous.isError).toBe(true);
    expect(ambiguous.structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR', context: {fileCount: 2}}});
    expect(fixture.mock.mock.calls.filter(([, options]) => options?.method === 'GET')).toHaveLength(0);
    const selected = await call(client, {courseId: 7, moduleId: 71, filename: 'second.pdf', filepath: '/unit2/'});
    expect(selected.isError).toBe(false);
    expect(selected.structuredContent).toMatchObject({file: {filename: 'second.pdf'}});
  }, resourceSections([resourceFile, {...resourceFile, filename: 'second.pdf', filepath: '/unit2/'}]));
});
it('disambiguates identical filenames by filepath', async () => {
  await session(async client => {
    expect((await call(client, {courseId: 7, moduleId: 71, filename: 'notes.pdf'})).structuredContent)
      .toMatchObject({error: {code: 'VALIDATION_ERROR', context: {fileCount: 2}}});
    expect((await call(client, {courseId: 7, moduleId: 71, filename: 'notes.pdf', filepath: '/unit2/'})).isError).toBe(false);
  }, resourceSections([{...resourceFile, filepath: '/unit1/'}, {...resourceFile, filepath: '/unit2/'}]));
});
it('rejects a non-enrolled course before contents and binary requests', async () => {
  await session(async (client, fixture) => {
    expect((await call(client, {courseId: 999, moduleId: 71})).structuredContent).toMatchObject({error: {code: 'RESOURCE_NOT_FOUND'}});
    expect(fixture.mock.mock.calls.some(([, options]) => options?.method === 'GET' ||
      (options?.body as URLSearchParams).get('wsfunction') === 'core_course_get_contents')).toBe(false);
    expect(await readdir(fixture.root)).toEqual([]);
  });
});
it.each([{moduleId: 999}, {moduleId: 71, filename: 'missing.pdf'}, {moduleId: 71, filename: 'notes.pdf', filepath: '/missing/'}])
  ('returns RESOURCE_NOT_FOUND for a missing module/file: %j', async input => {
    await session(async (client, fixture) => {
      const result = await call(client, {courseId: 7, ...input});
      expect(result.structuredContent).toMatchObject({error: {code: 'RESOURCE_NOT_FOUND'}});
      expect(fixture.mock.mock.calls.filter(([, options]) => options?.method === 'GET')).toHaveLength(0);
    });
  });
it('rejects modules with no files and never follows external link contents', async () => {
  await session(async (client, fixture) => {
    expect((await call(client, {courseId: 7, moduleId: 71})).structuredContent).toMatchObject({error: {code: 'RESOURCE_NOT_FOUND'}});
    expect(fixture.mock.mock.calls.filter(([, options]) => options?.method === 'GET')).toHaveLength(0);
  }, resourceSections([{type: 'url', filename: 'external', fileurl: 'https://evil.invalid/file.pdf'}]));
});
it('refuses a foreign file URL sourced from Moodle metadata without a binary request', async () => {
  await session(async (client, fixture) => {
    const result = await call(client, {courseId: 7, moduleId: 71});
    expect(result.structuredContent).toMatchObject({error: {code: 'PERMISSION_DENIED'}});
    expect(fixture.mock.mock.calls.filter(([, options]) => options?.method === 'GET')).toHaveLength(0);
    expect(await readdir(fixture.root)).toEqual([]);
  }, resourceSections([{...resourceFile, fileurl: 'https://evil.invalid/file.pdf'}]));
});
it('deletes mismatched files before returning OPERATION_FAILED', async () => {
  await session(async (client, fixture) => {
    expect((await call(client, {courseId: 7, moduleId: 71})).structuredContent).toMatchObject({error: {code: 'OPERATION_FAILED'}});
    expect(await readdir(join(fixture.downloadRoot, '7'))).toEqual([]);
  }, resourceSections([{...resourceFile, filesize: 9}]));
});
it('saves a hostile original filename inside the course directory under a safe basename', async () => {
  await session(async (client, fixture) => {
    expect((await call(client, {courseId: 7, moduleId: 71})).structuredContent).toEqual({file: {
      path: join(fixture.downloadRoot, '7', 'x.pdf'), filename: 'x.pdf', originalFilename: '../../x.pdf',
      size: 8, mimeType: 'application/pdf', courseId: 7, moduleId: 71,
    }});
  }, resourceSections([{...resourceFile, filename: '../../x.pdf'}]));
});
it.each([{url: 'https://evil.invalid/file.pdf'}, {fileUrl: 'https://evil.invalid/file.pdf'}, {userid: 99}, {filename: ''}, {courseId: 0}])
  ('strictly rejects URL/user/invalid inputs %j without fetch', async extra => {
    await session(async (client, fixture) => {
      const result = await client.callTool({name: 'moodle_download_resource', arguments: {courseId: 7, moduleId: 71, ...extra}});
      expect(result.isError).toBe(true);
      expect(fixture.mock).not.toHaveBeenCalled();
    });
  });
