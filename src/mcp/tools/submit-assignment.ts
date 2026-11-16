import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import type { SubmissionFiles, SubmissionConfirmation } from '../../domain/submission.js';
import { MoodleError } from '../../domain/errors.js';
import { submitAssignment } from '../../application/submit-assignment.js';
import { readTool } from './read-tool.js';

export function registerSubmitAssignment(server: McpServer, adapter: MoodleAdapter, local?: SubmissionFiles) {
  const unavailable = async (): Promise<never> => { throw new MoodleError('VALIDATION_ERROR', 'Submission directory is not configured.'); };
  const files = local ?? {inspect: unavailable, readVerified: unavailable};
  const confirmation: SubmissionConfirmation = {
    supported: () => Boolean(server.server.getClientCapabilities()?.elicitation?.form),
    confirm: async (message, requiresStatement) => {
      try {
        const result = await server.server.elicitInput({mode: 'form', message, requestedSchema: {
          type: 'object', properties: {confirm: {type: 'boolean', title: 'Confirm submission'},
            ...(requiresStatement ? {acceptStatement: {type: 'boolean' as const, title: 'Accept submission statement'}} : {})},
          required: requiresStatement ? ['confirm', 'acceptStatement'] : ['confirm'],
        }});
        return {confirmed: result.action === 'accept' && result.content?.confirm === true,
          acceptedStatement: result.action === 'accept' && result.content?.acceptStatement === true};
      } catch (error) {
        // Missing/invalid required booleans must never become approval.
        if (error instanceof McpError && error.code === ErrorCode.InvalidParams) return {confirmed: false, acceptedStatement: false};
        throw new MoodleError('CONFIRMATION_REQUIRED', undefined, {}, 'Use an MCP client that supports elicitation, such as Claude Code');
      }
    },
  };
  server.registerTool('moodle_submit_assignment', {
    description: 'Submit files from the local project submissions/ folder to an enrolled assignment. Relative filenames only, including subfolders. Your MCP client will ask you to confirm the course, assignment and files; already-submitted assignments are refused. This writes to Moodle and submits for grading.',
    inputSchema: z.object({assignmentId: z.number().int().positive(), files: z.array(z.string().min(1)).min(1).max(20)}).strict(),
    annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true},
  }, async input => readTool(() => submitAssignment(adapter, files, confirmation, input)));
}
