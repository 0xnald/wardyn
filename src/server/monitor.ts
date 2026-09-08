import type { BinanceProvider } from '../lib/binance/provider';
import { calculatePortfolio } from '../domain/portfolio';
import { assessRisk } from '../domain/evaluate';
import { decide } from '../domain/decisions';
import { createReceipt } from '../domain/actions';
import type { WardynPolicy } from '../domain/policy';
import type { MonitoringRun, Portfolio, WardynReceipt } from '../domain/models';

export function analyze(
  portfolio: Portfolio,
  policy: WardynPolicy,
  history: WardynReceipt[],
  now = new Date(),
) {
  const events: MonitoringRun['events'] = [];
  const log = (stage: string, message: string) =>
    events.push({ stage, message, timestamp: now.toISOString() });
  log(
    'OBSERVE',
    `${portfolio.source === 'demo' ? 'Demo portfolio' : `Binance ${portfolio.environment} Spot account`} loaded; market snapshots validated`,
  );
  log('ANALYZE', `${portfolio.positions.length} positions analyzed against the active policy`);
  const risk = assessRisk(portfolio, policy);
  const decisions = decide(portfolio, policy, history, now);
  log(
    'DECIDE',
    `${decisions.filter((d) => d.trade).length} interventions proposed; risk ${risk.level.toLowerCase()}`,
  );
  const receipts = decisions
    .filter((d) => !d.cooldown)
    .filter(
      (d) =>
        d.trade ||
        !history.some(
          (r) =>
            r.status === 'HOLD' &&
            r.decision.asset === d.asset &&
            now.getTime() - Date.parse(r.createdAt) < policy.cooldownMinutes * 60000,
        ),
    )
    .map((d) => createReceipt(d, portfolio, policy, now));
  log(
    'ACT',
    decisions.some((d) => d.trade)
      ? 'Awaiting user approval. No funds moved.'
      : 'Hold positions. No funds moved.',
  );
  log('RECEIPT', `${receipts.length} decision receipts recorded`);
  log('COMPLETE', 'Portfolio scan completed');
  return {
    portfolio,
    receipts,
    run: {
      id: crypto.randomUUID(),
      startedAt: now.toISOString(),
      events,
      decisions,
      risk,
    } satisfies MonitoringRun,
  };
}

export async function observe(
  provider: BinanceProvider,
  policy: WardynPolicy,
  history: WardynReceipt[],
  now = new Date(),
) {
  const account = await provider.getAccount();
  const balances = account.balances;
  const snapshots = await provider.getMarketSnapshots(balances.map((balance) => balance.asset));
  const capabilities = provider.capabilities();
  return analyze(
    calculatePortfolio(balances, snapshots, provider.source, now, {
      environment: capabilities.environment,
      unvaluedAssets: account.unvaluedAssets,
    }),
    policy,
    history,
    now,
  );
}
