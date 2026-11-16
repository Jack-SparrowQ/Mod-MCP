import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'node:url';
import { readConfig } from './shared/config.js';
import { createLogger } from './infrastructure/logging/logger.js';
import { RestClient } from './infrastructure/moodle/rest-client.js';
import { RestAdapter } from './infrastructure/moodle/rest-adapter.js';
import { createServer } from './mcp/server.js';
import { LocalSubmissionFiles } from './infrastructure/files/submission-files.js';

try {
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Unable to load configuration file.');
  }
  const config = readConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const adapter = new RestAdapter(new RestClient({
    baseUrl: config.MOODLE_BASE_URL, token: config.MOODLE_TOKEN, logger,
  }), {root: fileURLToPath(new URL('../downloads/', import.meta.url)), maxBytes: config.MAX_DOWNLOAD_MB * 1024 * 1024});
  await createServer(adapter, {submissionFiles: new LocalSubmissionFiles(fileURLToPath(new URL('../submissions/', import.meta.url)))})
    .connect(new StdioServerTransport());
} catch {
  process.stderr.write('MCP startup failed. Check configuration and local file permissions.\n');
  process.exitCode = 1;
}
