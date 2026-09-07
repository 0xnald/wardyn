import { analyze, observe } from './monitor';
import { DemoProvider, type Scenario } from '../features/demo/provider';
import { approveReceipt } from '../domain/actions';
import { portfolioInputs, calculatePortfolio } from '../domain/portfolio';
import { policySchema, type WardynPolicy } from '../domain/policy';
import type { WardynState } from './store';
import { BinanceCliProvider } from '../lib/binance/cli';

function record(state: WardynState, result: ReturnType<typeof analyze>) {
  state.portfolio = result.portfolio;
  state.receipts = [...result.receipts, ...state.receipts].slice(0, 200);
  state.runs = [result.run, ...state.runs].slice(0, 100);
  state.revision += 1;
}
function invalidatePending(state: WardynState) { state.receipts.forEach(r => { if (r.status === 'PENDING') r.status = 'SUPERSEDED'; }); }
export async function runScenario(state: WardynState, scenario: Scenario) {
  invalidatePending(state);
  state.scenario = scenario;
  state.scenarioStartedAt = new Date().toISOString();
  // Each scenario starts a fresh simulation; old receipts remain inspectable.
  record(state, await observe(new DemoProvider(scenario), state.policy, []));
}
export async function scan(state: WardynState) {
  const now = new Date();
  state.receipts.forEach(r => { if (r.status === 'PENDING' && now.getTime() - Date.parse(r.createdAt) > 120000) r.status = 'SUPERSEDED'; });
  const history = state.receipts.filter(r => !state.scenarioStartedAt || r.createdAt >= state.scenarioStartedAt);
  if (state.portfolio.source === 'binance-cli') record(state, await observe(new BinanceCliProvider(), state.policy, history, now));
  else {
    const inputs = portfolioInputs(state.portfolio, now);
    record(state, analyze(calculatePortfolio(inputs.balances, inputs.snapshots, 'demo', now), state.policy, history, now));
  }
}
export async function activatePolicy(state: WardynState, policy: WardynPolicy) {
  state.policy = policySchema.parse(policy); state.policyConfirmed = true;
  invalidatePending(state); await scan(state);
}
export async function action(state: WardynState, receiptId: string, approve: boolean) {
  const index = state.receipts.findIndex(r => r.id === receiptId);
  if (index < 0 || state.receipts[index].status !== 'PENDING') throw new Error('Action is no longer pending.');
  if (approve) {
    const receipt = approveReceipt(state.receipts[index], state.portfolio, state.policy);
    state.receipts[index] = receipt; state.portfolio = receipt.after!;
    // Other proposals are based on the previous portfolio and must be reevaluated.
    invalidatePending(state);
    state.runs.unshift({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), events: [{ stage: 'VERIFY', message: receipt.verification!, timestamp: new Date().toISOString() }], decisions: [receipt.decision], risk: analyze(state.portfolio, state.policy, state.receipts).run.risk });
  } else { state.receipts[index].status = 'REJECTED'; state.receipts[index].resolvedAt = new Date().toISOString(); }
  state.revision += 1;
  await scan(state);
}
export async function connectAccount(state: WardynState) { invalidatePending(state); record(state, await observe(new BinanceCliProvider(), state.policy, [])); }
