import { expect, test } from 'vitest';
import { DemoProvider, type Scenario } from '../features/demo/provider';
import { calculatePortfolio } from './portfolio';
import { defaultPolicy } from './policy';
import { decide } from './decisions';
import type { WardynReceipt } from './models';
async function portfolio(s: Scenario) {
  const p = new DemoProvider(s);
  return calculatePortfolio(await p.getBalances(), await p.getMarketSnapshots(), 'demo');
}
test.each([
  ['balanced', 'HOLD'],
  ['drawdown', 'HOLD'],
  ['concentration', 'REDUCE'],
  ['reserve', 'REBALANCE'],
  ['deterioration', 'EXIT'],
] as const)('%s produces %s through the actual engine', async (s, kind) => {
  const d = decide(await portfolio(s), defaultPolicy);
  expect(d.map((d) => d.decision)).toContain(kind);
  if (kind === 'HOLD') expect(d.every((d) => !d.trade)).toBe(true);
});
test('maximum action size constrains severe exits', async () => {
  const d = decide(await portfolio('deterioration'), { ...defaultPolicy, maxActionPct: 20 });
  expect(d.find((d) => d.asset === 'SOL')?.decision).toBe('REDUCE');
  expect(d.find((d) => d.asset === 'SOL')?.trade?.positionPct).toBeLessThanOrEqual(20);
});
test('pending intervention cannot be duplicated', async () => {
  const p = await portfolio('concentration');
  const decision = decide(p, defaultPolicy).find((d) => d.asset === 'SOL')!;
  const history: WardynReceipt[] = [
    {
      id: 'test',
      createdAt: new Date().toISOString(),
      decision,
      before: p,
      expectedAfter: null,
      after: null,
      status: 'PENDING',
      verified: null,
      verification: null,
    },
  ];
  expect(decide(p, defaultPolicy, history).find((d) => d.asset === 'SOL')?.cooldown).toBe(true);
});

test('profit taking scales out only the configured fraction', async () => {
  const p = await portfolio('balanced');
  p.positions.find((p) => p.asset === 'SOL')!.pnlPct = 60;
  const d = decide(p, defaultPolicy).find((d) => d.asset === 'SOL')!;
  expect(d.decision).toBe('REDUCE');
  expect(d.trade?.positionPct).toBe(defaultPolicy.profitScalePct);
});

test('missing entry and peak history cannot claim complete protection', async () => {
  const p = await portfolio('balanced');
  p.positions.forEach((p) => {
    p.pnlPct = null;
    p.drawdownPct = null;
  });
  expect(decide(p, defaultPolicy).every((d) => d.confidence === 'INSUFFICIENT_DATA')).toBe(true);
});

test('cooldown starts when a proposal is resolved', async () => {
  const p = await portfolio('concentration');
  const decision = decide(p, defaultPolicy).find((d) => d.asset === 'SOL')!;
  const history: WardynReceipt[] = [
    {
      id: 'resolved',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      resolvedAt: new Date().toISOString(),
      decision,
      before: p,
      expectedAfter: null,
      after: null,
      status: 'REJECTED',
      verified: null,
      verification: null,
    },
  ];
  expect(decide(p, defaultPolicy, history).find((d) => d.asset === 'SOL')?.cooldown).toBe(true);
});
