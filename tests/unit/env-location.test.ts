import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';

it.each(['src', 'dist'])('loads project-root env from %s with a different cwd; existing env wins', async directory => {
  // Exercise the actual entry's loading expression using Node's native loader.
  // Only isolated temporary fixture files are created, never the repository .env.
  const entry = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8');
  const call = entry.match(/process\.loadEnvFile\([^;]+\);/)?.[0];
  expect(call).toBeDefined();
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, 'moodle-env-location-'));
  try {
    await mkdir(join(root, directory));
    await mkdir(join(root, 'unrelated-cwd'));
    await writeFile(join(root, '.env'), 'PHASE1_REVIEW_VALUE=from-project\nPHASE1_REVIEW_EXISTING=from-file\n');
    await writeFile(join(root, 'unrelated-cwd', '.env'), 'PHASE1_REVIEW_VALUE=from-cwd\n');
    const modulePath = join(root, directory, 'entry.mjs');
    await writeFile(modulePath, `import { fileURLToPath } from 'node:url';\n${call}\n` +
      'console.log(JSON.stringify({value: process.env.PHASE1_REVIEW_VALUE, existing: process.env.PHASE1_REVIEW_EXISTING}));\n');
    const env = {...process.env, PHASE1_REVIEW_EXISTING: 'from-environment'};
    delete env.PHASE1_REVIEW_VALUE;
    const output = execFileSync(process.execPath, [modulePath], {
      cwd: join(root, 'unrelated-cwd'), env, encoding: 'utf8', timeout: 5000,
    });
    expect(JSON.parse(output)).toEqual({value: 'from-project', existing: 'from-environment'});
  } finally {
    // Verify the resolved recursive deletion target remains inside the temp root.
    if (!resolve(root).startsWith(temporaryBase + sep)) throw new Error('Unexpected temporary path.');
    await rm(root, {recursive: true, force: true});
  }
});
