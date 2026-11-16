import { z } from 'zod';
import { MoodleError } from '../domain/errors.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { findEnrolledCourse } from './get-courses.js';

export const DAY = 86400000;
export const ACADEMIC_LIMIT = 200;
export function isoMillis(value: string): number {
  if (!z.iso.datetime({offset: true}).safeParse(value).success) throw new MoodleError('VALIDATION_ERROR');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new MoodleError('VALIDATION_ERROR');
  return parsed;
}
export function bounds(from?: string, to?: string) {
  const start = from === undefined ? undefined : isoMillis(from);
  const end = to === undefined ? undefined : isoMillis(to);
  if (start !== undefined && end !== undefined && start > end) throw new MoodleError('VALIDATION_ERROR');
  return {start, end};
}
export function within(date: string | null, start?: number, end?: number): boolean {
  if (date === null) return start === undefined && end === undefined;
  const time = Date.parse(date);
  return (start === undefined || time >= start) && (end === undefined || time <= end);
}
export function dateOrder(a: string | null, b: string | null): number {
  return a === null ? b === null ? 0 : 1 : b === null ? -1 : Date.parse(a) - Date.parse(b);
}
export async function selectedCourses(adapter: MoodleAdapter, courseId?: number) {
  const enrolled = await adapter.getCourses();
  return courseId === undefined ? enrolled : [findEnrolledCourse(enrolled, courseId)];
}
export function dueState(due: string | null, now: number): 'no_due_date' | 'upcoming' | 'past_due' {
  return due === null ? 'no_due_date' : Date.parse(due) < now ? 'past_due' : 'upcoming';
}
