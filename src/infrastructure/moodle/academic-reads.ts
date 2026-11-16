import { MoodleError } from '../../domain/errors.js';
import type { Course } from '../../domain/moodle-adapter.js';
import type { Assignment, SubmissionInfo, Deadline, CalendarEvent, CourseGrade, GradeItem, Announcement } from '../../domain/academic.js';
import { htmlToText, unixToIso } from '../../shared/moodle-values.js';
import { activityUrl } from '../../shared/activity-url.js';
import { parseResponse } from './response-schemas.js';
import { assignmentsSchema, submissionSchema, actionSchema, calendarSchema, overviewSchema,
  gradeItemsSchema, forumsSchema, discussionsSchema } from './academic-schemas.js';
import type { RestClient } from './rest-client.js';

function numeric(value: number | string | null | undefined): number | null {
  if (value == null || value === '' || value === '-') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) throw new MoodleError('OPERATION_FAILED');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new MoodleError('OPERATION_FAILED');
  return number;
}
function rawGrade(value: number | string | null | undefined): number | null {
  const number = numeric(value);
  return number === -1 ? null : number;
}

export class AcademicReads {
  constructor(private readonly client: RestClient, private readonly ownId: () => Promise<number>) {}
  private text(value: string | null | undefined, length = 500): string | null {
    return value == null ? null : htmlToText(this.client.redact(value), length);
  }
  private url(value: string | null | undefined): string | undefined {
    const url = activityUrl(value);
    return url ? this.client.redact(url) : undefined;
  }

  async getAssignments(courses: Course[]): Promise<Assignment[]> {
    if (!courses.length) return [];
    const response = parseResponse(assignmentsSchema, await this.client.call('mod_assign_get_assignments', {
      courseids: courses.map(course => course.id),
    }));
    return response.courses.flatMap(group => {
      const course = courses.find(course => course.id === group.id);
      if (!course) return [];
      return group.assignments.map(assignment => ({
        id: assignment.id, cmid: assignment.cmid, courseId: course.id, courseName: course.fullname,
        name: this.client.redact(assignment.name), dueDate: unixToIso(assignment.duedate),
        cutoffDate: unixToIso(assignment.cutoffdate), allowSubmissionsFrom: unixToIso(assignment.allowsubmissionsfromdate),
        description: this.text(assignment.intro, 4000),
        url: this.client.siteUrl('mod/assign/view.php', {id: String(assignment.cmid)}),
      }));
    });
  }

  async getAssignmentSubmission(assignmentId: number) {
    const data = parseResponse(submissionSchema, await this.client.call('mod_assign_get_submission_status', {assignid: assignmentId}));
    const attempt = data.lastattempt;
    const submitted = attempt?.submission ?? attempt?.teamsubmission;
    const state = submitted?.status;
    const status: SubmissionInfo['status'] = state === 'submitted' || state === 'draft' || state === 'new' || state === 'reopened'
      ? state : 'unknown';
    const submission: SubmissionInfo = {status, gradingStatus: this.text(attempt?.gradingstatus), lastModified: unixToIso(submitted?.timemodified)};
    if (!data.feedback) return {submission};
    const raw = rawGrade(data.feedback.grade?.grade);
    const formatted = this.text(data.feedback.gradefordisplay);
    return {submission, grade: {
      grade: raw !== null ? formatted ?? String(raw)
        : data.feedback.grade?.grade == null && formatted && !/^[-–\s]*$/.test(formatted) ? formatted : null,
      rawGrade: raw,
      gradedAt: unixToIso(data.feedback.gradeddate ?? data.feedback.grade?.timemodified),
    }};
  }

  async getActionEvents(courses: Course[], from: number, to: number, limit: number): Promise<{events: Deadline[]; truncated: boolean}> {
    const maximum = Math.min(limit, 200);
    const collected: ReturnType<typeof actionSchema.parse>['events'] = [];
    const seen = new Set<number>();
    let aftereventid: number | undefined;
    let truncated = false;
    while (collected.length < maximum) {
      const data = parseResponse(actionSchema, await this.client.call('core_calendar_get_action_events_by_timesort', {
        timesortfrom: from, timesortto: to, limitnum: 50,
        ...(aftereventid === undefined ? {} : {aftereventid}),
      }));
      // A repeated cursor/page is a malformed response, never a reason to retry forever.
      if (data.events.some(event => seen.has(event.id))) throw new MoodleError('OPERATION_FAILED');
      for (const event of data.events) seen.add(event.id);
      const remaining = maximum - collected.length;
      collected.push(...data.events.slice(0, remaining));
      if (collected.length === maximum) {
        truncated = data.events.length > remaining || data.events.length >= 50;
        break;
      }
      if (data.events.length < 50) break;
      aftereventid = data.events[data.events.length - 1].id;
    }
    const events = collected.flatMap(event => {
      const id = event.course?.id ?? event.courseid;
      const course = courses.find(course => course.id === id);
      if (id && !course) return [];
      const url = this.url(event.url);
      return [{name: this.client.redact(event.name), courseId: course?.id ?? null,
        courseName: course?.fullname ?? null, dueDate: unixToIso(event.timesort),
        ...(event.modulename ? {moduleType: this.client.redact(event.modulename)} : {}),
        ...(url ? {url} : {}),
        ...(event.action?.actionable != null ? {actionable: Boolean(event.action.actionable)} : {}),
      }];
    });
    return {events, truncated};
  }

  async getCalendarEvents(courses: Course[], from: number, to: number): Promise<CalendarEvent[]> {
    const data = parseResponse(calendarSchema, await this.client.call('core_calendar_get_calendar_events', {
      events: {courseids: courses.map(course => course.id)},
      options: {timestart: from, timeend: to, userevents: true, siteevents: true},
    }));
    return data.events.flatMap(event => {
      const id = event.courseid;
      const globalEvent = event.eventtype === 'site' || event.eventtype === 'user';
      if (id && !globalEvent && !courses.some(course => course.id === id)) return [];
      const url = this.url(event.url);
      return [{id: event.id, name: this.client.redact(event.name), description: this.text(event.description),
        type: this.client.redact(event.eventtype), start: unixToIso(event.timestart), durationSeconds: event.timeduration ?? null,
        ...(id && !globalEvent ? {courseId: id} : {}),
        ...(event.modulename ? {moduleType: this.client.redact(event.modulename)} : {}), ...(url ? {url} : {}),
      }];
    });
  }

  async getGradeOverview(courses: Course[]): Promise<CourseGrade[]> {
    const data = parseResponse(overviewSchema, await this.client.call('gradereport_overview_get_course_grades'));
    return data.grades.flatMap(grade => {
      const course = courses.find(course => course.id === grade.courseid);
      if (!course) return [];
      const raw = rawGrade(grade.rawgrade);
      return [{courseId: course.id, courseName: course.fullname, grade: raw === null ? null : this.text(grade.grade), rawGrade: raw}];
    });
  }

  async getGradeItems(course: Course): Promise<GradeItem[]> {
    const userid = await this.ownId();
    const data = parseResponse(gradeItemsSchema, await this.client.call('gradereport_user_get_grade_items', {courseid: course.id, userid}));
    if (data.usergrades.length > 1 || data.usergrades.some(user => user.userid !== userid ||
      (user.courseid !== undefined && user.courseid !== course.id))) throw new MoodleError('OPERATION_FAILED');
    return (data.usergrades[0]?.gradeitems ?? []).map(item => {
      const raw = rawGrade(item.graderaw);
      return {name: item.itemname === null ? item.itemtype === 'course' ? 'Course total' : null
        : this.client.redact(item.itemname), itemType: this.client.redact(item.itemtype),
        ...(item.itemmodule ? {module: this.client.redact(item.itemmodule)} : {}),
        grade: raw === null ? null : this.text(item.gradeformatted), rawGrade: raw,
        min: numeric(item.grademin), max: numeric(item.grademax),
        percentage: raw === null ? null : this.text(item.percentageformatted), feedback: this.text(item.feedback),
        gradedAt: unixToIso(item.gradedategraded), graded: raw !== null,
      };
    });
  }

  async getAnnouncements(courses: Course[], limit: number): Promise<Announcement[]> {
    if (!courses.length) return [];
    const data = parseResponse(forumsSchema, await this.client.call('mod_forum_get_forums_by_courses', {courseids: courses.map(course => course.id)}));
    const forums = Array.isArray(data) ? data : data.forums;
    const announcements: Announcement[] = [];
    const seenForums = new Set<number>();
    for (const forum of forums) {
      const course = courses.find(course => course.id === forum.course);
      if (forum.type !== 'news' || !course || seenForums.has(forum.id)) continue;
      seenForums.add(forum.id);
      const response = parseResponse(discussionsSchema, await this.client.call('mod_forum_get_forum_discussions', {
        forumid: forum.id, sortorder: -1, page: 0, perpage: limit,
      }));
      for (const discussion of response.discussions) {
        announcements.push({id: discussion.discussion, courseId: course.id, courseName: course.fullname,
          subject: this.client.redact(discussion.subject ?? discussion.name), author: this.text(discussion.userfullname),
          createdAt: unixToIso(discussion.created), modifiedAt: unixToIso(discussion.timemodified ?? discussion.modified),
          message: this.text(discussion.message, 2000),
          url: this.client.siteUrl('mod/forum/discuss.php', {d: String(discussion.discussion)}),
          pinned: discussion.pinned == null ? null : Boolean(discussion.pinned),
        });
      }
    }
    return announcements;
  }
}
