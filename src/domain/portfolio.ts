import Decimal from 'decimal.js';
import {
  balanceSchema,
  snapshotSchema,
  type AssetBalance,
  type MarketSnapshot,
  type Portfolio,
} from './models';

export const money = (value: Decimal.Value) => new Decimal(value).toFixed(8);
export const percent = (part: Decimal.Value, total: Decimal.Value) =>
  new Decimal(total).isZero() ? 0 : new Decimal(part).div(total).mul(100).toNumber();

export function calculatePortfolio(
  balances: AssetBalance[],
  snapshots: MarketSnapshot[],
  source: Portfolio['source'],
  now = new Date(),
): Portfolio {
  const seen = new Set<string>();
  const parsed = balances.map((b) => balanceSchema.parse(b));
  const markets = snapshots.map((s) => snapshotSchema.parse(s));
  for (const b of parsed) {
    if (seen.has(b.asset)) throw new Error('Duplicate asset balance');
    seen.add(b.asset);
  }
  const valued = parsed.map((b) => {
    const market = markets.find((s) => s.asset === b.asset);
    if (!market) throw new Error(`Missing market data for ${b.asset}`);
    const age = now.getTime() - Date.parse(market.observedAt);
    if (age > 120_000 || age < -10_000)
      throw new Error(`Stale or future market data for ${b.asset}`);
    const price = new Decimal(market.priceUsdt);
    const entry =
      b.entryPriceUsdt && new Decimal(b.entryPriceUsdt).gt(0)
        ? new Decimal(b.entryPriceUsdt)
        : null;
    const peak =
      b.peakPriceUsdt && new Decimal(b.peakPriceUsdt).gt(0) ? new Decimal(b.peakPriceUsdt) : null;
    return {
      ...b,
      priceUsdt: money(price),
      valueUsdt: money(price.mul(b.quantity)),
      pnlPct: entry ? percent(price.minus(entry), entry) : null,
      pnlUsdt: entry ? money(price.minus(entry).mul(b.quantity)) : null,
      drawdownPct: peak ? Math.max(0, percent(peak.minus(price), peak)) : null,
      volatilityPct: market.volatilityPct,
      change24hPct: market.change24hPct,
    };
  });
  const total = valued.reduce((sum, p) => sum.plus(p.valueUsdt), new Decimal(0));
  const positions = valued.map((p) => ({ ...p, allocationPct: percent(p.valueUsdt, total) }));
  return {
    positions,
    totalValueUsdt: money(total),
    stableReservePct: positions.find((p) => p.asset === 'USDT')?.allocationPct ?? 0,
    source,
    observedAt: now.toISOString(),
  };
}

export function portfolioInputs(portfolio: Portfolio, now = new Date()) {
  return {
    balances: portfolio.positions.map((p) => ({
      asset: p.asset,
      quantity: p.quantity,
      entryPriceUsdt: p.entryPriceUsdt,
      peakPriceUsdt: p.peakPriceUsdt,
    })),
    snapshots: portfolio.positions.map((p) => ({
      asset: p.asset,
      priceUsdt: p.priceUsdt,
      change24hPct: p.change24hPct,
      volatilityPct: p.volatilityPct,
      volume24hUsdt: '0',
      observedAt: now.toISOString(),
    })),
  };
}
