import Decimal from 'decimal.js';
import { calculatePortfolio, money, portfolioInputs } from './portfolio';
import { evaluatePolicy } from './evaluate';
import type { Portfolio, TradeIntent, WardynDecision, WardynReceipt } from './models';
import type { WardynPolicy } from './policy';

export function simulateSale(before: Portfolio, trade: TradeIntent, policy: WardynPolicy, now = new Date()): Portfolio {
  if (before.source !== 'demo') throw new Error('Only demo portfolios support simulated execution');
  const position = before.positions.find(p => p.asset === trade.asset);
  if (!position || trade.side !== 'SELL') throw new Error('Invalid sale');
  const quantity = new Decimal(trade.quantity);
  if (!quantity.isFinite() || quantity.lte(0) || quantity.gt(position.quantity)) throw new Error('Invalid sale quantity');
  if (quantity.div(position.quantity).mul(100).gt(policy.maxActionPct + 0.000001)) throw new Error('Action size exceeds policy');
  const { balances, snapshots } = portfolioInputs(before, now);
  const balance = balances.find(b => b.asset === trade.asset)!;
  balance.quantity = money(new Decimal(balance.quantity).minus(quantity));
  let stable = balances.find(b => b.asset === 'USDT');
  if (!stable) { stable = { asset: 'USDT', quantity: '0', entryPriceUsdt: undefined, peakPriceUsdt: undefined }; balances.push(stable); snapshots.push({ asset: 'USDT', priceUsdt: '1', change24hPct: 0, volatilityPct: 0, volume24hUsdt: '0', observedAt: now.toISOString() }); }
  stable.quantity = money(new Decimal(stable.quantity).plus(quantity.mul(position.priceUsdt)));
  return calculatePortfolio(balances, snapshots, 'demo', now);
}

export function createReceipt(decision: WardynDecision, before: Portfolio, policy: WardynPolicy, now = new Date()): WardynReceipt {
  return { id: crypto.randomUUID(), createdAt: now.toISOString(), decision: structuredClone(decision), before: structuredClone(before), expectedAfter: decision.trade && before.source === 'demo' ? simulateSale(before, decision.trade, policy, now) : null, after: null, status: decision.trade ? 'PENDING' : 'HOLD', verified: null, verification: null };
}

export function approveReceipt(receipt: WardynReceipt, current: Portfolio, policy: WardynPolicy, now = new Date()): WardynReceipt {
  if (receipt.status !== 'PENDING' || !receipt.decision.trade) throw new Error('This action is no longer pending');
  if (now.getTime() - Date.parse(receipt.createdAt) > 120000) throw new Error('Proposal expired. Run a new scan.');
  if (JSON.stringify(current.positions) !== JSON.stringify(receipt.before.positions)) throw new Error('Portfolio changed. Run a new scan.');
  const after = simulateSale(current, receipt.decision.trade, policy, now);
  const remaining = evaluatePolicy(after, policy);
  const unresolved = receipt.decision.triggers.filter(trigger => remaining.some(v => v.asset === trigger.asset && v.rule === trigger.rule));
  // Profit scaling is an intervention milestone; PnL percentage need not drop after selling.
  const actionable = unresolved.filter(v => v.rule !== 'profit');
  return { ...structuredClone(receipt), status: 'SIMULATED', after, verified: actionable.length === 0, verification: actionable.length ? 'Action simulated; some triggered limits remain breached. Cooldown prevents immediate repeated execution.' : 'Action simulated and triggered allocation / reserve / loss rules resolved. Profit scaling records a partial realization, not a lower return percentage.' };
}
