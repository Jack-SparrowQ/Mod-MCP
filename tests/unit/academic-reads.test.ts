import { expect, it, vi } from 'vitest';
import { academicFixture, assignmentResponse, gradeItemsResponse, gradeItemDefaults, NOW, SECOND } from '../fixtures/academic.js';
import { ALLOWED_FUNCTIONS, RestClient } from '../../src/infrastructure/moodle/rest-client.js';
import { createLogger } from '../../src/infrastructure/logging/logger.js';
import { getAssignments } from '../../src/application/get-assignments.js';
import { getUpcomingDeadlines } from '../../src/application/get-upcoming-deadlines.js';

it.each(['mod_assign_view_assign', 'mod_forum_view_forum', 'mod_assign_submit_for_grading', 'core_grades_update_grades'])
  ('rejects write/view function %s without fetch', async fn => {
    const mock = vi.fn<typeof fetch>();
    const client = new RestClient({baseUrl: 'https://example.invalid/', token: 'fake', logger: createLogger('silent'), fetch: mock});
    await expect(client.call(fn)).rejects.toMatchObject({code: 'INTEGRATION_UNSUPPORTED'});
    expect(mock).not.toHaveBeenCalled();
    expect(ALLOWED_FUNCTIONS).not.toContain(fn);
  });
it.each(['mod_assign_get_submission_status', 'gradereport_overview_get_course_grades'])
  ('refuses any explicit userid on %s, including own ID', async fn => {
    const mock = vi.fn<typeof fetch>();
    const client = new RestClient({baseUrl: 'https://example.invalid/', token: 'fake', logger: createLogger('silent'), fetch: mock});
    await expect(client.call(fn, {userid: 42})).rejects.toMatchObject({code: 'VALIDATION_ERROR'});
    expect(mock).not.toHaveBeenCalled();
  });
it.each([
  {usergrades: [{...gradeItemsResponse.usergrades[0], userid: 99}]},
  {usergrades: [{...gradeItemsResponse.usergrades[0], courseid: 99}]},
  {usergrades: [gradeItemsResponse.usergrades[0], {...gradeItemsResponse.usergrades[0], userid: 99}]},
])('rejects grade records for another user/course or multiple users', async response => {
  const {adapter} = academicFixture({gradereport_user_get_grade_items: response});
  await expect(adapter.getGradeItems((await adapter.getCourses())[0])).rejects.toMatchObject({code: 'OPERATION_FAILED'});
});
it('normalizes ungraded -1 sentinel without losing a genuine zero grade', async () => {
  const {adapter} = academicFixture({gradereport_user_get_grade_items: {usergrades: [{userid: 42, gradeitems: [
    {...gradeItemDefaults, itemname: 'Pending', itemtype: 'mod', graderaw: -1, gradeformatted: '-'},
    {...gradeItemDefaults, itemname: 'Zero', itemtype: 'mod', graderaw: 0, gradeformatted: '0.00'},
  ]}]}});
  const items = await adapter.getGradeItems((await adapter.getCourses())[0]);
  expect(items[0]).toMatchObject({rawGrade: null, grade: null, graded: false});
  expect(items[1]).toMatchObject({rawGrade: 0, grade: '0.00', graded: true});
});
it('preserves a formatted-only assignment feedback grade without inventing a raw grade', async () => {
  const {adapter} = academicFixture({mod_assign_get_submission_status: {feedback: {gradefordisplay: '90.00'}}});
  expect(await adapter.getAssignmentSubmission(101)).toMatchObject({grade: {grade: '90.00', rawGrade: null, gradedAt: null}});
});
it('uses group submission status only when individual submission data is absent', async () => {
  const {adapter} = academicFixture({mod_assign_get_submission_status: {lastattempt: {teamsubmission: {status: 'submitted'}}}});
  expect(await adapter.getAssignmentSubmission(101)).toMatchObject({submission: {status: 'submitted'}});
});
it.each([
  ['mod_assign_get_assignments', {warnings: [{message: 'PRIVATE_WARNING'}]}, 'assignments'],
  ['mod_assign_get_assignments', {courses: [{id: 7, assignments: [{id: 1, name: 'No cmid'}]}]}, 'assignments'],
  ['mod_assign_get_submission_status', {lastattempt: {submission: {status: 99}}}, 'submission'],
  ['core_calendar_get_calendar_events', {warnings: [{message: 'PRIVATE_WARNING'}]}, 'calendar'],
  ['gradereport_user_get_grade_items', {usergrades: [{userid: 42, gradeitems: [{itemname: 'Invalid', itemtype: 'mod', graderaw: 'not numeric'}]}]}, 'grades'],
  ['mod_forum_get_forums_by_courses', {warnings: [{message: 'PRIVATE_WARNING'}]}, 'forums'],
] as const)('rejects malformed/missing %s data with safe OPERATION_FAILED', async (fn, response, operation) => {
  const {adapter, logs} = academicFixture({[fn]: response});
  const courses = await adapter.getCourses();
  const pending = operation === 'assignments' ? adapter.getAssignments(courses)
    : operation === 'submission' ? adapter.getAssignmentSubmission(101)
      : operation === 'calendar' ? adapter.getCalendarEvents(courses, SECOND, SECOND + 100)
        : operation === 'grades' ? adapter.getGradeItems(courses[0]) : adapter.getAnnouncements(courses, 10);
  const error = await pending.catch(error => error);
  expect(error.code).toBe('OPERATION_FAILED');
  expect(`${error.stack}${JSON.stringify(error)}${logs.join('')}`).not.toContain('PRIVATE_WARNING');
});
it('fetches news discussion pages sequentially, tolerates wrapped forum data and prefers explicit subject', async () => {
  const fixture = academicFixture({mod_forum_get_forums_by_courses: {forums: [
    {id: 70, course: 7, type: 'news'}, {id: 90, course: 8, type: 'news'},
  ], warnings: [{message: 'PRIVATE_WARNING'}]}});
  const original = fixture.mock.getMockImplementation()!;
  let active = 0;
  let maximum = 0;
  fixture.mock.mockImplementation(async (url, options) => {
    if ((options!.body as URLSearchParams).get('wsfunction') !== 'mod_forum_get_forum_discussions') return original(url, options);
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return new Response(JSON.stringify({discussions: [{discussion: 1, name: 'Name', subject: 'Explicit subject'}]}));
  });
  const announcements = await fixture.adapter.getAnnouncements(await fixture.adapter.getCourses(), 10);
  expect(announcements.map(item => item.subject)).toEqual(['Explicit subject', 'Explicit subject']);
  expect(maximum).toBe(1);
});
it('bounds a larger assignment list with default 50, maximum 200 and dates at now remain upcoming', async () => {
  const {adapter} = academicFixture({mod_assign_get_assignments: {courses: [{id: 7,
    assignments: Array.from({length: 421}, (_, i) => ({...assignmentResponse.courses[0].assignments[0], id: i + 1, duedate: SECOND})),
  }]}});
  expect(await getAssignments(adapter, {}, NOW)).toMatchObject({count: 50, truncated: true});
  const maximum = await getAssignments(adapter, {limit: 200}, NOW);
  expect(maximum).toMatchObject({count: 200, truncated: true});
  expect(maximum.assignments[0].dueState).toBe('upcoming');
});
it('caps action-event output even if a server ignores limitnum', async () => {
  const {adapter} = academicFixture({core_calendar_get_action_events_by_timesort: {events:
    Array.from({length: 201}, (_, i) => ({id: i + 1, name: 'Pending', timesort: SECOND + 1, courseid: 7})),
  }});
  expect((await getUpcomingDeadlines(adapter, {}, NOW)).count).toBe(200);
});
