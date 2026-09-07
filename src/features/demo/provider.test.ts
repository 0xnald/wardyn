import { expect, test } from 'vitest';
import { DemoProvider, scenarios, type Scenario } from './provider';
import { calculatePortfolio } from '../../domain/portfolio';
test('scenarios produce complete portfolios through real calculations', async () => {
  for (const scenario of Object.keys(scenarios) as Scenario[]) {
    const provider = new DemoProvider(scenario);
    const p = calculatePortfolio(
      await provider.getBalances(),
      await provider.getMarketSnapshots(),
      'demo',
    );
    expect(Number(p.totalValueUsdt)).toBeCloseTo(10000, 5);
    if (scenario === 'concentration') expect(p.positions[2].allocationPct).toBeCloseTo(34);
    if (scenario === 'deterioration') expect(p.positions[2].drawdownPct).toBeCloseTo(36);
  }
});
