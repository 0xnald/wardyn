'use client';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useWorkspace } from './workspace-context';
import { ReceiptCard } from './receipt-card';
import { amount, assetNames, pct, usd } from './format';
import { assessRisk } from '../domain/evaluate';
export function PositionDetail({ asset }: { asset: string }) {
  const { state } = useWorkspace();
  if (!state) return null;
  const p = state.portfolio.positions.find((p) => p.asset === asset);
  if (!p)
    return (
      <div className="empty-state panel">
        <h1>Position not found</h1>
        <p>This asset is not in your current portfolio.</p>
        <Link className="button secondary" href="/workspace">
          Return to overview
        </Link>
      </div>
    );
  const receipt =
    state.receipts.find((r) => r.decision.asset === asset && r.status === 'PENDING') ??
    state.receipts.find((r) => r.decision.asset === asset);
  const risk = assessRisk(state.portfolio, state.policy);
  return (
    <>
      <Link href="/workspace" className="back-link">
        <ArrowLeft size={15} />
        Portfolio overview
      </Link>
      <div className="page-heading">
        <div className="position-title">
          <span className={`asset-icon ${asset}`}>
            {asset === 'BTC'
              ? '₿'
              : asset === 'SOL'
                ? '≋'
                : asset === 'BNB'
                  ? '◇'
                  : asset === 'USDT'
                    ? '₮'
                    : asset.slice(0, 1)}
          </span>
          <div>
            <h1>
              {assetNames[asset]} <span className="muted">{asset}/USDT</span>
            </h1>
            <p>
              {amount(p.quantity)} {asset} under your management policy
            </p>
          </div>
        </div>
      </div>
      <div className="metrics">
        {[
          ['Market value', usd(p.valueUsdt)],
          ['Allocation', pct(p.allocationPct)],
          ['Current price', usd(p.priceUsdt)],
          [
            'Unrealized PnL',
            p.pnlPct === null ? 'Unknown' : `${p.pnlPct >= 0 ? '+' : ''}${pct(p.pnlPct)}`,
          ],
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>
      <div className="two-column">
        <div>
          {receipt ? (
            <ReceiptCard receipt={receipt} expanded />
          ) : (
            <section className="panel empty-state">
              <ShieldCheck size={32} />
              <h2>Reserve asset</h2>
              <p>
                USDT provides liquidity for the portfolio. Wardyn evaluates it against your minimum
                reserve policy.
              </p>
            </section>
          )}
        </div>
        <aside className="main-column">
          <section className="panel">
            <div className="panel-heading">
              <h2>Position evidence</h2>
            </div>
            {[
              ['Entry price', p.entryPriceUsdt ? usd(p.entryPriceUsdt) : 'Not available'],
              ['Tracked peak', p.peakPriceUsdt ? usd(p.peakPriceUsdt) : 'Not tracked'],
              ['Peak drawdown', p.drawdownPct === null ? 'Unknown' : pct(p.drawdownPct)],
              ['24h change', pct(p.change24hPct)],
              ['Hourly volatility', pct(p.volatilityPct)],
            ].map(([label, value]) => (
              <div className="rule-line" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <section className="panel content-pad">
            <div className="eyebrow">PORTFOLIO RISK BREAKDOWN</div>
            <h2>
              {risk.level} · {risk.score}/100
            </h2>
            <p className="inline-note">A transparent heuristic, not a prediction of returns.</p>
            {risk.breakdown.map((f) => (
              <div className="section-gap" key={f.factor}>
                <div className="effect-row">
                  <span>{f.factor}</span>
                  <strong>{f.points.toFixed(1)} points</strong>
                </div>
                <div className="risk-bar">
                  <span style={{ width: `${f.points}%` }} />
                </div>
                <small className="muted">{f.explanation}</small>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
