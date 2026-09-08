'use client';
import { useState } from 'react';
import { ArrowUpRight, FlaskConical, Plug, Radio, ShieldCheck } from 'lucide-react';
import { useWorkspace } from './workspace-context';
import type { MarketSnapshot } from '../domain/models';
import { pct, time, usd } from './format';

export function Connections() {
  const { state, busy, accessCode, setAccessCode, mutate, request } = useWorkspace();
  const [markets, setMarkets] = useState<MarketSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state) return null;
  const live = state.mode === 'binance';
  async function loadMarkets() {
    setLoading(true);
    setError(null);
    try {
      setMarkets(
        (await request<{ snapshots: MarketSnapshot[] }>({ command: 'markets' })).snapshots,
      );
    } catch (e) {
      setMarkets([]);
      setError(e instanceof Error ? e.message : 'Market data unavailable');
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WARDYN MODE</div>
          <h1>Choose how to use Wardyn.</h1>
          <p>Connection, market data, execution, and Agent OS activity in one place.</p>
        </div>
      </div>
      <div className="two-column">
        <section className={`panel connection-card ${!live ? 'active-connection' : ''}`}>
          <span className="connection-icon">
            <FlaskConical size={22} />
          </span>
          <h2>Demo Mode</h2>
          <span className="status">{!live ? 'ACTIVE · SIMULATED FUNDS' : 'AVAILABLE'}</span>
          <p className="inline-note">
            <strong>Explore Wardyn instantly with simulated funds.</strong>
            <br />
            No Binance account, credentials, or real money required.
          </p>
          <button
            className="button secondary"
            disabled={busy || !live}
            onClick={() => void mutate({ command: 'scenario', scenario: 'balanced' })}
          >
            {live ? 'Switch to Demo' : 'Demo active'}
          </button>
        </section>
        <section className={`panel connection-card ${live ? 'active-connection' : ''}`}>
          <span className="connection-icon">
            <Plug size={22} />
          </span>
          <h2>Live Binance</h2>
          <span className={`status ${state.connection.status === 'ERROR' ? 'attention' : ''}`}>
            {busy && !live ? 'CONNECTING' : state.connection.status}
            {live ? ` · ${state.connection.canTrade ? 'TRADING ENABLED' : 'READ ONLY'}` : ''}
          </span>
          <p className="inline-note">
            <strong>
              Connect your Binance account and let Wardyn monitor your real positions.
            </strong>
          </p>
          {!live && (
            <label className="field">
              <span>Remote backend access code</span>
              <input
                type="password"
                autoComplete="current-password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="Required for hosted Live Binance"
              />
            </label>
          )}
          {state.connection.message && (
            <p role="alert" className="negative inline-note">
              {state.connection.message}
            </p>
          )}
          <div className="connection-meta">
            <div>
              <span>Environment</span>
              <strong>
                {state.connection.environment?.replace('-', ' ').toUpperCase() ?? 'NOT CONNECTED'}
              </strong>
            </div>
            <div>
              <span>Account</span>
              <strong>{live ? 'Spot balances' : '—'}</strong>
            </div>
            <div>
              <span>Permissions</span>
              <strong>
                {live
                  ? state.connection.canTrade
                    ? 'Read + approved Spot trades'
                    : 'Read balances and markets'
                  : '—'}
              </strong>
            </div>
          </div>
          <button
            className={`button ${live ? 'secondary' : 'primary'}`}
            disabled={busy}
            onClick={() => void mutate({ command: live ? 'disconnect' : 'connect' })}
          >
            {busy ? 'Connecting…' : live ? 'Disconnect' : 'Connect Binance'}
          </button>
        </section>
        <section className="panel connection-card">
          <span className="connection-icon">
            <ShieldCheck size={22} />
          </span>
          <h2>Execution</h2>
          <span className="subtle-tag">
            {state.executionMode === 'approval_required'
              ? 'APPROVAL REQUIRED · LIVE FUNDS'
              : 'MONITOR ONLY'}
          </span>
          <p className="inline-note">
            Live execution is off by default. Approval Required is available only when the server
            enables it and the connected account reports Spot trading permission.
          </p>
          <select
            aria-label="Execution mode"
            value={state.executionMode}
            disabled={!live || busy}
            onChange={(event) =>
              void mutate({ command: 'execution-mode', mode: event.target.value })
            }
          >
            <option value="monitor_only">Monitor Only</option>
            <option value="approval_required">Approval Required</option>
          </select>
        </section>
        <section className="panel connection-card">
          <span className="connection-icon">
            <Radio size={22} />
          </span>
          <h2>Market Data</h2>
          <span className="status">BINANCE · LIVE</span>
          <p className="inline-note">
            Connected portfolios use official Binance CLI tickers and recent candles. This public
            preview remains separate from account state.
          </p>
          <button
            className="button secondary"
            disabled={loading}
            onClick={() => void loadMarkets()}
          >
            {loading ? 'Fetching…' : 'Check public markets'}
          </button>
          {error && (
            <p role="alert" className="negative inline-note">
              {error}
            </p>
          )}
          {markets.map((m) => (
            <div className="effect-row section-gap" key={m.asset}>
              <span>
                {m.asset} · {time(m.observedAt)}
              </span>
              <strong>
                {usd(m.priceUsdt)} · {pct(m.change24hPct)}
              </strong>
            </div>
          ))}
        </section>
        <section className="panel connection-card agent-os-panel">
          <span className="connection-icon">
            <ShieldCheck size={22} />
          </span>
          <h2>Binance Agent OS</h2>
          <span className="subtle-tag">BINANCE SKILLS · OFFICIAL CLI</span>
          <p className="inline-note">
            Wardyn uses the official Binance Skills CLI for account, market, and optional approved
            Spot-order operations. The connected AI client can separately use Binance MCP with its
            scoped Agentic sub-account.
          </p>
          <div className="agent-events">
            {state.runs[0].events.map((event) => (
              <div key={`${event.stage}-${event.timestamp}`}>
                <span>
                  {event.stage === 'ACT' && event.message.includes('Awaiting') ? '○' : '✓'}
                </span>
                <p>
                  <strong>{event.stage}</strong>
                  {event.message}
                </p>
              </div>
            ))}
          </div>
          <a
            className="button secondary"
            href="https://developers.binance.com/en/docs/agent-native/mcp-server/agentic"
            target="_blank"
            rel="noreferrer"
          >
            Official MCP documentation <ArrowUpRight size={15} />
          </a>
        </section>
      </div>
    </>
  );
}
