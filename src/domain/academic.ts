export interface Assignment {
  id: number; cmid: number; courseId: number; courseName: string; name: string;
  dueDate: string | null; cutoffDate: string | null; allowSubmissionsFrom: string | null;
  url: string; description: string | null;
}
export interface SubmissionInfo {
  status: 'submitted' | 'draft' | 'new' | 'reopened' | 'unknown';
  gradingStatus: string | null; lastModified: string | null;
}
export interface AssignmentGrade { grade: string | null; rawGrade: number | null; gradedAt: string | null; }
export interface Deadline {
  name: string; courseId: number | null; courseName: string | null; moduleType?: string;
  dueDate: string | null; url?: string; actionable?: boolean;
}
export interface CalendarEvent {
  id: number; name: string; description: string | null; type: string; moduleType?: string;
  courseId?: number; start: string | null; durationSeconds: number | null; url?: string;
}
export interface CourseGrade { courseId: number; courseName: string; grade: string | null; rawGrade: number | null; }
export interface GradeItem {
  name: string | null; itemType: string; module?: string; grade: string | null; rawGrade: number | null;
  min: number | null; max: number | null; percentage: string | null; feedback: string | null;
  gradedAt: string | null; graded: boolean;
}
export interface Announcement {
  id: number; courseId: number; courseName: string; subject: string; author: string | null;
  createdAt: string | null; modifiedAt: string | null; message: string | null; url: string; pinned: boolean | null;
}
