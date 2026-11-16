import { expect, it } from 'vitest';
import { adapterFixture, contents, enrolledCourses, siteInfo } from '../fixtures/moodle.js';

it('uses only site_info own userid, caches only that ID across profile and repeated course calls', async () => {
  const {adapter, requests, logs} = adapterFixture();
  expect(await adapter.getProfile()).toEqual({id: 42, fullname: 'Fixture Student', username: 'fixture.student',
    email: 'student@example.invalid', profileUrl: 'https://example.invalid/moodle/user/profile.php?id=42'});
  const courses = await adapter.getCourses();
  await adapter.getCourses();
  expect(requests().map(request => request.wsfunction)).toEqual([
    'core_webservice_get_site_info', 'core_user_get_users_by_field',
    'core_enrol_get_users_courses', 'core_enrol_get_users_courses',
  ]);
  expect(requests()[1]).toMatchObject({field: 'id', 'values[0]': '42'});
  expect(requests().slice(2).every(request => request.userid === '42')).toBe(true);
  expect(courses[0]).toEqual({id: 7, shortname: 'SO-A', fullname: 'SISTEMAS OPERATIVOS',
    summary: 'Curso & prácticas', category: 2, startDate: '2024-01-01T00:00:00.000Z', endDate: null,
    visible: true, progress: 25.5, lastAccess: null, url: 'https://example.invalid/moodle/course/view.php?id=7'});
  expect(courses[2]).toEqual({id: 9, shortname: 'RÉDES', fullname: 'Comunicaciones', summary: null,
    startDate: null, endDate: null, visible: null, url: 'https://example.invalid/moodle/course/view.php?id=9'});
  for (const line of logs) {
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(['durationMs', 'function', 'hostname', 'level', 'outcome', 'pid', 'time'].sort());
    for (const secret of ['fixture-token', 'Fixture Student', 'student@example.invalid', 'SISTEMAS OPERATIVOS', 'userid']) {
      expect(line).not.toContain(secret);
    }
  }
});
it('coalesces simultaneous identity requests and never caches a full profile/course list', async () => {
  const {adapter, requests, responses} = adapterFixture();
  await Promise.all([adapter.getProfile(), adapter.getCourses()]);
  expect(requests().filter(request => request.wsfunction === 'core_webservice_get_site_info')).toHaveLength(1);
  responses.core_enrol_get_users_courses = [];
  expect(await adapter.getCourses()).toEqual([]);
  await adapter.getProfile();
  expect(requests().filter(request => request.wsfunction === 'core_webservice_get_site_info')).toHaveLength(2);
});
it.each([{response: []}, {response: [{id: 42}]}, {response: [{id: 42, email: null}]}])('omits email when lookup has no accessible email: %j', async ({response}) => {
  const {adapter} = adapterFixture({core_user_get_users_by_field: response});
  expect(await adapter.getProfile()).not.toHaveProperty('email');
});
it('omits missing username and validates identity did not change for a fixed token', async () => {
  const {adapter, responses} = adapterFixture({core_webservice_get_site_info: {...siteInfo, username: undefined}});
  expect(await adapter.getProfile()).not.toHaveProperty('username');
  responses.core_webservice_get_site_info = {...siteInfo, userid: 43};
  await expect(adapter.getProfile()).rejects.toMatchObject({code: 'OPERATION_FAILED'});
});
it.each([undefined, 0, '42'])('rejects invalid/missing own userid %s before any user/course request', async userid => {
  const {adapter, requests} = adapterFixture({core_webservice_get_site_info: {...siteInfo, userid}});
  await expect(adapter.getCourses()).rejects.toMatchObject({code: 'OPERATION_FAILED'});
  expect(requests().map(request => request.wsfunction)).toEqual(['core_webservice_get_site_info']);
});
it.each([
  ['core_user_get_users_by_field', [{id: 99, email: 'other@example.invalid'}], 'profile'],
  ['core_user_get_users_by_field', [{id: 42}, {id: 99}], 'profile'],
  ['core_user_get_users_by_field', [{id: 42, email: 7}], 'profile'],
  ['core_enrol_get_users_courses', [{...enrolledCourses[0], id: '7'}], 'courses'],
  ['core_enrol_get_users_courses', [{...enrolledCourses[0], fullname: null}], 'courses'],
  ['core_enrol_get_users_courses', {courses: []}, 'courses'],
  ['core_course_get_contents', [{...contents[0], modules: [{id: 1, name: 'Missing type'}]}], 'contents'],
  ['core_course_get_contents', [{...contents[0], modules: undefined}], 'contents'],
] as const)('rejects malformed %s response (%s)', async (fn, response, operation) => {
  const {adapter} = adapterFixture({[fn]: response});
  const call = operation === 'profile' ? adapter.getProfile() : operation === 'courses' ? adapter.getCourses() : adapter.getCourseContents(7);
  await expect(call).rejects.toMatchObject({code: 'OPERATION_FAILED'});
});
it('maps sections/modules/files but never returns file URLs or raw response extras', async () => {
  const {adapter, requests} = adapterFixture();
  const sections = await adapter.getCourseContents(7);
  expect(sections).toEqual([{id: 70, number: 0, name: 'General', summary: 'Introducción al curso', visible: true,
    modules: [{id: 71, name: 'Material', type: 'resource', visible: true,
      url: 'https://example.invalid/moodle/mod/resource/view.php?id=71', availability: 'Disponible > lunes',
      files: [{filename: 'notes.pdf', size: 100, mimeType: 'application/pdf', modifiedAt: '2024-01-01T00:00:00.000Z'}]},
    {id: 72, name: 'Label', type: 'label', visible: null}]}]);
  expect(requests()[0]).toMatchObject({courseid: '7'});
  expect(JSON.stringify(sections)).not.toMatch(/fileurl|pluginfile|private-notes|private-external|fixture-token/);
});
it.each([
  'https://example.invalid/pluginfile.php/notes.pdf',
  'https://example.invalid/notes.pdf',
  'https://example.invalid/mod/resource/view.php?id=71&wstoken=fixture-token',
  'javascript:alert(1)',
])('omits module URLs that are not safe activity pages: %s', async url => {
  const response = [{...contents[0], modules: [{...contents[0].modules[0], url}]}];
  const {adapter} = adapterFixture({core_course_get_contents: response});
  expect((await adapter.getCourseContents(7))[0].modules[0]).not.toHaveProperty('url');
});
it('keeps permission errors from optional email lookup rather than silently treating failure as success', async () => {
  const {adapter} = adapterFixture({core_user_get_users_by_field: {exception: 'moodle_exception', errorcode: 'nopermissions', message: 'private'}});
  await expect(adapter.getProfile()).rejects.toMatchObject({code: 'PERMISSION_DENIED'});
});
it('returns null for absent file metadata and omits absent module optional fields', async () => {
  const {adapter} = adapterFixture({core_course_get_contents: [{id: 1, name: 'Section',
    modules: [{id: 2, name: 'File', modname: 'resource', contents: [{type: 'file', filename: 'minimal.txt'}]}]}]});
  expect(await adapter.getCourseContents(7)).toEqual([{id: 1, number: null, name: 'Section', summary: null, visible: null,
    modules: [{id: 2, name: 'File', type: 'resource', visible: null,
      files: [{filename: 'minimal.txt', size: null, mimeType: null, modifiedAt: null}]}]}]);
});
it('does not persist failed identity loads', async () => {
  const {adapter, responses, requests} = adapterFixture({core_webservice_get_site_info: {errorcode: 'invalidtoken'}});
  await expect(adapter.getCourses()).rejects.toMatchObject({code: 'SESSION_EXPIRED'});
  responses.core_webservice_get_site_info = siteInfo;
  expect(await adapter.getCourses()).toHaveLength(3);
  expect(requests().filter(request => request.wsfunction === 'core_webservice_get_site_info')).toHaveLength(2);
});
