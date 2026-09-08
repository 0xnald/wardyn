import type { AssetBalance, MarketSnapshot, Portfolio, TradeIntent } from '../../domain/models';
export type ProviderCapabilities = {
  accountRead: boolean;
  marketData: boolean;
  spotExecution: boolean;
  executionMode: 'simulation' | 'monitor_only' | 'approval_required';
  environment: Portfolio['environment'];
  integration: 'demo' | 'binance-skills-cli';
};
export type AccountSnapshot = {
  balances: AssetBalance[];
  unvaluedAssets: Portfolio['unvaluedAssets'];
  canTrade: boolean;
  observedAt: string;
};
export type TradeResult = NonNullable<import('../../domain/models').WardynReceipt['execution']>;
export interface WardynExchangeProvider {
  readonly source: 'demo' | 'binance-cli' | 'binance-mcp' | 'binance-public';
  capabilities(): ProviderCapabilities;
  getAccount(): Promise<AccountSnapshot>;
  getBalances(): Promise<AssetBalance[]>;
  getMarketSnapshots(assets?: string[]): Promise<MarketSnapshot[]>;
  prepareTrade(
    input: TradeIntent,
  ): Promise<{ intent: TradeIntent; execution: ProviderCapabilities['executionMode'] }>;
  executeTrade?(input: TradeIntent, idempotencyKey: string): Promise<TradeResult>;
}
export type BinanceProvider = WardynExchangeProvider;
