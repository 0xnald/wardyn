import { expect, test } from 'vitest';
import { observe, analyze } from './monitor';
import { DemoProvider } from '../features/demo/provider';
import { defaultPolicy } from '../domain/policy';
test('monitor records its loop and suppresses duplicate pending receipts', async () => {
  const first = await observe(new DemoProvider('concentration'), defaultPolicy, []);
  expect(first.run.events.map((e) => e.stage)).toContain('DECIDE');
  expect(first.receipts.some((r) => r.status === 'PENDING')).toBe(true);
  const second = analyze(first.portfolio, defaultPolicy, first.receipts);
  expect(second.receipts.filter((r) => r.decision.asset === 'SOL')).toHaveLength(0);
  expect(second.run.decisions.some((d) => d.trade)).toBe(false);
});
