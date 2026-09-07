import type { AssetBalance, MarketSnapshot, TradeIntent } from '../../domain/models';
export interface BinanceProvider {
  readonly source: 'demo' | 'binance-cli' | 'binance-mcp' | 'binance-public';
  getBalances(): Promise<AssetBalance[]>;
  getMarketSnapshots(): Promise<MarketSnapshot[]>;
  prepareTrade(
    input: TradeIntent,
  ): Promise<{ intent: TradeIntent; execution: 'simulation_only' | 'unavailable' }>;
}
