import type { SubmissionInfo } from '../domain/academic.js';
import { unixToIso } from './moodle-values.js';

type Submission = {status?: string | null; timemodified?: number | null};
type Attempt = {submission?: Submission | null; teamsubmission?: Submission | null};
export function normalizeSubmissionStatus(attempt: Attempt | null | undefined): Pick<SubmissionInfo, 'status' | 'lastModified'> {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) return {status: 'unknown', lastModified: null};
  const individual = attempt.submission;
  const selected = attempt.teamsubmission && (!individual || individual.status == null || individual.status === 'new')
    ? attempt.teamsubmission : individual;
  if (!selected) return {status: 'new', lastModified: null};
  const state = selected.status;
  const status = state === 'submitted' || state === 'draft' || state === 'new' || state === 'reopened' ? state : 'unknown';
  return {status, lastModified: unixToIso(selected.timemodified)};
}
