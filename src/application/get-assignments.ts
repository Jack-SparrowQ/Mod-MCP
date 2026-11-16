import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { bounds, dateOrder, dueState, selectedCourses, within } from './academic-helpers.js';

export async function getAssignments(adapter: MoodleAdapter, input: {
  courseId?: number; dueAfter?: string; dueBefore?: string; limit?: number;
}, now = Date.now()) {
  const {start, end} = bounds(input.dueAfter, input.dueBefore);
  const courses = await selectedCourses(adapter, input.courseId);
  const assignments = (await adapter.getAssignments(courses))
    .filter(assignment => within(assignment.dueDate, start, end))
    .sort((a, b) => {
      const rank = {upcoming: 0, past_due: 1, no_due_date: 2};
      const stateA = dueState(a.dueDate, now);
      const stateB = dueState(b.dueDate, now);
      return rank[stateA] - rank[stateB] ||
        (stateA === 'past_due' ? dateOrder(b.dueDate, a.dueDate) : dateOrder(a.dueDate, b.dueDate)) || a.id - b.id;
    });
  const limit = input.limit ?? 50;
  return {assignments: assignments.slice(0, limit).map(({description: _description, ...assignment}) => ({
    ...assignment, dueState: dueState(assignment.dueDate, now),
  })), count: Math.min(assignments.length, limit), truncated: assignments.length > limit};
}
