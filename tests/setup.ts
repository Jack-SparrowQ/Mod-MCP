import { afterEach, beforeEach, vi } from 'vitest';
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden in tests'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
