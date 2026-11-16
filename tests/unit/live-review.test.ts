import { expect, it } from 'vitest';
import { academicFixture, assignmentResponse, gradeItemDefaults, NOW, SECOND, day } from '../fixtures/academic.js';
import { getUpcomingDeadlines } from '../../src/application/get-upcoming-deadlines.js';
import { getAssignments } from '../../src/application/get-assignments.js';

it('maps a real-shaped null-name course total and preserves null ordinary-item names', async () => {
  const {adapter} = academicFixture({gradereport_user_get_grade_items: {usergrades: [{userid: 42, courseid: 7, gradeitems: [
    {...gradeItemDefaults, itemname: null, itemtype: 'course', graderaw: 87.5, gradeformatted: '87.50'},
    {...gradeItemDefaults, itemname: null, itemtype: 'mod'},
    {...gradeItemDefaults, itemname: 'Named total', itemtype: 'course'},
  ]}]}});
  const items = await adapter.getGradeItems((await adapter.getCourses())[0]);
  expect(items.map(item => item.name)).toEqual(['Course total', null, 'Named total']);
  expect(items[0]).toMatchObject({rawGrade: 87.5, grade: '87.50', graded: true});
});
it.each([
  ['itemname', 42], ['itemname', undefined], ['itemmodule', false], ['itemmodule', undefined],
  ['graderaw', '87.5'], ['gradedategraded', '123'], ['gradedategraded', -1],
  ['gradeformatted', 17], ['percentageformatted', 17], ['feedback', 17],
  ['grademin', '0'], ['grademax', '100'], ['gradeishidden', 0],
] as const)('rejects unexpected grade-item type %s=%s', async (key, value) => {
  const {adapter} = academicFixture({gradereport_user_get_grade_items: {usergrades: [{userid: 42,
    gradeitems: [{...gradeItemDefaults, [key]: value}],
  }]}});
  await expect(adapter.getGradeItems((await adapter.getCourses())[0])).rejects.toMatchObject({code: 'OPERATION_FAILED'});
});

function pagedFixture(total: number, filterLastOfFirstPage = false) {
  const fixture = academicFixture();
  const events = Array.from({length: total}, (_, i) => ({id: 1000 + i * 3,
    name: `Pending ${i}`, timesort: SECOND + i + 1, courseid: filterLastOfFirstPage && i === 49 ? 99 : 7}));
  const original = fixture.mock.getMockImplementation()!;
  fixture.mock.mockImplementation(async (url, options) => {
    const params = options!.body as URLSearchParams;
    if (params.get('wsfunction') !== 'core_calendar_get_action_events_by_timesort') return original(url, options);
    expect(params.get('limitnum')).toBe('50');
    const after = params.get('aftereventid');
    const offset = after === null ? 0 : events.findIndex(event => event.id === Number(after)) + 1;
    expect(offset).toBeGreaterThanOrEqual(0);
    return new Response(JSON.stringify({events: events.slice(offset, offset + 50)}));
  });
  return fixture;
}
it.each([
  [0, 1, false], [49, 1, false], [50, 2, false], [55, 2, false],
  [150, 4, false], [199, 4, false], [200, 4, true], [201, 4, true],
] as const)('paginates %s action events in %s calls; truncated=%s', async (total, expectedCalls, truncated) => {
  const fixture = pagedFixture(total);
  const result = await getUpcomingDeadlines(fixture.adapter, {}, NOW);
  expect(result.count).toBe(Math.min(total, 200));
  expect(result.truncated).toBe(truncated);
  const requests = fixture.requests().filter(request => request.wsfunction === 'core_calendar_get_action_events_by_timesort');
  expect(requests).toHaveLength(expectedCalls);
  expect(requests[0]).not.toHaveProperty('aftereventid');
  for (let page = 0; page < requests.length; page++) {
    expect(requests[page]).toMatchObject({limitnum: '50', timesortfrom: String(SECOND - 30 * day), timesortto: String(SECOND + 14 * day)});
    if (page > 0) expect(requests[page].aftereventid).toBe(String(1000 + (page * 50 - 1) * 3));
  }
});
it('uses the last raw event cursor even when that event is excluded by course filtering', async () => {
  const fixture = pagedFixture(55, true);
  expect(await getUpcomingDeadlines(fixture.adapter, {}, NOW)).toMatchObject({count: 54, truncated: false});
  const requests = fixture.requests().filter(request => request.wsfunction === 'core_calendar_get_action_events_by_timesort');
  expect(requests[1].aftereventid).toBe(String(1000 + 49 * 3));
});
it('stops a repeated page with a safe failure instead of looping', async () => {
  const fixture = academicFixture({core_calendar_get_action_events_by_timesort: {events:
    Array.from({length: 50}, (_, i) => ({id: i + 1, name: 'Repeated', timesort: SECOND, courseid: 7})),
  }});
  await expect(getUpcomingDeadlines(fixture.adapter, {}, NOW)).rejects.toMatchObject({code: 'OPERATION_FAILED'});
  expect(fixture.requests().filter(request => request.wsfunction === 'core_calendar_get_action_events_by_timesort')).toHaveLength(2);
});
it('orders upcoming ascending including now, then recent past descending, then no-due; limits after sorting', async () => {
  const dueDates = [0, SECOND - 5 * day, SECOND + 3 * day, SECOND - day, SECOND, SECOND + day, undefined];
  const fixture = academicFixture({mod_assign_get_assignments: {courses: [{id: 7,
    assignments: dueDates.map((duedate, i) => ({...assignmentResponse.courses[0].assignments[0], id: i + 1, duedate})),
  }]}});
  const result = await getAssignments(fixture.adapter, {}, NOW);
  expect(result.assignments.map(assignment => assignment.id)).toEqual([5, 6, 3, 4, 2, 1, 7]);
  expect(result.assignments.map(assignment => assignment.dueState)).toEqual([
    'upcoming', 'upcoming', 'upcoming', 'past_due', 'past_due', 'no_due_date', 'no_due_date',
  ]);
  expect((await getAssignments(fixture.adapter, {limit: 2}, NOW)).assignments.map(assignment => assignment.id)).toEqual([5, 6]);
});
