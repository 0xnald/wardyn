import { expect, test } from 'vitest';
import { parseAccount, parseBalances } from './cli';
import { parseMarket } from './market';
test('account adapter includes locked balances and accepts dynamic assets', () => {
  expect(
    parseBalances({ balances: [{ asset: 'BTC', free: '0.1', locked: '0.2' }] })[0].quantity,
  ).toBe('0.30000000');
  expect(parseBalances({ balances: [{ asset: 'DOGE', free: '10', locked: '0' }] })[0].asset).toBe(
    'DOGE',
  );
});
test('account adapter separates assets without a direct USDT market', () => {
  const result = parseAccount(
    {
      canTrade: true,
      balances: [
        { asset: 'DOGE', free: '10', locked: '0' },
        { asset: 'ODD', free: '2', locked: '0' },
      ],
    },
    [{ symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT', status: 'TRADING', filters: [] }],
  );
  expect(result.balances.map((balance) => balance.asset)).toEqual(['DOGE']);
  expect(result.unvaluedAssets).toEqual([
    { asset: 'ODD', quantity: '2.00000000', reason: 'No active direct USDT Spot market' },
  ]);
  expect(result.canTrade).toBe(true);
});
test('market adapter checks symbol and validates numerical evidence', () => {
  const ticker = {
    symbol: 'BTCUSDT',
    lastPrice: '100',
    priceChangePercent: '2',
    quoteVolume: '100000',
    closeTime: Date.now(),
  };
  const candles = [100, 102, 98, 100].map((close, i) => [
    i,
    '100',
    '110',
    '90',
    String(close),
    '10',
    i + 1,
  ]);
  expect(parseMarket('BTC', ticker, candles).volatilityPct).toBeGreaterThan(0);
  expect(() => parseMarket('SOL', ticker, candles)).toThrow('Unexpected');
  expect(() => parseMarket('BTC', { ...ticker, lastPrice: '0' }, candles)).toThrow();
});
