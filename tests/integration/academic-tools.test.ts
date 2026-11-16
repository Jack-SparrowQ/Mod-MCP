import { expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp/server.js';
import { MoodleError } from '../../src/domain/errors.js';
import type { MoodleAdapter } from '../../src/domain/moodle-adapter.js';
import { adapterFixture } from '../fixtures/moodle.js';

async function withClient(adapter: MoodleAdapter, run: (client: Client) => Promise<void>) {
  const server = createServer(adapter);
  const client = new Client({name: 'academic-fixture-client', version: '1.0.0'});
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await run(client);
  } finally { await client.close(); await server.close(); }
}
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({name, arguments: args});
  expect(result.content).toEqual([{type: 'text', text: JSON.stringify(result.structuredContent)}]);
  return result;
}

it('lists exactly four read-only tools, returns only own profile fields and leaves auth status private', async () => {
  const {adapter} = adapterFixture();
  await withClient(adapter, async client => {
    const tools = (await client.listTools()).tools;
    expect(tools.map(tool => tool.name)).toEqual([
      'moodle_auth_status', 'moodle_get_profile', 'moodle_get_courses', 'moodle_get_course_contents',
    ]);
    expect(tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);
    const profile = await call(client, 'moodle_get_profile');
    expect(profile.isError).toBe(false);
    expect(profile.structuredContent).toEqual({profile: {
      id: 42, fullname: 'Fixture Student', username: 'fixture.student', email: 'student@example.invalid',
      profileUrl: 'https://example.invalid/moodle/user/profile.php?id=42',
    }});
    const auth = await call(client, 'moodle_auth_status');
    expect(auth.structuredContent).toEqual({authenticated: true, site: {
      sitename: 'Fixture Moodle', release: '4.1.1+', version: '2022112801.02', lang: 'es_mx',
    }});
    expect(JSON.stringify(auth)).not.toMatch(/userid|username|fullname|student@example/);
    expect(JSON.stringify(profile)).not.toMatch(/private-extra|userpictureurl|fixture-token/);
  });
});
it.each([
  [{query: 'sistemas operativos'}, [7, 8]],
  [{query: 'SÍSTEMAS OPERATÍVOS'}, [7, 8]],
  [{query: 'redes'}, [9]],
  [{courseId: 7}, [7]],
  [{courseId: 7, query: 'operativos'}, [7]],
  [{courseId: 7, query: 'no match'}, []],
  [{}, [7, 8, 9]],
] as const)('filters enrolled courses: %j', async (input, ids) => {
  const {adapter} = adapterFixture();
  await withClient(adapter, async client => {
    const result = await call(client, 'moodle_get_courses', input);
    const data = result.structuredContent as {courses: {id: number}[]; count: number};
    expect(result.isError).toBe(false);
    expect(data.courses.map(course => course.id)).toEqual(ids);
    expect(data.count).toBe(ids.length);
  });
});
it.each(['moodle_get_courses', 'moodle_get_course_contents'])('%s rejects non-enrolled course before contents fetch', async name => {
  const {adapter, requests} = adapterFixture();
  await withClient(adapter, async client => {
    const result = await call(client, name, {courseId: 999});
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({error: {
      code: 'RESOURCE_NOT_FOUND', message: 'Resource not found.', context: {},
      suggestion: 'Use moodle_get_courses to list enrolled courses',
    }});
    expect(requests().filter(request => request.wsfunction === 'core_course_get_contents')).toHaveLength(0);
  });
});
it('returns course identity plus sections and file metadata only after enrolment check', async () => {
  const {adapter, requests} = adapterFixture();
  await withClient(adapter, async client => {
    const result = await call(client, 'moodle_get_course_contents', {courseId: 7});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({course: {
      id: 7, fullname: 'SISTEMAS OPERATIVOS', url: 'https://example.invalid/moodle/course/view.php?id=7',
    }, sections: [{id: 70, number: 0, modules: [{id: 71}, {id: 72}]}]});
    expect(JSON.stringify(result)).not.toMatch(/fileurl|pluginfile|fixture-token/);
    expect(requests().map(request => request.wsfunction)).toEqual([
      'core_webservice_get_site_info', 'core_enrol_get_users_courses', 'core_course_get_contents',
    ]);
  });
});
it('distinguishes enrolled but inaccessible contents as PERMISSION_DENIED', async () => {
  const {adapter, requests} = adapterFixture({core_course_get_contents: {
    exception: 'moodle_exception', errorcode: 'accessexception', message: 'Private course data',
  }});
  await withClient(adapter, async client => {
    const result = await call(client, 'moodle_get_course_contents', {courseId: 7});
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({error: {code: 'PERMISSION_DENIED'}});
    expect(JSON.stringify(result)).not.toContain('Private course data');
    expect(requests().filter(request => request.wsfunction === 'core_course_get_contents')).toHaveLength(1);
  });
});
it.each(['AUTH_REQUIRED', 'SESSION_EXPIRED'] as const)('new tools treat %s as an error result', async code => {
  const failing = async (): Promise<never> => { throw new MoodleError(code); };
  const adapter: MoodleAdapter = {getSiteInfo: failing, getProfile: failing, getCourses: failing, getCourseContents: failing};
  await withClient(adapter, async client => {
    for (const name of ['moodle_get_profile', 'moodle_get_courses', 'moodle_get_course_contents']) {
      const result = await call(client, name, name === 'moodle_get_course_contents' ? {courseId: 7} : {});
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({error: {code, suggestion: 'Run npm run token'}});
      expect(result.structuredContent).not.toHaveProperty('authenticated');
    }
  });
});
it.each([
  ['moodle_auth_status', {userid: 99}], ['moodle_get_profile', {userid: 99}],
  ['moodle_get_courses', {userid: 99}], ['moodle_get_course_contents', {courseId: 7, userid: 99}],
  ['moodle_get_profile', {unknown: true}], ['moodle_get_courses', {unknown: true}],
  ['moodle_get_course_contents', {courseId: 7, unknown: true}],
  ['moodle_get_courses', {query: ''}], ['moodle_get_courses', {query: ' '.repeat(4)}],
  ['moodle_get_courses', {query: 'a'.repeat(101)}],
  ['moodle_get_courses', {courseId: 0}], ['moodle_get_courses', {courseId: 1.5}],
  ['moodle_get_course_contents', {}], ['moodle_get_course_contents', {courseId: -1}],
  ['moodle_get_course_contents', {courseId: '7'}],
] as const)('strictly rejects %s input %j without fetch', async (name, input) => {
  const {adapter, mock} = adapterFixture();
  await withClient(adapter, async client => {
    const result = await client.callTool({name, arguments: input});
    expect(result.isError).toBe(true);
    expect(mock).not.toHaveBeenCalled();
  });
});
