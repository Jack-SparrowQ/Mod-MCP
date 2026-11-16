import type { MoodleAdapter, DownloadResourceInput } from '../domain/moodle-adapter.js';
import { findEnrolledCourse } from './get-courses.js';

export async function downloadResource(adapter: MoodleAdapter, input: DownloadResourceInput) {
  findEnrolledCourse(await adapter.getCourses(), input.courseId);
  return {file: await adapter.downloadResource(input)};
}
