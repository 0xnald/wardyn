import { expect, test } from 'vitest';
import { balanceSchema, snapshotSchema } from './models';
test('rejects negative balances and malformed asset symbols', () => {
  expect(balanceSchema.safeParse({ asset: 'BTC', quantity: '-1' }).success).toBe(false);
  expect(balanceSchema.safeParse({ asset: 'bad/token', quantity: '1' }).success).toBe(false);
});
test('rejects zero prices before financial calculations', () => {
  expect(
    snapshotSchema.safeParse({
      asset: 'BTC',
      priceUsdt: '0',
      volume24hUsdt: '0',
      volatilityPct: 0,
      change24hPct: 0,
      observedAt: new Date().toISOString(),
    }).success,
  ).toBe(false);
});
