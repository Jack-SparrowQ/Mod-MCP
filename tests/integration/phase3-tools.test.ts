import { beforeEach, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp/server.js';
import { academicFixture, NOW, SECOND, day, submissionResponse, assignmentResponse, calendarResponse } from '../fixtures/academic.js';

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
async function session(run: (client: Client, fixture: ReturnType<typeof academicFixture>) => Promise<void>, overrides: Record<string, unknown> = {}) {
  const fixture = academicFixture(overrides);
  const server = createServer(fixture.adapter);
  const client = new Client({name: 'phase3-offline', version: '1'});
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try { await server.connect(st); await client.connect(ct); await run(client, fixture); }
  finally { await client.close(); await server.close(); }
}
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({name, arguments: args});
  expect(result.content).toEqual([{type: 'text', text: JSON.stringify(result.structuredContent)}]);
  return result;
}

it('assignment list is date-only, sorted, bounded, intro-free and makes no per-item status calls', async () => {
  await session(async (client, {requests}) => {
    const result = await call(client, 'moodle_get_assignments');
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({count: 4, truncated: false, assignments: [
      {id: 102, dueState: 'upcoming'}, {id: 104, dueState: 'upcoming'},
      {id: 101, dueState: 'past_due'}, {id: 103, dueState: 'no_due_date'},
    ]});
    expect(JSON.stringify(result)).not.toMatch(/description|intro|Not enrolled|PRIVATE_WARNING/);
    const limited = await call(client, 'moodle_get_assignments', {limit: 1});
    expect(limited.structuredContent).toMatchObject({count: 1, truncated: true});
    expect(requests().filter(request => request.wsfunction === 'mod_assign_get_submission_status')).toHaveLength(0);
    const params = requests().find(request => request.wsfunction === 'mod_assign_get_assignments')!;
    expect(params).toMatchObject({'courseids[0]': '7', 'courseids[1]': '8', 'courseids[2]': '9'});
  });
});
it('filters assignments by enrolled course and explicit ISO due bounds', async () => {
  await session(async client => {
    const result = await call(client, 'moodle_get_assignments', {courseId: 7,
      dueAfter: '2026-11-16T00:00:00+00:00', dueBefore: '2026-11-18T00:00:00Z'});
    expect(result.structuredContent).toMatchObject({count: 1, assignments: [{id: 102}]});
  });
});
it.each([
  ['new', 101, true], ['submitted', 101, false], ['new', 103, false],
  ['draft', 101, true], ['reopened', 101, true], ['unexpected', 101, true],
] as const)('assignment %s id %s overdue=%s, independent of cutoff', async (status, id, overdue) => {
  await session(async (client, {requests}) => {
    const result = await call(client, 'moodle_get_assignment', {assignmentId: id});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({assignment: {id,
      submission: {status: status === 'unexpected' ? 'unknown' : status, overdue},
      grade: {grade: '87.50', rawGrade: 87.5, gradedAt: '2026-11-16T12:00:00.000Z'},
    }});
    const assignment = result.structuredContent!.assignment as {description: string | null};
    if (id === 101) expect(Array.from(assignment.description!)).toHaveLength(4000);
    expect(requests().find(request => request.wsfunction === 'mod_assign_get_submission_status')).toEqual({
      wstoken: 'fixture-token', wsfunction: 'mod_assign_get_submission_status', moodlewsrestformat: 'json', assignid: String(id),
    });
  }, {mod_assign_get_submission_status: {...submissionResponse,
    lastattempt: {...submissionResponse.lastattempt, submission: {status, timemodified: SECOND}}}});
});
it('does not call submission status for an assignment outside enrolled courses', async () => {
  await session(async (client, {requests}) => {
    const result = await call(client, 'moodle_get_assignment', {assignmentId: 999});
    expect(result.structuredContent).toMatchObject({error: {code: 'RESOURCE_NOT_FOUND'}});
    expect(requests().some(request => request.wsfunction === 'mod_assign_get_submission_status')).toBe(false);
  });
});
it('missing submission data is unknown; missing due date never becomes overdue', async () => {
  await session(async client => {
    const result = await call(client, 'moodle_get_assignment', {assignmentId: 103});
    expect(result.structuredContent).toMatchObject({assignment: {dueDate: null,
      submission: {status: 'unknown', gradingStatus: null, lastModified: null, overdue: false}}});
    expect(result.structuredContent!.assignment).not.toHaveProperty('grade');
  }, {mod_assign_get_submission_status: {}});
});
it('deadlines are pending action events, bounded with overdue window and safe activity links', async () => {
  await session(async (client, {requests}) => {
    const result = await call(client, 'moodle_get_upcoming_deadlines');
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({count: 2, truncated: false, deadlines: [
      {name: 'Pending past', overdue: true, actionable: true}, {name: 'Pending future', overdue: false, actionable: false},
    ]});
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_FILE|Not enrolled|pluginfile/);
    expect(requests().find(request => request.wsfunction === 'core_calendar_get_action_events_by_timesort'))
      .toMatchObject({timesortfrom: String(SECOND - 30 * day), timesortto: String(SECOND + 14 * day), limitnum: '50'});
    const noOverdue = await call(client, 'moodle_get_upcoming_deadlines', {days: 2, includeOverdue: false});
    expect(noOverdue.structuredContent).toMatchObject({count: 1, deadlines: [{name: 'Pending future'}]});
  });
});
it('calendar includes course/user/site events, sends nested form options and filters by enrolled course', async () => {
  await session(async (client, {requests}) => {
    const result = await call(client, 'moodle_get_calendar_events');
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({count: 3, truncated: false, events: [
      {id: 1, description: 'Calendar & info', start: '2026-11-17T12:00:00.000Z'}, {id: 2}, {id: 3},
    ]});
    expect(requests().find(request => request.wsfunction === 'core_calendar_get_calendar_events')).toMatchObject({
      'events[courseids][0]': '7', 'options[timestart]': String(SECOND),
      'options[timeend]': String(SECOND + 7 * day), 'options[userevents]': '1', 'options[siteevents]': '1',
    });
    const course = await call(client, 'moodle_get_calendar_events', {courseId: 7});
    expect(course.structuredContent).toMatchObject({count: 1, events: [{id: 1}]});
  });
});
it('calendar caps output at 200 and marks truncation', async () => {
  await session(async client => {
    const result = await call(client, 'moodle_get_calendar_events');
    expect(result.structuredContent).toMatchObject({count: 200, truncated: true});
  }, {core_calendar_get_calendar_events: {events: Array.from({length: 201}, (_, i) => ({...calendarResponse.events[0], id: i + 1}))}});
});
it('grade overview sends no userid; item grades send only own userid and distinguish ungraded/course total', async () => {
  await session(async (client, {requests}) => {
    const overview = await call(client, 'moodle_get_grades');
    expect(overview.isError).toBe(false);
    expect(overview.structuredContent).toEqual({grades: [
      {courseId: 7, courseName: 'SISTEMAS OPERATIVOS', grade: '87.50', rawGrade: 87.5},
      {courseId: 8, courseName: 'Sistemas Operatívos', grade: null, rawGrade: null},
    ], count: 2, truncated: false});
    expect(requests().find(request => request.wsfunction === 'gradereport_overview_get_course_grades')).not.toHaveProperty('userid');
    const detail = await call(client, 'moodle_get_grades', {courseId: 7});
    expect(detail.structuredContent).toMatchObject({course: {id: 7}, count: 2, truncated: false, items: [
      {name: 'Exercise', grade: '87.50', rawGrade: 87.5, graded: true, feedback: 'Good & clear'},
      {name: 'Ungraded', grade: null, rawGrade: null, graded: false, gradedAt: null},
    ], courseTotal: {name: 'Course total', graded: true, grade: '87.50'}});
    expect(requests().find(request => request.wsfunction === 'gradereport_user_get_grade_items')).toMatchObject({courseid: '7', userid: '42'});
  });
});
it('announcements use news forums only, deduplicate, bound messages and fan out sequentially', async () => {
  await session(async (client, {requests, logs}) => {
    const result = await call(client, 'moodle_get_announcements', {limit: 1});
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({count: 1, announcements: [{id: 701, subject: 'New announcement',
      author: 'Fixture Teacher', pinned: true, url: 'https://example.invalid/moodle/mod/forum/discuss.php?d=701'}]});
    const announcements = result.structuredContent!.announcements as {message: string}[];
    expect(Array.from(announcements[0].message)).toHaveLength(2000);
    expect(requests().filter(request => request.wsfunction === 'mod_forum_get_forum_discussions').map(request => request.forumid)).toEqual(['70', '90']);
    expect(requests().filter(request => request.wsfunction === 'mod_forum_get_forum_discussions').every(request =>
      request.sortorder === '-1' && request.page === '0' && request.perpage === '1')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_WARNING|PRIVATE_FILE|attachment/);
    for (const line of logs) expect(line).not.toMatch(/fixture-token|Fixture Teacher|SISTEMAS OPERATIVOS|userid|forumid|PRIVATE/);
  });
});
it.each([
  ['moodle_get_assignments', 'mod_assign_get_assignments'],
  ['moodle_get_calendar_events', 'core_calendar_get_calendar_events'],
  ['moodle_get_grades', 'gradereport_user_get_grade_items'],
  ['moodle_get_announcements', 'mod_forum_get_forums_by_courses'],
])('%s rejects a non-enrolled course with zero %s calls', async (name, fn) => {
  await session(async (client, {requests}) => {
    const result = await call(client, name, {courseId: 999});
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({error: {code: 'RESOURCE_NOT_FOUND'}});
    expect(requests().some(request => request.wsfunction === fn)).toBe(false);
  });
});
it.each([
  ['moodle_get_assignments', {dueAfter: 'invalid'}],
  ['moodle_get_assignments', {dueAfter: '2026-11-17T00:00:00Z', dueBefore: '2026-11-16T00:00:00Z'}],
  ['moodle_get_calendar_events', {from: '2026-02-30T00:00:00Z'}],
  ['moodle_get_calendar_events', {from: '2026-11-17T00:00:00Z', to: '2026-11-16T00:00:00Z'}],
  ['moodle_get_calendar_events', {from: '2026-01-01T00:00:00Z', to: '2026-05-01T00:00:00Z'}],
  ['moodle_get_calendar_events', {from: '2026-11-16T00:00:00'}],
] as const)('%s invalid dates return VALIDATION_ERROR before fetch', async (name, input) => {
  await session(async (client, {mock}) => {
    const result = await call(client, name, input);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({error: {code: 'VALIDATION_ERROR'}});
    expect(mock).not.toHaveBeenCalled();
  });
});
it.each([
  ['moodle_get_assignments', {}], ['moodle_get_assignment', {assignmentId: 101}],
  ['moodle_get_upcoming_deadlines', {}], ['moodle_get_calendar_events', {}],
  ['moodle_get_grades', {}], ['moodle_get_announcements', {}],
] as const)('%s rejects userid or unknown input without fetch', async (name, input) => {
  await session(async (client, {mock}) => {
    for (const extra of [{userid: 99}, {userId: 99}, {unknown: true}]) {
      const result = await client.callTool({name, arguments: {...input, ...extra}});
      expect(result.isError).toBe(true);
    }
    expect(mock).not.toHaveBeenCalled();
  });
});
it.each([
  ['moodle_get_assignments', {limit: 201}], ['moodle_get_assignments', {limit: 0}],
  ['moodle_get_announcements', {limit: 51}], ['moodle_get_upcoming_deadlines', {days: 61}],
  ['moodle_get_upcoming_deadlines', {days: 0}], ['moodle_get_assignment', {assignmentId: 0}],
] as const)('%s rejects out-of-range inputs without fetch', async (name, input) => {
  await session(async (client, {mock}) => {
    expect((await client.callTool({name, arguments: input})).isError).toBe(true);
    expect(mock).not.toHaveBeenCalled();
  });
});
