import { expect, test } from 'vitest';
import { initialState } from './store';
import {
  action,
  activatePolicy,
  connectAccount,
  executeLiveReceipt,
  runScenario,
  scan,
} from './service';
import type { BinanceProvider } from '../lib/binance/provider';
import type { AssetBalance, MarketSnapshot, TradeIntent } from '../domain/models';

class TestBinanceProvider implements BinanceProvider {
  readonly source = 'binance-cli' as const;
  calls = 0;
  executed = false;
  constructor(
    private trading = true,
    private fail = false,
  ) {}
  capabilities() {
    return {
      accountRead: true,
      marketData: true,
      spotExecution: this.trading,
      executionMode: this.trading ? ('approval_required' as const) : ('monitor_only' as const),
      environment: 'mainnet' as const,
      integration: 'binance-skills-cli' as const,
    };
  }
  async getAccount() {
    if (this.fail) throw new Error('Authenticated Binance read failed');
    this.calls += 1;
    const sold = this.executed;
    const balances: AssetBalance[] = [
      { asset: 'BTC', quantity: sold ? '0.029' : '0.045' },
      { asset: 'BNB', quantity: '3.66666667' },
      { asset: 'SOL', quantity: '9' },
      { asset: 'USDT', quantity: sold ? '3100' : '1500' },
    ];
    return {
      balances,
      unvaluedAssets: [],
      canTrade: this.trading,
      observedAt: new Date().toISOString(),
    };
  }
  async getBalances() {
    return (await this.getAccount()).balances;
  }
  async getMarketSnapshots(assets: string[]): Promise<MarketSnapshot[]> {
    return assets.map((asset) => ({
      asset,
      priceUsdt:
        asset === 'BTC' ? '100000' : asset === 'BNB' ? '600' : asset === 'SOL' ? '200' : '1',
      change24hPct: 0,
      volume24hUsdt: '100000',
      volatilityPct: 2,
      observedAt: new Date().toISOString(),
    }));
  }
  async prepareTrade(intent: TradeIntent) {
    return {
      intent,
      execution: this.trading ? ('approval_required' as const) : ('monitor_only' as const),
    };
  }
  async executeTrade(intent: TradeIntent, _idempotencyKey: string) {
    this.executed = true;
    return {
      provider: 'binance-cli' as const,
      environment: 'mainnet' as const,
      symbol: `${intent.asset}USDT`,
      side: 'SELL' as const,
      orderId: '987654',
      status: 'FILLED',
      executedQuantity: intent.quantity,
      cumulativeQuoteQuantity: '1600',
      executedAt: new Date().toISOString(),
    };
  }
}
test('full scenario to approval to verification persists a single intervention', async () => {
  const state = await initialState();
  await activatePolicy(state, state.policy);
  await runScenario(state, 'concentration');
  const pending = state.receipts.find((r) => r.status === 'PENDING')!;
  await action(state, pending.id, true);
  expect(state.portfolio.stableReservePct).toBeCloseTo(18);
  expect(state.receipts.find((r) => r.id === pending.id)?.status).toBe('SIMULATED');
  await expect(action(state, pending.id, true)).rejects.toThrow('no longer pending');
  await scan(state);
  expect(state.receipts.filter((r) => r.status === 'PENDING')).toHaveLength(0);
});
test('policy edits supersede old approvals', async () => {
  const state = await initialState();
  await runScenario(state, 'concentration');
  const id = state.receipts.find((r) => r.status === 'PENDING')!.id;
  await activatePolicy(state, {
    ...state.policy,
    maxAssetAllocationPct: 40,
    minStableReservePct: 10,
  });
  expect(state.receipts.find((r) => r.id === id)?.status).toBe('SUPERSEDED');
});

test('switching to Binance uses real provider state and supersedes demo proposals', async () => {
  const state = await initialState();
  await runScenario(state, 'concentration');
  const demoReceipt = state.receipts.find((receipt) => receipt.status === 'PENDING')!;
  await connectAccount(state, new TestBinanceProvider(false));
  expect(state.mode).toBe('binance');
  expect(state.portfolio.source).toBe('binance-cli');
  expect(state.connection.status).toBe('CONNECTED');
  expect(state.connection.canTrade).toBe(false);
  expect(state.receipts.find((receipt) => receipt.id === demoReceipt.id)?.status).toBe(
    'SUPERSEDED',
  );
});

test('Binance connection errors are persisted without demo fallback', async () => {
  const state = await initialState();
  await connectAccount(state, new TestBinanceProvider(false, true));
  expect(state.mode).toBe('demo');
  expect(state.connection.status).toBe('ERROR');
  expect(state.connection.message).toContain('Authenticated Binance read failed');
  expect(state.portfolio.source).toBe('demo');
});

test('read-only mode and stale quotes prevent live execution', async () => {
  const state = await initialState();
  const provider = new TestBinanceProvider(false);
  await connectAccount(state, provider);
  const index = state.receipts.findIndex((receipt) => receipt.status === 'PENDING');
  await expect(executeLiveReceipt(state, index, provider)).rejects.toThrow('disabled');
  const trading = new TestBinanceProvider(true);
  state.receipts[index].before.observedAt = new Date(Date.now() - 180000).toISOString();
  await expect(executeLiveReceipt(state, index, trading)).rejects.toThrow('stale');
  expect(trading.executed).toBe(false);
});

test('approved live execution is verified from refreshed balances and preserves order identity', async () => {
  const state = await initialState();
  const provider = new TestBinanceProvider(true);
  await connectAccount(state, provider);
  const index = state.receipts.findIndex((receipt) => receipt.status === 'PENDING');
  expect(index).toBeGreaterThanOrEqual(0);
  await executeLiveReceipt(state, index, provider);
  expect(state.receipts[index].status).toBe('EXECUTED');
  expect(state.receipts[index].execution?.orderId).toBe('987654');
  expect(state.receipts[index].after?.source).toBe('binance-cli');
  expect(state.receipts[index].verified).toBe(true);
});
