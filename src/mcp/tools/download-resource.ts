import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../../domain/moodle-adapter.js';
import { downloadResource } from '../../application/download-resource.js';
import { readTool } from './read-tool.js';

export function registerDownloadResource(server: McpServer, adapter: MoodleAdapter) {
  server.registerTool('moodle_download_resource', {
    description: 'Download one file from an enrolled course activity to the local project downloads folder. Files are saved locally and never overwritten. Use moodle_get_course_contents to find moduleId, filename and filepath; no download URL is accepted.',
    inputSchema: z.object({courseId: z.number().int().positive(), moduleId: z.number().int().positive(),
      filename: z.string().min(1).max(255).optional(), filepath: z.string().optional()}).strict(),
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true},
  }, async input => readTool(() => downloadResource(adapter, input)));
}
