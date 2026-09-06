import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MonitoringRun, Portfolio, WardynReceipt } from '../domain/models';
import { defaultPolicy, type WardynPolicy } from '../domain/policy';
import { DemoProvider, type Scenario } from '../features/demo/provider';
import { observe } from './monitor';

export type WardynState = { version: 1; policy: WardynPolicy; policyConfirmed: boolean; portfolio: Portfolio; scenario: Scenario; receipts: WardynReceipt[]; runs: MonitoringRun[]; monitoring: boolean; revision: number };
export async function initialState(): Promise<WardynState> {
  const first = await observe(new DemoProvider(), defaultPolicy, []);
  return { version: 1, policy: { ...defaultPolicy }, policyConfirmed: false, portfolio: first.portfolio, scenario: 'balanced', receipts: first.receipts, runs: [first.run], monitoring: false, revision: 0 };
}
const queues = new Map<string, Promise<unknown>>();
export class StateStore {
  constructor(private directory = path.join(process.cwd(), '.wardyn')) {}
  async update<T>(session: string, operation: (state: WardynState) => Promise<T>): Promise<T> {
    if (!/^[0-9a-f-]{36}$/i.test(session)) throw new Error('Invalid session');
    const key = `${this.directory}/${session}`;
    const previous = queues.get(key) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(async () => {
      await mkdir(this.directory, { recursive: true });
      const file = path.join(this.directory, `${session}.json`);
      let state: WardynState;
      try {
        state = JSON.parse(await readFile(file, 'utf8')) as WardynState;
        if (state.version !== 1 || !Array.isArray(state.receipts) || !state.portfolio) throw new Error('Unsupported saved state');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Saved session could not be read. Preserve the file before repairing it.');
        state = await initialState();
      }
      const result = await operation(state);
      const temp = `${file}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, file);
      return result;
    });
    queues.set(key, pending);
    try { return await pending; } finally { if (queues.get(key) === pending) queues.delete(key); }
  }
}
export const store = new StateStore();
