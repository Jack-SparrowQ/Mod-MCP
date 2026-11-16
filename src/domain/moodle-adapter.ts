import type { Assignment, SubmissionInfo, AssignmentGrade, Deadline, CalendarEvent, CourseGrade, GradeItem, Announcement } from './academic.js';
import type { SubmissionAssignment, SubmissionState, UploadFile } from './submission.js';

export interface SiteInfo {
  release: string;
  version: string;
  sitename: string;
  lang: string;
}
export interface UserProfile {
  id: number;
  fullname: string;
  username?: string;
  email?: string;
  profileUrl: string;
}
export interface Course {
  id: number;
  shortname: string;
  fullname: string;
  summary: string | null;
  category?: number;
  startDate: string | null;
  endDate: string | null;
  visible: boolean | null;
  progress?: number | null;
  lastAccess?: string | null;
  url: string;
}
export interface CourseFile {
  filename: string;
  filepath: string;
  size: number | null;
  mimeType: string | null;
  modifiedAt: string | null;
}
export interface CourseModule {
  id: number;
  name: string;
  type: string;
  url?: string;
  visible: boolean | null;
  availability?: string;
  files?: CourseFile[];
}
export interface CourseSection {
  id: number;
  number: number | null;
  name: string;
  summary: string | null;
  visible: boolean | null;
  modules: CourseModule[];
}
export interface MoodleAdapter {
  getSiteInfo(): Promise<SiteInfo>;
  getProfile(): Promise<UserProfile>;
  getCourses(): Promise<Course[]>;
  getCourseContents(courseId: number): Promise<CourseSection[]>;
  getAssignments(courses: Course[]): Promise<Assignment[]>;
  getAssignmentSubmission(assignmentId: number): Promise<{submission: SubmissionInfo; grade?: AssignmentGrade}>;
  getActionEvents(courses: Course[], from: number, to: number, limit: number): Promise<{events: Deadline[]; truncated: boolean}>;
  getCalendarEvents(courses: Course[], from: number, to: number): Promise<CalendarEvent[]>;
  getGradeOverview(courses: Course[]): Promise<CourseGrade[]>;
  getGradeItems(course: Course): Promise<GradeItem[]>;
  getAnnouncements(courses: Course[], limit: number): Promise<Announcement[]>;
  downloadResource(input: DownloadResourceInput): Promise<DownloadedFile>;
  getSubmissionAssignment(courses: Course[], assignmentId: number): Promise<SubmissionAssignment | undefined>;
  getSubmissionState(assignmentId: number): Promise<SubmissionState>;
  uploadSubmissionFile(file: UploadFile, itemId: number): Promise<number>;
  saveSubmission(assignmentId: number, itemId: number): Promise<void>;
  submitForGrading(assignmentId: number, acceptedStatement: boolean): Promise<void>;
}
export interface DownloadResourceInput {
  courseId: number; moduleId: number; filename?: string; filepath?: string;
}
export interface DownloadedFile {
  path: string; filename: string; originalFilename: string; size: number; mimeType: string | null;
  courseId: number; moduleId: number;
}
