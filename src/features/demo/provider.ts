import type { Asset, AssetBalance, MarketSnapshot, TradeIntent } from '../../domain/models';
import type { BinanceProvider } from '../../lib/binance/provider';
export const scenarios = {
  balanced: { name: 'Quiet market', description: 'Positions remain within your rules. Holding is an active decision.', values: [2800, 2600, 2800, 1800], changes: [1.2, 0.4, 1.8, 0], drawdowns: [2, 3, 1, 0], volatility: 2 },
  concentration: { name: 'SOL concentration', description: 'SOL rallies to 34%. Take only enough off the table to restore balance.', values: [2800, 2500, 3400, 1300], changes: [1.2, 0.4, 12.6, 0], drawdowns: [2, 3, 0, 0], volatility: 4 },
  drawdown: { name: 'Market pullback', description: 'A broad decline, with every position still inside the loss threshold.', values: [2700, 2500, 2800, 2000], changes: [-4.2, -5.1, -6.8, 0], drawdowns: [8, 10, 12, 0], volatility: 5 },
  deterioration: { name: 'Severe deterioration', description: 'SOL falls 36% from its tracked peak. Loss protection takes priority.', values: [2900, 2800, 2300, 2000], changes: [-2, -1, -24, 0], drawdowns: [4, 3, 36, 0], volatility: 13 },
  reserve: { name: 'Reserve shortfall', description: 'Stable reserves fall to 10%. Restore the liquidity buffer.', values: [3000, 3000, 3000, 1000], changes: [0, 0, 0, 0], drawdowns: [1, 1, 1, 0], volatility: 2 },
} as const;
export type Scenario = keyof typeof scenarios;
export class DemoProvider implements BinanceProvider {
  readonly source = 'demo' as const;
  constructor(readonly scenario: Scenario = 'balanced', private now = new Date()) {}
  async getBalances(): Promise<AssetBalance[]> {
    const s = scenarios[this.scenario];
    return (['BTC', 'BNB', 'SOL', 'USDT'] as Asset[]).map((asset, i) => ({ asset, quantity: String(s.values[i] / [100000, 600, 200, 1][i]), entryPriceUsdt: String([95000, 580, 160, 1][i]), peakPriceUsdt: String([100000, 600, 200, 1][i] / (1 - s.drawdowns[i] / 100)) }));
  }
  async getMarketSnapshots(): Promise<MarketSnapshot[]> {
    const s = scenarios[this.scenario];
    return (['BTC', 'BNB', 'SOL', 'USDT'] as Asset[]).map((asset, i) => ({ asset, priceUsdt: String([100000, 600, 200, 1][i]), change24hPct: s.changes[i], volatilityPct: asset === 'USDT' ? 0 : s.volatility, volume24hUsdt: String([1500000000, 600000000, 900000000, 0][i]), observedAt: this.now.toISOString() }));
  }
  async prepareTrade(intent: TradeIntent) { return { intent, execution: 'simulation_only' as const }; }
}
