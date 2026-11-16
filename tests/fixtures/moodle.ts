import { vi } from 'vitest';
import { createLogger } from '../../src/infrastructure/logging/logger.js';
import { RestClient } from '../../src/infrastructure/moodle/rest-client.js';
import { RestAdapter } from '../../src/infrastructure/moodle/rest-adapter.js';

export const siteInfo = {
  userid: 42, username: 'fixture.student', fullname: 'Fixture Student',
  userpictureurl: 'https://example.invalid/pluginfile.php/private-picture',
  release: '4.1.1+', version: '2022112801.02', sitename: 'Fixture Moodle', lang: 'es_mx',
};
export const enrolledCourses = [
  {id: 7, shortname: 'SO-A', fullname: 'SISTEMAS OPERATIVOS', summary: '<p>Curso &amp; prácticas</p>',
    category: 2, startdate: 1704067200, enddate: 0, visible: 1, progress: 25.5, lastaccess: 0},
  {id: 8, shortname: 'SO-B', fullname: 'Sistemas Operatívos', summary: '', visible: false},
  {id: 9, shortname: 'RÉDES', fullname: 'Comunicaciones'},
];
export const contents = [{
  id: 70, section: 0, name: 'General', summary: '<p>Introducción&nbsp;al curso</p>', visible: 1,
  modules: [{id: 71, name: 'Material', modname: 'resource', visible: 1,
    url: 'https://example.invalid/moodle/mod/resource/view.php?id=71',
    availabilityinfo: '<p>Disponible &gt; lunes</p>',
    contents: [{type: 'file', filename: 'notes.pdf', filesize: 100, mimetype: 'application/pdf',
      timemodified: 1704067200, fileurl: 'https://example.invalid/pluginfile.php/private-notes.pdf?token=fixture-token'},
    {type: 'url', filename: 'external', fileurl: 'https://example.invalid/private-external'}]},
  {id: 72, name: 'Label', modname: 'label'}],
}];

export function adapterFixture(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    core_webservice_get_site_info: siteInfo,
    core_user_get_users_by_field: [{id: 42, email: 'student@example.invalid', password: 'private-extra'}],
    core_enrol_get_users_courses: enrolledCourses,
    core_course_get_contents: contents,
    ...overrides,
  };
  const logs: string[] = [];
  const mock = vi.fn<typeof fetch>(async (_url, options) => {
    const name = (options!.body as URLSearchParams).get('wsfunction')!;
    if (!(name in responses)) throw new Error('Unexpected function');
    return new Response(JSON.stringify(responses[name]));
  });
  const client = new RestClient({baseUrl: 'https://example.invalid/moodle/', token: 'fixture-token',
    logger: createLogger('info', {write: line => { logs.push(line); }}), fetch: mock});
  const requests = () => mock.mock.calls.map(([, options]) => Object.fromEntries(options!.body as URLSearchParams));
  return {adapter: new RestAdapter(client), mock, logs, requests, responses};
}
