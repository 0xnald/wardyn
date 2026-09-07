'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  FileCheck2,
  LayoutDashboard,
  Plug,
  ScanLine,
  Settings2,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useWorkspace } from './workspace-context';
const navigation = [
  { href: '/workspace', label: 'Overview', icon: LayoutDashboard },
  { href: '/workspace/policy', label: 'Your policy', icon: Settings2 },
  { href: '/workspace/watch', label: 'Wardyn Watch', icon: Activity },
  { href: '/workspace/receipts', label: 'Decision receipts', icon: FileCheck2 },
  { href: '/workspace/connections', label: 'Connections', icon: Plug },
];
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-symbol">
        <Shield size={23} strokeWidth={2.4} />
      </span>
      wardyn<span className="brand-dot">.</span>
    </Link>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, busy, error, mutate, reload } = useWorkspace();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="nav-caption">YOUR CONTROL ROOM</div>
        <nav>
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname === href ? 'selected' : ''}`}
            >
              <Icon size={18} />
              {label}
              {label === 'Wardyn Watch' && state?.monitoring && <span className="live-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="guard-card">
            <ShieldCheck size={22} />
            <strong>Your rules. Always.</strong>
            <p>Every action starts with your approval.</p>
          </div>
          <a
            className="support-link"
            href="https://github.com/0xnald/wardyn#readme"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={17} />
            How Wardyn works
            <ArrowUpRight size={15} />
          </a>
          <div className="profile">
            <span>W</span>
            <div>
              Personal workspace<small>Hackathon edition</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span>{' '}
            {navigation.find((n) => n.href === pathname)?.label ?? 'Position intelligence'}
          </span>
          <div className="topbar-actions">
            <span
              className={`mode ${state?.portfolio.source === 'binance-cli' ? 'live-mode' : ''}`}
            >
              <span className="live-dot" />
              {state?.portfolio.source === 'binance-cli'
                ? 'LIVE DATA · READ ONLY'
                : 'DEMO · SIMULATED FUNDS'}
            </span>
            <a
              href="https://github.com/0xnald/wardyn"
              target="_blank"
              rel="noreferrer"
              className="icon-link"
              aria-label="Wardyn GitHub repository"
            >
              <ArrowUpRight size={19} />
            </a>
          </div>
        </header>
        <main className="workspace-main">
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={() => void reload()}>Retry loading</button>
            </div>
          )}
          {!state ? (
            <div className="loading-panel" role="status">
              <ScanLine className="spin" />
              <h2>Opening your control room</h2>
              <p>Loading your portfolio, policy, and decision history.</p>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">
          <span>
            <Shield size={13} /> Approval-first position management
          </span>
          <span>
            {busy
              ? 'Updating your workspace…'
              : state?.monitoring
                ? 'Monitoring every 30s while this tab is visible'
                : 'Monitoring paused'}{' '}
            <button
              onClick={() => void mutate({ command: 'monitor', enabled: !state?.monitoring })}
              disabled={busy || !state}
            >
              {state?.monitoring ? 'Pause' : 'Start Watch'}
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
