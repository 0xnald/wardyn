import type { PolicyViolation, Portfolio, RiskAssessment } from './models';
import { policySchema, type WardynPolicy } from './policy';

export function evaluatePolicy(portfolio: Portfolio, input: WardynPolicy): PolicyViolation[] {
  const policy = policySchema.parse(input);
  if (Number(portfolio.totalValueUsdt) === 0) return [];
  const violations: PolicyViolation[] = [];
  for (const p of portfolio.positions.filter((p) => p.asset !== 'USDT' && Number(p.quantity) > 0)) {
    if (p.allocationPct > policy.maxAssetAllocationPct + 0.000001)
      violations.push({
        asset: p.asset,
        rule: 'concentration',
        actualPct: p.allocationPct,
        limitPct: policy.maxAssetAllocationPct,
        explanation: `${p.asset} exceeds the maximum position allocation.`,
      });
    if (
      policy.lossProtectionEnabled &&
      p.drawdownPct !== null &&
      p.drawdownPct >= policy.maxPositionDrawdownPct
    )
      violations.push({
        asset: p.asset,
        rule: 'drawdown',
        actualPct: p.drawdownPct,
        limitPct: policy.maxPositionDrawdownPct,
        explanation: `${p.asset} breached the loss limit from its tracked peak.`,
      });
    if (
      policy.profitStrategy === 'scale_out' &&
      p.pnlPct !== null &&
      p.pnlPct >= policy.profitThresholdPct
    )
      violations.push({
        asset: p.asset,
        rule: 'profit',
        actualPct: p.pnlPct,
        limitPct: policy.profitThresholdPct,
        explanation: `${p.asset} reached the gradual profit-taking threshold.`,
      });
  }
  if (portfolio.stableReservePct < policy.minStableReservePct - 0.000001)
    violations.push({
      asset: 'PORTFOLIO',
      rule: 'reserve',
      actualPct: portfolio.stableReservePct,
      limitPct: policy.minStableReservePct,
      explanation: 'Stablecoin reserves are below the portfolio buffer.',
    });
  return violations;
}

export function assessRisk(portfolio: Portfolio, policy: WardynPolicy): RiskAssessment {
  const positions = portfolio.positions.filter((p) => p.asset !== 'USDT' && Number(p.quantity) > 0);
  const concentration = Math.max(0, ...positions.map((p) => p.allocationPct));
  const drawdown = Math.max(0, ...positions.map((p) => p.drawdownPct ?? 0));
  const volatility = Math.max(0, ...positions.map((p) => p.volatilityPct));
  const reserveGap = Math.max(0, policy.minStableReservePct - portfolio.stableReservePct);
  const breakdown = [
    {
      factor: 'Concentration',
      points: Math.min(30, Math.max(0, concentration - 20) * 1.5),
      explanation: `Largest position ${concentration.toFixed(1)}%`,
    },
    {
      factor: 'Drawdown',
      points: Math.min(35, drawdown),
      explanation: `Largest known peak drawdown ${drawdown.toFixed(1)}%`,
    },
    {
      factor: 'Volatility',
      points: Math.min(20, volatility * 2),
      explanation: `Highest measured volatility ${volatility.toFixed(1)}%`,
    },
    {
      factor: 'Reserve',
      points: Math.min(15, reserveGap * 3),
      explanation: `Reserve shortfall ${reserveGap.toFixed(1)} percentage points`,
    },
  ];
  const score = Math.round(breakdown.reduce((sum, f) => sum + f.points, 0));
  return {
    score,
    level: score >= 75 ? 'CRITICAL' : score >= 35 ? 'HIGH' : score >= 20 ? 'MODERATE' : 'LOW',
    breakdown,
  };
}
