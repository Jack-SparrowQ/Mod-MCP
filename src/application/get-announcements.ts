import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { selectedCourses } from './academic-helpers.js';

export async function getAnnouncements(adapter: MoodleAdapter, input: {courseId?: number; limit?: number}) {
  const limit = input.limit ?? 10;
  const all = await adapter.getAnnouncements(await selectedCourses(adapter, input.courseId), limit);
  const seen = new Set<number>();
  const announcements = all.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  })
    .sort((a, b) => Date.parse(b.modifiedAt ?? b.createdAt ?? '1970-01-01') - Date.parse(a.modifiedAt ?? a.createdAt ?? '1970-01-01') || b.id - a.id)
    .slice(0, limit);
  return {announcements, count: announcements.length};
}
