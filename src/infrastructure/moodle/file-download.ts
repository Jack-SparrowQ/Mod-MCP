import { open, rename, unlink, lstat, mkdir, realpath } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';
import type { Logger } from 'pino';
import { MoodleError } from '../../domain/errors.js';
import { insideDirectory, suffixedFilename } from '../../shared/download-path.js';
import { moodleResponseError } from './moodle-error.js';

export function authorizedFileUrl(value: string, baseUrl: string): URL {
  const deny = () => new MoodleError('PERMISSION_DENIED', undefined, {}, 'Only Moodle-hosted files can be downloaded');
  try {
    const base = new URL(baseUrl);
    const url = new URL(value);
    const prefix = new URL('webservice/pluginfile.php/', base).pathname;
    // Reject traversal before URL canonicalization, including encoded/double-encoded variants.
    let decoded = value;
    for (let i = 0; i < 4; i++) {
      if (/(?:^|[\/\\])\.{1,2}(?=[\/\\?#]|$)/.test(decoded) || decoded.includes('\\')) throw deny();
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (/(?:^|[\/\\])\.{1,2}(?=[\/\\?#]|$)/.test(decoded) || decoded.includes('\\')) throw deny();
    if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password ||
      !url.pathname.startsWith(prefix) || url.pathname.length === prefix.length || url.hash) throw deny();
    return url;
  } catch { throw deny(); }
}

export async function downloadFile(options: {
  fileUrl: string; baseUrl: string; token?: string; destination: string; maxBytes: number;
  expectedSize?: number | null; logger: Logger; fetch?: typeof fetch; timeoutMs?: number;
}) {
  const started = performance.now();
  let outcome = 'OK';
  let bytes = 0;
  let finalPath: string | undefined;
  let partPath: string | undefined;
  let part: Awaited<ReturnType<typeof open>> | undefined;
  const redact = (value: string) => options.token ? value.split(options.token).join('[REDACTED]') : value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  const tooLarge = () => new MoodleError('VALIDATION_ERROR', 'File exceeds the download size limit.', {maxMb: options.maxBytes / (1024 * 1024)});
  try {
    const url = authorizedFileUrl(options.fileUrl, options.baseUrl);
    if (!options.token) throw new MoodleError('AUTH_REQUIRED');
    url.searchParams.delete('wstoken');
    url.searchParams.delete('privatetoken');
    url.searchParams.set('token', options.token);
    let response: Response;
    try {
      response = await (options.fetch ?? fetch)(url, {method: 'GET', redirect: 'error', signal: controller.signal});
    } catch { throw new MoodleError('MOODLE_UNAVAILABLE'); }
    if (response.status === 404) throw new MoodleError('RESOURCE_NOT_FOUND');
    if (response.status === 401 || response.status === 403) throw new MoodleError('PERMISSION_DENIED');
    if (response.status >= 500) throw new MoodleError('MOODLE_UNAVAILABLE');
    if (!response.ok) throw new MoodleError('OPERATION_FAILED');
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) > options.maxBytes) { controller.abort(); throw tooLarge(); }

    const directory = resolve(dirname(options.destination));
    await mkdir(directory, {recursive: true});
    // Refuse symlink/junction escapes instead of writing outside the selected directory.
    if (resolve(await realpath(directory)) !== directory) throw new MoodleError('PERMISSION_DENIED');
    const name = basename(options.destination);
    for (let count = 0; ; count++) {
      const candidate = insideDirectory(directory, suffixedFilename(name, count));
      const temporary = candidate + '.part';
      try {
        try { await lstat(temporary); continue; } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        // Exclusive reservation prevents simultaneous downloads choosing the same final name.
        const reserved = await open(candidate, 'wx');
        await reserved.close();
        finalPath = candidate;
        part = await open(temporary, 'wx');
        partPath = temporary;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (finalPath === candidate) { await unlink(candidate); finalPath = undefined; }
      }
    }
    const reader = response.body?.getReader();
    if (!reader) throw new MoodleError('OPERATION_FAILED');
    const isJson = /^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '');
    const jsonChunks: Uint8Array[] = [];
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > options.maxBytes) { controller.abort(); await reader.cancel(); throw tooLarge(); }
        if (isJson) jsonChunks.push(value);
        await part.writeFile(value);
      }
    } catch (error) {
      if (error instanceof MoodleError) throw error;
      throw new MoodleError('MOODLE_UNAVAILABLE');
    } finally { reader.releaseLock(); }
    if (isJson) {
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(jsonChunks).toString('utf8')); } catch { /* A JSON resource can contain arbitrary text. */ }
      const error = data && typeof data === 'object' && 'errorcode' in data ? moodleResponseError(data, redact) : undefined;
      if (error) throw error;
    }
    if (options.expectedSize != null && bytes !== options.expectedSize) throw new MoodleError('OPERATION_FAILED');
    await part.close();
    part = undefined;
    await rename(partPath!, finalPath!);
    partPath = undefined;
    const path = finalPath!;
    finalPath = undefined;
    return {path, size: bytes, mimeType: redact(response.headers.get('content-type')?.split(';')[0].trim() ?? '') || null};
  } catch (error) {
    const safe = error instanceof MoodleError ? error : new MoodleError('OPERATION_FAILED');
    outcome = safe.code;
    throw safe;
  } finally {
    clearTimeout(timer);
    controller.abort();
    await part?.close().catch(() => {});
    if (partPath) await unlink(partPath).catch(() => {});
    if (finalPath) await unlink(finalPath).catch(() => {});
    options.logger.info({function: 'pluginfile', durationMs: Math.round(performance.now() - started), outcome, bytes});
  }
}
