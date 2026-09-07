import { z } from 'zod';
import { assetSchema, decimalString, type Asset, type MarketSnapshot } from '../../domain/models';
const tickerSchema = z.object({
  symbol: z.string(),
  lastPrice: decimalString.refine((v) => Number(v) > 0),
  priceChangePercent: z.coerce.number().finite(),
  quoteVolume: decimalString,
  closeTime: z.number().finite(),
});
const candleSchema = z
  .array(
    z
      .tuple([
        z.number(),
        decimalString,
        decimalString,
        decimalString,
        decimalString,
        decimalString,
        z.number(),
      ])
      .rest(z.unknown()),
  )
  .min(3);

export function parseMarket(
  asset: Asset,
  tickerInput: unknown,
  candlesInput: unknown,
): MarketSnapshot {
  const ticker = tickerSchema.parse(tickerInput);
  if (ticker.symbol !== `${asset}USDT`) throw new Error('Unexpected market symbol');
  const candles = candleSchema.parse(candlesInput);
  const closes = candles.filter((c) => c[6] <= ticker.closeTime).map((c) => Number(c[4]));
  if (closes.length < 3 || closes.some((c) => c <= 0))
    throw new Error('Insufficient valid candles');
  const returns = closes.slice(1).map((price, i) => Math.log(price / closes[i]));
  const mean = returns.reduce((sum, n) => sum + n, 0) / returns.length;
  const volatilityPct =
    Math.sqrt(returns.reduce((sum, n) => sum + (n - mean) ** 2, 0) / returns.length) * 100;
  return {
    asset,
    priceUsdt: ticker.lastPrice,
    change24hPct: ticker.priceChangePercent,
    volume24hUsdt: ticker.quoteVolume,
    volatilityPct,
    observedAt: new Date(ticker.closeTime).toISOString(),
  };
}

export async function publicSnapshots(): Promise<MarketSnapshot[]> {
  const get = async (path: string) => {
    const response = await fetch(`https://api.binance.com/api/v3/${path}`, {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Binance public data unavailable (HTTP ${response.status})`);
    return response.json() as Promise<unknown>;
  };
  return Promise.all(
    ['BTC', 'BNB', 'SOL'].map(async (raw) => {
      const asset = assetSchema.parse(raw);
      const [ticker, candles] = await Promise.all([
        get(`ticker/24hr?symbol=${asset}USDT`),
        get(`klines?symbol=${asset}USDT&interval=1h&limit=25`),
      ]);
      return parseMarket(asset, ticker, candles);
    }),
  );
}
