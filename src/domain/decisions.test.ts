import { expect, test } from 'vitest';
import { DemoProvider, type Scenario } from '../features/demo/provider';
import { calculatePortfolio } from './portfolio';
import { defaultPolicy } from './policy';
import { decide } from './decisions';
import type { WardynReceipt } from './models';
async function portfolio(s: Scenario) { const p = new DemoProvider(s); return calculatePortfolio(await p.getBalances(), await p.getMarketSnapshots(), 'demo'); }
test.each([['balanced','HOLD'],['drawdown','HOLD'],['concentration','REDUCE'],['reserve','REBALANCE'],['deterioration','EXIT']] as const)('%s produces %s through the actual engine', async (s, kind) => {
  const d = decide(await portfolio(s), defaultPolicy);
  expect(d.map(d => d.decision)).toContain(kind);
  if (kind === 'HOLD') expect(d.every(d => !d.trade)).toBe(true);
});
test('maximum action size constrains severe exits', async () => {
  const d = decide(await portfolio('deterioration'), { ...defaultPolicy, maxActionPct: 20 });
  expect(d.find(d => d.asset === 'SOL')?.decision).toBe('REDUCE');
  expect(d.find(d => d.asset === 'SOL')?.trade?.positionPct).toBeLessThanOrEqual(20);
});
test('pending intervention cannot be duplicated', async () => {
  const p = await portfolio('concentration'); const decision = decide(p, defaultPolicy).find(d => d.asset === 'SOL')!;
  const history: WardynReceipt[] = [{ id: 'test', createdAt: new Date().toISOString(), decision, before: p, expectedAfter: null, after: null, status: 'PENDING', verified: null, verification: null }];
  expect(decide(p, defaultPolicy, history).find(d => d.asset === 'SOL')?.cooldown).toBe(true);
});
