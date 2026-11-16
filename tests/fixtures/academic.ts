import { adapterFixture } from './moodle.js';

export const NOW = Date.parse('2026-11-16T12:00:00Z');
export const SECOND = NOW / 1000;
export const day = 86400;
export const assignmentResponse = {courses: [
  {id: 7, assignments: [
    {id: 101, cmid: 1001, name: 'Past task', duedate: SECOND - day, cutoffdate: SECOND + day,
      allowsubmissionsfromdate: SECOND - 2 * day, intro: '<p>' + 'x'.repeat(5000) + '</p>'},
    {id: 102, cmid: 1002, name: 'Future task', duedate: SECOND + day, intro: '<p>Future &amp; work</p>'},
    {id: 103, cmid: 1003, name: 'No due', duedate: 0},
  ]}, {id: 8, assignments: [{id: 104, cmid: 1004, name: 'Other enrolled task', duedate: SECOND + 2 * day}]},
  {id: 99, assignments: [{id: 999, cmid: 9999, name: 'Not enrolled', duedate: SECOND}]},
], warnings: [{message: 'PRIVATE_WARNING'}]};
export const submissionResponse = {
  lastattempt: {submission: {status: 'new', timemodified: SECOND - day}, gradingstatus: 'notgraded'},
  feedback: {grade: {grade: '87.5', timemodified: SECOND}, gradefordisplay: '<b>87.50</b>', gradeddate: SECOND},
};
export const gradeItemDefaults = {itemname: 'Fixture grade', itemtype: 'mod', itemmodule: null,
  graderaw: null, gradeformatted: '-', grademin: 0, grademax: 100, percentageformatted: '-',
  feedback: '', gradedategraded: null, gradeishidden: false};
export const gradeItemsResponse = {usergrades: [{userid: 42, courseid: 7, gradeitems: [
  {...gradeItemDefaults, itemname: 'Exercise', itemtype: 'mod', itemmodule: 'assign', graderaw: 87.5, gradeformatted: '<b>87.50</b>',
    grademin: 0, grademax: 100, percentageformatted: '87.50 %', feedback: '<p>Good &amp; clear</p>', gradedategraded: SECOND},
  {...gradeItemDefaults, itemname: 'Ungraded', itemtype: 'mod', itemmodule: 'quiz', graderaw: null, gradeformatted: '-', gradedategraded: null},
  {...gradeItemDefaults, itemname: null, itemtype: 'course', graderaw: 87.5, gradeformatted: '87.50'},
]}], warnings: [{message: 'PRIVATE_WARNING'}]};
export const calendarResponse = {events: [
  {id: 1, name: 'Course event', description: '<p>Calendar &amp; info</p>', eventtype: 'course', courseid: 7,
    timestart: SECOND + day, timeduration: 3600, modulename: 'assign', url: 'https://example.invalid/moodle/mod/assign/view.php?id=1002'},
  {id: 2, name: 'User event', eventtype: 'user', courseid: 0, timestart: SECOND + 2 * day, timeduration: 0},
  {id: 3, name: 'Site event', eventtype: 'site', courseid: 1, timestart: SECOND + 3 * day},
  {id: 4, name: 'Not enrolled', eventtype: 'course', courseid: 99, timestart: SECOND + day},
], warnings: []};
export const discussionResponse = {discussions: [
  {discussion: 701, name: 'New announcement', userfullname: 'Fixture Teacher', created: SECOND - day,
    timemodified: SECOND - 100, message: '<p>' + 'a'.repeat(3000) + '</p>', pinned: 1,
    attachment: 'https://example.invalid/pluginfile.php/PRIVATE_FILE'},
  {discussion: 702, name: 'Older announcement', created: SECOND - 2 * day, modified: SECOND - day, message: '<b>Hello</b>', pinned: 0},
], warnings: [{message: 'PRIVATE_WARNING'}]};

export function academicFixture(overrides: Record<string, unknown> = {}) {
  return adapterFixture({
    mod_assign_get_assignments: assignmentResponse,
    mod_assign_get_submission_status: submissionResponse,
    core_calendar_get_action_events_by_timesort: {events: [
      {id: 11, name: 'Pending past', timesort: SECOND - day, course: {id: 7}, modulename: 'assign', action: {actionable: true},
        url: 'https://example.invalid/moodle/mod/assign/view.php?id=1001'},
      {id: 12, name: 'Pending future', timesort: SECOND + day, courseid: 8, action: {actionable: false},
        url: 'https://example.invalid/pluginfile.php/PRIVATE_FILE'},
      {id: 13, name: 'Not enrolled', timesort: SECOND + day, courseid: 99},
    ]},
    core_calendar_get_calendar_events: calendarResponse,
    gradereport_overview_get_course_grades: {grades: [
      {courseid: 7, grade: '87.50', rawgrade: '87.5'}, {courseid: 8, grade: '-', rawgrade: null},
      {courseid: 99, grade: 'PRIVATE_GRADE', rawgrade: 100},
    ]},
    gradereport_user_get_grade_items: gradeItemsResponse,
    mod_forum_get_forums_by_courses: [
      {id: 70, course: 7, type: 'news'}, {id: 80, course: 8, type: 'general'},
      {id: 90, course: 8, type: 'news'}, {id: 99, course: 99, type: 'news'},
    ],
    mod_forum_get_forum_discussions: discussionResponse,
    ...overrides,
  });
}
