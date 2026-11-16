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
}
