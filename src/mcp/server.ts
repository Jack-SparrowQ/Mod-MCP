import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MoodleAdapter } from '../domain/moodle-adapter.js';
import { registerAuthStatus } from './tools/auth-status.js';

export function createServer(adapter: MoodleAdapter) {
  const server = new McpServer({name: 'moodle-itescam-mcp', version: '0.1.0'});
  registerAuthStatus(server, adapter);
  return server;
}
