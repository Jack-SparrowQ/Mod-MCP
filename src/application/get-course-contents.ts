import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { findEnrolledCourse } from './get-courses.js';

export async function getCourseContents(adapter: MoodleAdapter, courseId: number) {
  const {id, fullname, url} = findEnrolledCourse(await adapter.getCourses(), courseId);
  return {course: {id, fullname, url}, sections: await adapter.getCourseContents(id)};
}
