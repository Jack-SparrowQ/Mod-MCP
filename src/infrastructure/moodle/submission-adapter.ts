import { z } from 'zod';
import { MoodleError } from '../../domain/errors.js';
import type { Course } from '../../domain/moodle-adapter.js';
import type { SubmissionAssignment, SubmissionState } from '../../domain/submission.js';
import { unixToIso, htmlToText } from '../../shared/moodle-values.js';
import { idSchema, parseResponse } from './response-schemas.js';
import type { RestClient } from './rest-client.js';

const flag = z.union([z.boolean(), z.literal(0), z.literal(1)]);
const time = z.number().finite().nonnegative().nullish();
const assignmentSchema = z.object({courses: z.array(z.object({id: idSchema, assignments: z.array(z.object({
  id: idSchema, cmid: idSchema, name: z.string(), intro: z.string().nullish(), duedate: time, cutoffdate: time,
  allowsubmissionsfromdate: time, submissiondrafts: flag, requiresubmissionstatement: flag, teamsubmission: flag,
  submissionstatement: z.string().nullish(), configs: z.array(z.object({plugin: z.string(), subtype: z.string(), name: z.string(), value: z.union([z.string(), z.number()])})),
}))}))});
const stateSchema = z.object({lastattempt: z.object({
  canedit: flag.optional(), cansubmit: flag.optional(),
  submission: z.object({status: z.string(), timemodified: time, plugins: z.array(z.object({
    type: z.string(), fileareas: z.array(z.object({area: z.string(), files: z.array(z.unknown())})).optional(),
  })).optional()}).nullish(),
}).nullish()});

export async function submissionAssignment(client: RestClient, courses: Course[], assignmentId: number): Promise<SubmissionAssignment | undefined> {
  if (!courses.length) return undefined;
  const data = parseResponse(assignmentSchema, await client.call('mod_assign_get_assignments', {courseids: courses.map(course => course.id)}));
  for (const group of data.courses) {
    const course = courses.find(course => course.id === group.id);
    const assignment = group.assignments.find(assignment => assignment.id === assignmentId);
    if (!course || !assignment) continue;
    const settings = new Map(assignment.configs.filter(config => config.plugin === 'file' && config.subtype === 'assignsubmission')
      .map(config => [config.name, String(config.value)]));
    const number = (key: string) => {
      const value = settings.get(key);
      if (value === undefined) return null;
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new MoodleError('OPERATION_FAILED');
      return Number(value);
    };
    return {id: assignment.id, cmid: assignment.cmid, courseId: course.id, courseName: course.fullname,
      name: client.redact(assignment.name), description: assignment.intro == null ? null : htmlToText(client.redact(assignment.intro), 4000),
      dueDate: unixToIso(assignment.duedate), cutoffDate: unixToIso(assignment.cutoffdate), allowSubmissionsFrom: unixToIso(assignment.allowsubmissionsfromdate),
      url: client.siteUrl('mod/assign/view.php', {id: String(assignment.cmid)}), drafts: Boolean(assignment.submissiondrafts),
      requiresStatement: Boolean(assignment.requiresubmissionstatement), team: Boolean(assignment.teamsubmission),
      statement: assignment.submissionstatement == null ? null : htmlToText(client.redact(assignment.submissionstatement), 4000),
      fileEnabled: settings.get('enabled') === '1', maxFiles: number('maxfilesubmissions'), maxFileBytes: number('maxsubmissionsizebytes'),
      fileTypes: settings.get('filetypeslist') ?? '',
    };
  }
}
export async function submissionState(client: RestClient, assignmentId: number): Promise<SubmissionState> {
  const data = parseResponse(stateSchema, await client.call('mod_assign_get_submission_status', {assignid: assignmentId}));
  const attempt = data.lastattempt;
  const areas = attempt?.submission?.plugins?.filter(plugin => plugin.type === 'file').flatMap(plugin => plugin.fileareas ?? [])
    .filter(area => area.area === 'submission_files');
  const rawStatus = attempt?.submission?.status;
  const status = ['submitted', 'draft', 'new', 'reopened'].includes(rawStatus ?? '') ? rawStatus! : 'unknown';
  return {status, lastModified: unixToIso(attempt?.submission?.timemodified),
    ...(attempt?.canedit !== undefined ? {canEdit: Boolean(attempt.canedit)} : {}),
    ...(attempt?.cansubmit !== undefined ? {canSubmit: Boolean(attempt.cansubmit)} : {}),
    ...(areas?.length ? {draftFileCount: areas.reduce((sum, area) => sum + area.files.length, 0)} : {}),
  };
}

