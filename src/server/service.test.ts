import { expect, test } from 'vitest';
import { initialState } from './store';
import { action, activatePolicy, runScenario, scan } from './service';
test('full scenario to approval to verification persists a single intervention', async () => {
  const state = await initialState();
  await activatePolicy(state, state.policy);
  await runScenario(state, 'concentration');
  const pending = state.receipts.find((r) => r.status === 'PENDING')!;
  await action(state, pending.id, true);
  expect(state.portfolio.stableReservePct).toBeCloseTo(18);
  expect(state.receipts.find((r) => r.id === pending.id)?.status).toBe('SIMULATED');
  await expect(action(state, pending.id, true)).rejects.toThrow('no longer pending');
  await scan(state);
  expect(state.receipts.filter((r) => r.status === 'PENDING')).toHaveLength(0);
});
test('policy edits supersede old approvals', async () => {
  const state = await initialState();
  await runScenario(state, 'concentration');
  const id = state.receipts.find((r) => r.status === 'PENDING')!.id;
  await activatePolicy(state, {
    ...state.policy,
    maxAssetAllocationPct: 40,
    minStableReservePct: 10,
  });
  expect(state.receipts.find((r) => r.id === id)?.status).toBe('SUPERSEDED');
});
