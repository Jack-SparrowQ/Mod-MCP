import { expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp/server.js';
import { MoodleError } from '../../src/domain/errors.js';
import type { MoodleAdapter } from '../../src/domain/moodle-adapter.js';

const site = {sitename: 'Fixture School', release: '4.1', version: '1', lang: 'es'};
const unused = async (): Promise<never> => { throw new Error('unused'); };
it.each(['success', 'AUTH_REQUIRED', 'SESSION_EXPIRED', 'PERMISSION_DENIED', 'unknown'] as const)
  ('MCP client lists and calls auth status: %s', async mode => {
    const adapter: MoodleAdapter = {getProfile: unused,
      getAssignments: unused, getAssignmentSubmission: unused, getActionEvents: unused,
      getCalendarEvents: unused, getGradeOverview: unused, getGradeItems: unused, getAnnouncements: unused,
      getCourses: async () => [], getCourseContents: async () => [], getSiteInfo: async () => {
      if (mode === 'unknown') throw new Error('private sentinel');
      if (mode !== 'success') throw new MoodleError(mode);
      return {...site, fullname: 'private sentinel', token: 'private sentinel'};
    }};
    const server = createServer(adapter);
    const client = new Client({name: 'fixture-client', version: '1.0.0'});
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toEqual([
        'moodle_auth_status', 'moodle_get_profile', 'moodle_get_courses', 'moodle_get_course_contents',
        'moodle_get_assignments', 'moodle_get_assignment', 'moodle_get_upcoming_deadlines',
        'moodle_get_calendar_events', 'moodle_get_grades', 'moodle_get_announcements',
      ]);
      const result = await client.callTool({name: 'moodle_auth_status', arguments: {}});
      const data = result.structuredContent;
      expect(result.content).toEqual([{type: 'text', text: JSON.stringify(data)}]);
      expect(JSON.stringify(result)).not.toContain('private sentinel');
      if (mode === 'success') {
        expect(data).toEqual({authenticated: true, site});
        expect(result.isError).toBe(false);
      } else if (mode === 'AUTH_REQUIRED' || mode === 'SESSION_EXPIRED') {
        expect(data).toEqual({authenticated: false, error: {
          code: mode, message: expect.any(String), suggestion: 'Run npm run token',
        }});
        expect(result.isError).toBe(false);
      } else {
        expect(data).toEqual({error: {code: mode === 'unknown' ? 'OPERATION_FAILED' : mode,
          message: expect.any(String), context: {}, suggestion: expect.any(String)}});
        expect(result.isError).toBe(true);
      }
      const invalid = await client.callTool({name: 'moodle_auth_status', arguments: {unexpected: true}});
      expect(invalid.isError).toBe(true);
    } finally { await client.close(); await server.close(); }
  });
