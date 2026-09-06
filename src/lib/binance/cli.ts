import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { assetSchema, decimalString, type AssetBalance, type MarketSnapshot, type TradeIntent } from '../../domain/models';
import type { BinanceProvider } from './provider';
import { parseMarket } from './market';
const exec = promisify(execFile);
const accountSchema = z.object({ balances: z.array(z.object({ asset: z.string(), free: decimalString, locked: decimalString })) });
export function parseBalances(input: unknown): AssetBalance[] {
  return accountSchema.parse(input).balances.filter(b => new Decimal(b.free).plus(b.locked).gt(0)).map(b => {
    const asset = assetSchema.safeParse(b.asset);
    if (!asset.success) throw new Error(`Account contains unsupported asset ${b.asset}; refusing a partial portfolio valuation.`);
    return { asset: asset.data, quantity: new Decimal(b.free).plus(b.locked).toFixed(8) };
  });
}
export class BinanceCliProvider implements BinanceProvider {
  readonly source = 'binance-cli' as const;
  private async read(command: 'get-account' | 'ticker24hr' | 'klines', args: string[] = []): Promise<unknown> {
    if (process.env.WARDYN_BINANCE_READ_ENABLED !== 'true') throw new Error('Binance account reads are not enabled on this server.');
    try {
      const { stdout } = await exec(process.env.WARDYN_BINANCE_CLI_PATH || 'binance-cli', ['spot', command, ...args], { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true });
      return JSON.parse(stdout);
    } catch { throw new Error('Binance CLI read failed. Verify CLI installation, account permissions and environment.'); }
  }
  async getBalances() { return parseBalances(await this.read('get-account')); }
  async getMarketSnapshots(): Promise<MarketSnapshot[]> {
    const markets = await Promise.all((['BTC', 'BNB', 'SOL'] as const).map(async asset => {
      const [ticker, candles] = await Promise.all([this.read('ticker24hr', ['--symbol', `${asset}USDT`]), this.read('klines', ['--symbol', `${asset}USDT`, '--interval', '1h', '--limit', '25'])]);
      return parseMarket(asset, ticker, candles);
    }));
    return [...markets, { asset: 'USDT', priceUsdt: '1', change24hPct: 0, volatilityPct: 0, volume24hUsdt: '0', observedAt: new Date().toISOString() }];
  }
  async prepareTrade(intent: TradeIntent) { return { intent, execution: 'unavailable' as const }; }
}
