import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { vi } from 'vitest';
import { temporaryRoot } from './downloads.js';
import { siteInfo, enrolledCourses } from './moodle.js';
import { NOW, SECOND, day } from './academic.js';
import { createLogger } from '../../src/infrastructure/logging/logger.js';
import { RestClient, WRITE_FUNCTIONS } from '../../src/infrastructure/moodle/rest-client.js';
import { RestAdapter } from '../../src/infrastructure/moodle/rest-adapter.js';
import { LocalSubmissionFiles } from '../../src/infrastructure/files/submission-files.js';

export async function submissionFixture() {
  const root = await temporaryRoot();
  const submissionRoot = join(root, 'submissions');
  await mkdir(join(submissionRoot, 'unit'), {recursive: true});
  await writeFile(join(submissionRoot, 'unit', 'report.pdf'), 'approved PDF bytes');
  await writeFile(join(submissionRoot, 'extra.pdf'), 'second file');
  const policy = {id: 101, cmid: 1001, name: 'Fixture assignment', duedate: SECOND - day,
    cutoffdate: SECOND + day, allowsubmissionsfromdate: SECOND - 2 * day,
    submissiondrafts: 1, requiresubmissionstatement: 0, teamsubmission: 0,
    submissionstatement: 'This work is my own.',
    configs: [{plugin: 'file', subtype: 'assignsubmission', name: 'enabled', value: '1'},
      {plugin: 'file', subtype: 'assignsubmission', name: 'maxfilesubmissions', value: '3'},
      {plugin: 'file', subtype: 'assignsubmission', name: 'maxsubmissionsizebytes', value: '10000'},
      {plugin: 'file', subtype: 'assignsubmission', name: 'filetypeslist', value: '.pdf'}],
  };
  const preflight = {lastattempt: {canedit: true, cansubmit: true, submission: {status: 'new', timemodified: SECOND - day,
    plugins: [{type: 'file', fileareas: [{area: 'submission_files', files: [{}, {}]}]}]}}};
  const verified = {lastattempt: {submission: {status: 'submitted', timemodified: SECOND}}};
  const replies: Record<string, unknown> = {mod_assign_save_submission: [], mod_assign_submit_for_grading: []};
  const logs: string[] = [];
  let statusCalls = 0;
  const mock = vi.fn<typeof fetch>(async (url, options) => {
    if (options!.body instanceof FormData) {
      const file = options!.body.get('file_1') as File;
      return new Response(JSON.stringify(replies.upload ?? [{itemid: 900, filename: file.name}]));
    }
    const params = options!.body as URLSearchParams;
    const name = params.get('wsfunction')!;
    const data = name === 'core_webservice_get_site_info' ? siteInfo
      : name === 'core_enrol_get_users_courses' ? enrolledCourses
        : name === 'mod_assign_get_assignments' ? {courses: [{id: 7, assignments: [policy]}]}
          : name === 'mod_assign_get_submission_status' ? statusCalls++ === 0 ? preflight : verified : replies[name];
    return new Response(JSON.stringify(data));
  });
  const client = new RestClient({baseUrl: 'https://example.invalid/moodle/', token: 'fixture-secret-token',
    logger: createLogger('info', {write: line => { logs.push(line); }}), fetch: mock});
  const adapter = new RestAdapter(client, {root: join(root, 'downloads')});
  const files = new LocalSubmissionFiles(submissionRoot);
  const calls = () => mock.mock.calls.map(([url, options]) => ({url: String(url), options: options!,
    name: options!.body instanceof FormData ? 'upload' : (options!.body as URLSearchParams).get('wsfunction')!,
  }));
  const writes = () => calls().filter(call => call.name === 'upload' || WRITE_FUNCTIONS.some(name => name === call.name));
  const setting = (name: string, value: string) => { policy.configs.find(config => config.name === name)!.value = value; };
  return {root, submissionRoot, policy, preflight, verified, replies, mock, client, adapter, files, logs, calls, writes, setting, now: NOW};
}
