import { expect, test } from 'vitest';
import { DemoProvider, type Scenario } from '../features/demo/provider';
import { calculatePortfolio } from './portfolio';
import { defaultPolicy } from './policy';
import { assessRisk, evaluatePolicy } from './evaluate';
async function fixture(s: Scenario) {
  const p = new DemoProvider(s);
  return calculatePortfolio(await p.getBalances(), await p.getMarketSnapshots(), 'demo');
}
test('detects concentration and stable reserve separately', async () => {
  expect(evaluatePolicy(await fixture('concentration'), defaultPolicy).map((v) => v.rule)).toEqual([
    'concentration',
    'reserve',
  ]);
});
test('healthy portfolio has no false violations', async () => {
  expect(evaluatePolicy(await fixture('balanced'), defaultPolicy)).toEqual([]);
});
test('risk responds transparently to concentration and severe drawdown', async () => {
  const safe = assessRisk(await fixture('balanced'), defaultPolicy);
  expect(['LOW', 'MODERATE']).toContain(safe.level);
  expect(assessRisk(await fixture('concentration'), defaultPolicy).score).toBeGreaterThan(
    safe.score,
  );
  expect(assessRisk(await fixture('deterioration'), defaultPolicy).score).toBeGreaterThan(
    safe.score,
  );
  expect(safe.breakdown).toHaveLength(4);
});
