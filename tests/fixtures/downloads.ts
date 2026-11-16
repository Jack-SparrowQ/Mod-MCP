import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { vi } from 'vitest';
import { RestClient } from '../../src/infrastructure/moodle/rest-client.js';
import { RestAdapter } from '../../src/infrastructure/moodle/rest-adapter.js';
import { createLogger } from '../../src/infrastructure/logging/logger.js';
import { siteInfo, enrolledCourses } from './moodle.js';

const roots: string[] = [];
export async function temporaryRoot() {
  const root = await mkdtemp(join(resolve(tmpdir()), 'moodle-download-test-'));
  roots.push(root);
  return root;
}
export async function cleanupDownloadTests() {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected temporary path');
    await rm(root, {recursive: true, force: true});
  }
}
export const baseUrl = 'https://example.invalid/moodle/';
export const fileUrl = baseUrl + 'webservice/pluginfile.php/70/mod_resource/content/1/notes.pdf?forcedownload=1';
export const resourceFile = {type: 'file', filename: 'notes.pdf', filepath: '/', filesize: 8, mimetype: 'application/pdf', fileurl: fileUrl};
export function resourceSections(files: unknown[] = [resourceFile]) {
  return [{id: 70, name: 'Section', modules: [{id: 71, name: 'File', modname: 'resource', contents: files}]}];
}
export async function downloadFixture(sections: unknown = resourceSections()) {
  const root = await temporaryRoot();
  const downloadRoot = join(root, 'downloads');
  const logs: string[] = [];
  const mock = vi.fn<typeof fetch>(async (_url, options) => {
    if (options?.method === 'GET') return new Response('%PDFfake', {headers: {'content-type': 'application/pdf'}});
    const name = (options?.body as URLSearchParams).get('wsfunction');
    return new Response(JSON.stringify(name === 'core_webservice_get_site_info' ? siteInfo
      : name === 'core_enrol_get_users_courses' ? enrolledCourses : sections));
  });
  const logger = createLogger('info', {write: line => { logs.push(line); }});
  const client = new RestClient({baseUrl, token: 'fixture-secret-token', logger, fetch: mock});
  const adapter = new RestAdapter(client, {root: downloadRoot, maxBytes: 1024});
  return {root, downloadRoot, client, adapter, mock, logger, logs};
}
