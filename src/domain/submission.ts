import type { Assignment } from './academic.js';

export interface LocalSubmissionFile { name: string; filename: string; size: number; sha256: string; }
export interface UploadFile extends LocalSubmissionFile { bytes: Uint8Array; }
export interface SubmissionFiles {
  inspect(names: string[]): Promise<LocalSubmissionFile[]>;
  readVerified(files: LocalSubmissionFile[]): Promise<UploadFile[]>;
}
export interface SubmissionAssignment extends Assignment {
  drafts: boolean; requiresStatement: boolean; statement: string | null; team: boolean;
  fileEnabled: boolean; maxFiles: number | null; maxFileBytes: number | null; fileTypes: string;
}
export interface SubmissionState {
  status: string; lastModified: string | null; canEdit?: boolean; canSubmit?: boolean; draftFileCount?: number; extensionDueDate?: string | null;
}
export interface SubmissionConfirmation {
  supported(): boolean;
  confirm(message: string, requiresStatement: boolean): Promise<{confirmed: boolean; acceptedStatement: boolean; reason?: 'confirmation_timeout'}>;
}
