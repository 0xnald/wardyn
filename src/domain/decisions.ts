import Decimal from 'decimal.js';
import { evaluatePolicy } from './evaluate';
import type { Asset, Portfolio, WardynDecision, WardynReceipt } from './models';
import { money, percent } from './portfolio';
import type { WardynPolicy } from './policy';

export function decide(
  portfolio: Portfolio,
  policy: WardynPolicy,
  history: WardynReceipt[] = [],
  now = new Date(),
): WardynDecision[] {
  const violations = evaluatePolicy(portfolio, policy);
  let reserveNeeded = new Decimal(portfolio.totalValueUsdt)
    .mul(Math.max(0, policy.minStableReservePct - portfolio.stableReservePct))
    .div(100);
  const positions = portfolio.positions
    .filter((p) => p.asset !== 'USDT' && new Decimal(p.quantity).gt(0))
    .sort((a, b) => b.allocationPct - a.allocationPct);
  return positions.map((p) => {
    const triggers = violations.filter((v) => v.asset === p.asset);
    const prior = history.filter((r) => r.decision.asset === p.asset);
    // A pending plan reserves the whole portfolio state. Do not layer new plans over it.
    const pending = history.some((r) => r.status === 'PENDING');
    const cooling =
      policy.overtradingProtection &&
      prior.some(
        (r) =>
          ['SIMULATED', 'REJECTED'].includes(r.status) &&
          now.getTime() - Date.parse(r.resolvedAt ?? r.createdAt) < policy.cooldownMinutes * 60000,
      );
    const evidence = [
      { label: 'Allocation', value: `${p.allocationPct.toFixed(2)}%` },
      { label: 'Maximum allocation', value: `${policy.maxAssetAllocationPct}%` },
      {
        label: 'Unrealized PnL',
        value: p.pnlPct === null ? 'Unknown entry price' : `${p.pnlPct.toFixed(2)}%`,
      },
      {
        label: 'Peak drawdown',
        value: p.drawdownPct === null ? 'Peak not tracked' : `${p.drawdownPct.toFixed(2)}%`,
      },
      { label: 'Volatility', value: `${p.volatilityPct.toFixed(2)}%` },
      { label: '24h movement', value: `${p.change24hPct.toFixed(2)}%` },
    ];
    const base: WardynDecision = {
      id: crypto.randomUUID(),
      asset: p.asset,
      decision: 'HOLD',
      confidence: 'RULE_CONFIRMED',
      reasons: [],
      evidence,
      triggers,
      trade: null,
      approvalRequired: false,
      cooldown: pending || cooling,
    };
    if (pending || cooling)
      return {
        ...base,
        reasons: [
          pending
            ? 'An intervention is already awaiting approval.'
            : 'Cooldown is active. A recent intervention prevents another action.',
        ],
      };
    let proceeds = new Decimal(0);
    let kind: WardynDecision['decision'] = 'HOLD';
    if (triggers.some((v) => v.rule === 'drawdown')) {
      const severe = (p.drawdownPct ?? 0) >= policy.maxPositionDrawdownPct * 1.5;
      proceeds = new Decimal(p.valueUsdt).mul(severe ? 1 : 0.25);
      kind = severe ? 'EXIT' : 'REDUCE';
    } else {
      if (triggers.some((v) => v.rule === 'concentration')) {
        proceeds = new Decimal(p.valueUsdt).minus(
          new Decimal(portfolio.totalValueUsdt)
            .mul(Math.max(0, policy.maxAssetAllocationPct - 1))
            .div(100),
        );
        kind = 'REDUCE';
      }
      if (triggers.some((v) => v.rule === 'profit')) {
        proceeds = Decimal.max(
          proceeds,
          new Decimal(p.valueUsdt).mul(policy.profitScalePct).div(100),
        );
        kind = 'REDUCE';
      }
    }
    if (reserveNeeded.gt(proceeds)) {
      proceeds = reserveNeeded;
      if (kind === 'HOLD') kind = 'REBALANCE';
      triggers.push(...violations.filter((v) => v.rule === 'reserve'));
    }
    proceeds = Decimal.min(proceeds, new Decimal(p.valueUsdt).mul(policy.maxActionPct).div(100));
    if (proceeds.lte(0)) {
      const missing =
        (policy.lossProtectionEnabled && p.drawdownPct === null) ||
        (policy.profitStrategy === 'scale_out' && p.pnlPct === null);
      const broad = positions.every((position) => position.change24hPct < 0);
      return {
        ...base,
        confidence: missing ? 'INSUFFICIENT_DATA' : 'RULE_CONFIRMED',
        reasons: [
          missing
            ? 'Known allocation and reserve checks do not require an intervention. Entry or peak history is unavailable, so profit/loss protection cannot be fully evaluated.'
            : broad
              ? 'The decline is broad across the portfolio and no policy threshold is breached. Hold positions to avoid unnecessary turnover.'
              : 'No policy threshold is breached. Preserve the position and avoid unnecessary turnover.',
        ],
      };
    }
    // Round quantities down: a simulation cannot sell more than the position owns.
    const quantity = proceeds.div(p.priceUsdt).toDecimalPlaces(8, Decimal.ROUND_DOWN);
    proceeds = quantity.mul(p.priceUsdt);
    if (quantity.lte(0))
      return {
        ...base,
        reasons: ['The computed intervention is below supported quantity precision.'],
      };
    reserveNeeded = Decimal.max(0, reserveNeeded.minus(proceeds));
    if (kind === 'EXIT' && quantity.lt(p.quantity)) kind = 'REDUCE';
    return {
      ...base,
      decision: kind,
      triggers,
      reasons: [
        ...triggers.map((v) => v.explanation),
        kind === 'REDUCE'
          ? 'A partial reduction addresses the rule without fully exiting the position.'
          : kind === 'EXIT'
            ? 'Severe loss protection calls for closing the position within the action-size limit.'
            : 'Restore the stablecoin buffer by reducing portfolio exposure.',
      ],
      trade: {
        asset: p.asset as Exclude<Asset, 'USDT'>,
        side: 'SELL',
        quantity: money(quantity),
        estimatedProceedsUsdt: money(proceeds),
        positionPct: percent(quantity, p.quantity),
      },
      approvalRequired: true,
    };
  });
}
