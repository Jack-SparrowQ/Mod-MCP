import { lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, win32, posix } from 'node:path';
import { MoodleError } from '../../domain/errors.js';
import type { SubmissionFiles, LocalSubmissionFile, UploadFile } from '../../domain/submission.js';
import { isWithinPath, samePath } from '../../shared/path-containment.js';

const invalid = () => new MoodleError('VALIDATION_ERROR', 'Use distinct, non-empty regular files inside submissions/.');
export class LocalSubmissionFiles implements SubmissionFiles {
  constructor(private readonly root: string) {}
  private async checkedPath(name: string) {
    const filename = posix.basename(name.replace(/\\/g, '/'));
    if (/['&`"*:<>?|\\/\x00-\x1f\x7f-\x9f]/.test(filename)) throw new MoodleError('VALIDATION_ERROR',
      'The filename contains characters Moodle would change.', {reason: 'filename_characters'}, 'Rename the file to remove characters Moodle would change.');
    if (!name || /[\x00-\x1f]/.test(name) || /^[a-z][a-z0-9+.-]*:/i.test(name) || win32.isAbsolute(name) || posix.isAbsolute(name)) throw invalid();
    const parts = name.replace(/\\/g, '/').split('/');
    if (parts.some(part => part === '..' || part === '' || part === '.' || /[<>:"|?*]/.test(part))) throw invalid();
    if ((await lstat(this.root)).isSymbolicLink()) throw invalid();
    const root = resolve(await realpath(this.root));
    let path = root;
    for (const part of parts) {
      path = resolve(path, part);
      if (samePath(path, root) || !isWithinPath(root, path) || (await lstat(path)).isSymbolicLink()) throw invalid();
    }
    const fileReal = resolve(await realpath(path));
    if (!(await lstat(path)).isFile() || samePath(fileReal, root) || !isWithinPath(root, fileReal)) throw invalid();
    return fileReal;
  }
  private async read(name: string, snapshot: boolean) {
    try {
      const path = await this.checkedPath(name);
      const before = await lstat(path);
      const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || !stat.size || stat.ino !== before.ino || stat.dev !== before.dev || !samePath(await this.checkedPath(name), path)) throw invalid();
        const hash = createHash('sha256');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of handle.createReadStream({autoClose: false})) {
          hash.update(chunk); size += chunk.length;
          if (snapshot) chunks.push(chunk);
        }
        const after = await handle.stat();
        if (size !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || !samePath(await this.checkedPath(name), path)) throw invalid();
        return {name, filename: posix.basename(name.replace(/\\/g, '/')), size, sha256: hash.digest('hex'),
          ...(snapshot ? {bytes: Buffer.concat(chunks)} : {})};
      } finally { await handle.close(); }
    } catch (error) { if (error instanceof MoodleError) throw error; throw invalid(); }
  }
  async inspect(names: string[]): Promise<LocalSubmissionFile[]> {
    const files: LocalSubmissionFile[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const file = await this.read(name, false);
      // Duplicate basenames would replace each other in the draft file manager.
      const key = file.filename.toLowerCase();
      if (seen.has(key)) throw invalid();
      seen.add(key); files.push(file);
    }
    return files;
  }
  async readVerified(files: LocalSubmissionFile[]): Promise<UploadFile[]> {
    const result: UploadFile[] = [];
    for (const expected of files) {
      const actual = await this.read(expected.name, true);
      if (actual.size !== expected.size || actual.sha256 !== expected.sha256) throw new MoodleError('VALIDATION_ERROR', 'A submission file changed after confirmation.');
      result.push(actual as UploadFile);
    }
    return result;
  }
}
