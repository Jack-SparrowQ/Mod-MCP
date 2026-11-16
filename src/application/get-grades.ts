import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { ACADEMIC_LIMIT, selectedCourses } from './academic-helpers.js';

export async function getGrades(adapter: MoodleAdapter, input: {courseId?: number}) {
  const courses = await selectedCourses(adapter, input.courseId);
  if (input.courseId === undefined) {
    const grades = await adapter.getGradeOverview(courses);
    return {grades: grades.slice(0, ACADEMIC_LIMIT), count: Math.min(grades.length, ACADEMIC_LIMIT), truncated: grades.length > ACADEMIC_LIMIT};
  }
  const {id, fullname, url} = courses[0];
  const all = await adapter.getGradeItems(courses[0]);
  const items = all.filter(item => item.itemType !== 'course');
  return {course: {id, fullname, url}, items: items.slice(0, ACADEMIC_LIMIT),
    courseTotal: all.find(item => item.itemType === 'course') ?? null,
    count: Math.min(items.length, ACADEMIC_LIMIT), truncated: items.length > ACADEMIC_LIMIT};
}
