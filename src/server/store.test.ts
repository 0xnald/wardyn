import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { StateStore } from './store';
test('serializes concurrent writes and preserves independent sessions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'wardyn-test-'));
  try {
    const store = new StateStore(directory); const session = crypto.randomUUID();
    await Promise.all(Array.from({ length: 4 }, () => store.update(session, async s => { s.revision += 1; })));
    expect(await store.update(session, async s => s.revision)).toBe(4);
    expect(await store.update(crypto.randomUUID(), async s => s.revision)).toBe(0);
    await expect(store.update('../escape', async () => 0)).rejects.toThrow('Invalid session');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
