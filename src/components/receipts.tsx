'use client';
import { useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { useWorkspace } from './workspace-context';
import { ReceiptCard } from './receipt-card';
export function Receipts() {
  const { state } = useWorkspace();
  const [filter, setFilter] = useState('ALL');
  if (!state) return null;
  const receipts = state.receipts.filter((r) => filter === 'ALL' || r.status === filter);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A REASON FOR EVERY ACTION</div>
          <h1>Your decision receipts.</h1>
          <p>What Wardyn saw, what it proposed, and what happened next.</p>
        </div>
        <span className="subtle-tag">{state.receipts.length} RECORDS</span>
      </div>
      <div className="tabs" aria-label="Filter receipts">
        {['ALL', 'PENDING', 'SIMULATED', 'HOLD', 'REJECTED', 'SUPERSEDED'].map((f) => (
          <button
            key={f}
            className={f === filter ? 'active' : ''}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {receipts.length ? (
        <div className="receipt-list">
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} />
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <FileCheck2 size={32} />
          <h2>No receipts in this view</h2>
          <p>Run a scenario or scan your portfolio to create a decision trail.</p>
        </div>
      )}
    </>
  );
}
