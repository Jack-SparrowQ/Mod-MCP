import { MoodleError } from '../domain/errors.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { dueState } from './academic-helpers.js';

export async function getAssignment(adapter: MoodleAdapter, assignmentId: number, now = Date.now()) {
  const assignments = await adapter.getAssignments(await adapter.getCourses());
  const assignment = assignments.find(assignment => assignment.id === assignmentId);
  if (!assignment) throw new MoodleError('RESOURCE_NOT_FOUND', undefined, {}, 'Use moodle_get_assignments to list assignments in enrolled courses');
  const {submission, grade} = await adapter.getAssignmentSubmission(assignment.id);
  return {assignment: {...assignment, dueState: dueState(assignment.dueDate, now),
    submission: {...submission, overdue: submission.status !== 'submitted' && assignment.dueDate !== null && Date.parse(assignment.dueDate) < now},
    ...(grade ? {grade} : {}),
  }};
}
