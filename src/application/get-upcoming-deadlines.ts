import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { ACADEMIC_LIMIT, DAY, dateOrder, within } from './academic-helpers.js';

export async function getUpcomingDeadlines(adapter: MoodleAdapter, input: {days?: number; includeOverdue?: boolean}, now = Date.now()) {
  const from = input.includeOverdue === false ? now : now - 30 * DAY;
  const to = now + (input.days ?? 14) * DAY;
  const {events, truncated} = await adapter.getActionEvents(await adapter.getCourses(), Math.floor(from / 1000), Math.floor(to / 1000), ACADEMIC_LIMIT);
  const deadlines = events.filter(event => event.dueDate !== null && within(event.dueDate, from, to))
    .sort((a, b) => dateOrder(a.dueDate, b.dueDate)).slice(0, ACADEMIC_LIMIT)
    .map(event => ({...event, overdue: Date.parse(event.dueDate!) < now}));
  return {deadlines, count: deadlines.length, truncated};
}
