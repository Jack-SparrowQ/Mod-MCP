import { MoodleError } from '../domain/errors.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import type { SubmissionFiles, SubmissionConfirmation } from '../domain/submission.js';

const inFlight = new Set<number>();
const invalid = (reason: string) => new MoodleError('VALIDATION_ERROR', 'Assignment cannot be submitted.', {reason});
export async function submitAssignment(adapter: MoodleAdapter, local: SubmissionFiles, confirmation: SubmissionConfirmation,
  input: {assignmentId: number; files: string[]}) {
  if (inFlight.has(input.assignmentId)) throw new MoodleError('VALIDATION_ERROR', 'submission already in progress');
  inFlight.add(input.assignmentId);
  let draftSaved = false;
  try {
    const files = await local.inspect(input.files);
    const assignment = await adapter.getSubmissionAssignment(await adapter.getCourses(), input.assignmentId);
    if (!assignment) throw new MoodleError('RESOURCE_NOT_FOUND');
    if (assignment.team) throw new MoodleError('INTEGRATION_UNSUPPORTED', 'Team submissions are not supported.');
    if (!assignment.fileEnabled) throw new MoodleError('INTEGRATION_UNSUPPORTED', 'File submissions are not enabled.');
    const now = Date.now();
    if (assignment.maxFiles !== null && files.length > assignment.maxFiles) throw invalid('too_many_files');
    if (assignment.maxFileBytes && files.some(file => file.size > assignment.maxFileBytes!)) throw invalid('file_too_large');
    const extensions = assignment.fileTypes.split(/[,;\s]+/).filter(Boolean);
    if (extensions.length && extensions.every(extension => /^\.[a-z0-9]+(?:\.[a-z0-9]+)*$/i.test(extension)) &&
      files.some(file => !extensions.some(extension => file.filename.toLowerCase().endsWith(extension.toLowerCase())))) throw invalid('file_extension');
    const previous = await adapter.getSubmissionState(assignment.id);
    if (previous.status === 'submitted') throw invalid('already_submitted');
    if (previous.status === 'unknown') throw invalid('status_unknown');
    if (previous.canEdit === false) throw invalid('cannot_edit');
    if (assignment.drafts && previous.canSubmit === false) throw invalid('cannot_submit');
    const moodleAllowsEditing = previous.canEdit === true && (!assignment.drafts || previous.canSubmit !== false);
    const checkDates = (time: number) => {
      if (moodleAllowsEditing) return;
      if (assignment.allowSubmissionsFrom && Date.parse(assignment.allowSubmissionsFrom) > time) throw invalid('not_open');
      if (assignment.cutoffDate && Date.parse(assignment.cutoffDate) < time) throw invalid('cutoff_passed');
    };
    checkDates(now);
    const effectiveDueDate = previous.extensionDueDate &&
      (assignment.dueDate === null || Date.parse(previous.extensionDueDate) > Date.parse(assignment.dueDate))
      ? previous.extensionDueDate : assignment.dueDate;
    if (!confirmation.supported()) throw new MoodleError('CONFIRMATION_REQUIRED', undefined, {},
      'Use an MCP client that supports elicitation, such as Claude Code');
    const late = effectiveDueDate !== null && Date.parse(effectiveDueDate) < now;
    const message = [
      `Course: ${assignment.courseName}`, `Assignment: ${assignment.name}`, `Due date: ${effectiveDueDate ?? 'No due date'}`,
      ...(late ? ['LATE: the due date has passed.'] : []),
      ...files.map(file => `File: ${file.name} (${file.size} bytes)`),
      ...(previous.draftFileCount ? [`This replaces ${previous.draftFileCount} existing draft files.`] : []),
      assignment.drafts ? 'This will be submitted for grading (final), not left as a draft.' : 'This saves a final submission.',
      ...(assignment.requiresStatement ? [assignment.statement || 'I confirm this submission is my own work and accept the assignment submission statement.'] : []),
      'Confirm this exact assignment and these files?',
    ].join('\n');
    const approval = await confirmation.confirm(message, assignment.requiresStatement);
    if (!approval.confirmed || (assignment.requiresStatement && !approval.acceptedStatement)) return {submitted: false, cancelled: true,
      ...(approval.reason ? {reason: approval.reason} : {})};
    checkDates(Date.now());
    const snapshots = await local.readVerified(files);
    checkDates(Date.now());
    // All bytes are snapshotted and rechecked before the first remote write.
    let itemId = 0;
    for (const file of snapshots) itemId = await adapter.uploadSubmissionFile(file, itemId);
    await adapter.saveSubmission(assignment.id, itemId);
    draftSaved = true;
    if (assignment.drafts) await adapter.submitForGrading(assignment.id, approval.acceptedStatement);
    const verified = await adapter.getSubmissionState(assignment.id);
    if (verified.status !== 'submitted') throw new MoodleError('OPERATION_FAILED', 'Moodle did not confirm the submission', {status: verified.status});
    const submittedAt = verified.lastModified ?? new Date().toISOString();
    return {submitted: true, status: verified.status, assignmentId: assignment.id, assignmentName: assignment.name,
      courseName: assignment.courseName, files: files.map(file => ({name: file.name, size: file.size})),
      submittedAt, late: effectiveDueDate !== null && Date.parse(effectiveDueDate) < Date.parse(submittedAt)};
  } catch (error) {
    if (!draftSaved) throw error;
    const safe = error instanceof MoodleError ? error : new MoodleError('OPERATION_FAILED');
    throw new MoodleError(safe.code,
      'Files were saved in Moodle as a draft but the submission was not confirmed.',
      {...safe.context, draftSaved: true},
      'Open the assignment in Moodle to check it; do not retry blindly.');
  } finally { inFlight.delete(input.assignmentId); }
}
