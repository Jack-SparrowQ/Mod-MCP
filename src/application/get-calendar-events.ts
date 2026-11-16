import { MoodleError } from '../domain/errors.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { ACADEMIC_LIMIT, DAY, bounds, dateOrder, selectedCourses, within } from './academic-helpers.js';

export async function getCalendarEvents(adapter: MoodleAdapter, input: {from?: string; to?: string; courseId?: number}, now = Date.now()) {
  const range = bounds(input.from, input.to);
  const from = range.start ?? now;
  const to = range.end ?? from + 7 * DAY;
  if (from > to || to - from > 92 * DAY || from < 0) throw new MoodleError('VALIDATION_ERROR');
  const courses = await selectedCourses(adapter, input.courseId);
  const events = (await adapter.getCalendarEvents(courses, Math.floor(from / 1000), Math.floor(to / 1000)))
    .filter(event => within(event.start, from, to) && (input.courseId === undefined || event.courseId === input.courseId))
    .sort((a, b) => dateOrder(a.start, b.start) || a.id - b.id);
  return {events: events.slice(0, ACADEMIC_LIMIT), count: Math.min(events.length, ACADEMIC_LIMIT), truncated: events.length > ACADEMIC_LIMIT};
}
