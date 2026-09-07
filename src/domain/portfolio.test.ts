import { expect, test } from 'vitest';
import { calculatePortfolio } from './portfolio';
import type { MarketSnapshot } from './models';
const now = new Date('2026-09-06T12:00:00Z');
const snapshot: MarketSnapshot = {
  asset: 'BTC',
  priceUsdt: '0.1',
  change24hPct: 0,
  volatilityPct: 1,
  volume24hUsdt: '100',
  observedAt: now.toISOString(),
};
test('uses decimal arithmetic and preserves unknown PnL', () => {
  const p = calculatePortfolio([{ asset: 'BTC', quantity: '3' }], [snapshot], 'demo', now);
  expect(p.totalValueUsdt).toBe('0.30000000');
  expect(p.positions[0].pnlPct).toBeNull();
  expect(p.positions[0].allocationPct).toBe(100);
});
test('rejects stale data and duplicate balances', () => {
  expect(() =>
    calculatePortfolio(
      [{ asset: 'BTC', quantity: '1' }],
      [snapshot],
      'demo',
      new Date('2026-09-06T13:00:00Z'),
    ),
  ).toThrow('Stale');
  expect(() =>
    calculatePortfolio(
      [
        { asset: 'BTC', quantity: '1' },
        { asset: 'BTC', quantity: '2' },
      ],
      [snapshot],
      'demo',
      now,
    ),
  ).toThrow('Duplicate');
});
test('empty portfolio stays finite', () => {
  expect(calculatePortfolio([], [], 'demo', now).stableReservePct).toBe(0);
});
