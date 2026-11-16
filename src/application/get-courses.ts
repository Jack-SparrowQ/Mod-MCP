import { MoodleError } from '../domain/errors.js';
import type { Course, MoodleAdapter } from '../domain/moodle-adapter.js';

export function findEnrolledCourse(courses: Course[], courseId: number): Course {
  const course = courses.find(course => course.id === courseId);
  if (!course) throw new MoodleError('RESOURCE_NOT_FOUND', undefined, {},
    'Use moodle_get_courses to list enrolled courses');
  return course;
}
function normalized(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
export async function getCourses(adapter: MoodleAdapter, input: {query?: string; courseId?: number}) {
  const enrolled = await adapter.getCourses();
  let courses = input.courseId === undefined ? enrolled : [findEnrolledCourse(enrolled, input.courseId)];
  if (input.query !== undefined) {
    const query = normalized(input.query);
    courses = courses.filter(course => normalized(course.fullname).includes(query) || normalized(course.shortname).includes(query));
  }
  return {courses, count: courses.length};
}
