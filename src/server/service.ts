import { analyze, observe } from './monitor';
import { DemoProvider, type Scenario } from '../features/demo/provider';
import { approveReceipt } from '../domain/actions';
import { evaluatePolicy } from '../domain/evaluate';
import { portfolioInputs, calculatePortfolio } from '../domain/portfolio';
import { policySchema, type WardynPolicy } from '../domain/policy';
import type { WardynState } from './store';
import { BinanceCliProvider } from '../lib/binance/cli';
import type { BinanceProvider } from '../lib/binance/provider';

function record(state: WardynState, result: ReturnType<typeof analyze>) {
  state.portfolio = result.portfolio;
  state.receipts = [...result.receipts, ...state.receipts].slice(0, 200);
  state.runs = [result.run, ...state.runs].slice(0, 100);
  state.revision += 1;
}
function invalidatePending(state: WardynState) {
  state.receipts.forEach((r) => {
    if (r.status === 'PENDING') r.status = 'SUPERSEDED';
  });
}
export async function runScenario(state: WardynState, scenario: Scenario) {
  invalidatePending(state);
  state.scenario = scenario;
  state.scenarioStartedAt = new Date().toISOString();
  state.mode = 'demo';
  state.executionMode = 'monitor_only';
  state.connection = {
    status: 'DISCONNECTED',
    environment: null,
    canTrade: false,
    message: null,
    connectedAt: null,
  };
  // Each scenario starts a fresh simulation; old receipts remain inspectable.
  record(state, await observe(new DemoProvider(scenario), state.policy, []));
}
export async function scan(state: WardynState) {
  const now = new Date();
  state.receipts.forEach((r) => {
    if (r.status === 'PENDING' && now.getTime() - Date.parse(r.createdAt) > 120000)
      r.status = 'SUPERSEDED';
  });
  const history = state.receipts.filter(
    (r) => !state.scenarioStartedAt || r.createdAt >= state.scenarioStartedAt,
  );
  if (state.mode === 'binance')
    record(state, await observe(new BinanceCliProvider(), state.policy, history, now));
  else {
    const inputs = portfolioInputs(state.portfolio, now);
    record(
      state,
      analyze(
        calculatePortfolio(inputs.balances, inputs.snapshots, 'demo', now),
        state.policy,
        history,
        now,
      ),
    );
  }
}
export async function activatePolicy(state: WardynState, policy: WardynPolicy) {
  state.policy = policySchema.parse(policy);
  state.policyConfirmed = true;
  invalidatePending(state);
  await scan(state);
}
export async function action(
  state: WardynState,
  receiptId: string,
  approve: boolean,
  confirmation?: string,
) {
  const index = state.receipts.findIndex((r) => r.id === receiptId);
  if (index < 0 || state.receipts[index].status !== 'PENDING')
    throw new Error('Action is no longer pending.');
  if (approve && state.mode === 'demo') {
    const receipt = approveReceipt(state.receipts[index], state.portfolio, state.policy);
    state.receipts[index] = receipt;
    state.portfolio = receipt.after!;
    // Other proposals are based on the previous portfolio and must be reevaluated.
    invalidatePending(state);
    state.runs.unshift({
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      events: [
        { stage: 'VERIFY', message: receipt.verification!, timestamp: new Date().toISOString() },
      ],
      decisions: [receipt.decision],
      risk: analyze(state.portfolio, state.policy, state.receipts).run.risk,
    });
  } else if (approve) {
    if (state.executionMode !== 'approval_required')
      throw new Error('Live execution is in Monitor Only mode.');
    if (confirmation !== 'CONFIRM')
      throw new Error('Type CONFIRM to authorize this Binance Spot order.');
    await executeLiveReceipt(state, index, new BinanceCliProvider());
    state.runs.unshift({
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      events: [
        {
          stage: 'ACT',
          message: 'Approved Binance Spot order submitted through Binance Skills CLI',
          timestamp: new Date().toISOString(),
        },
        {
          stage: 'VERIFY',
          message: state.receipts[index].verification!,
          timestamp: new Date().toISOString(),
        },
        {
          stage: 'RECEIPT',
          message: `Binance order ${state.receipts[index].execution!.orderId} preserved in receipt`,
          timestamp: new Date().toISOString(),
        },
      ],
      decisions: [state.receipts[index].decision],
      risk: analyze(state.portfolio, state.policy, state.receipts).run.risk,
    });
    state.revision += 1;
    return;
  } else {
    state.receipts[index].status = 'REJECTED';
    state.receipts[index].resolvedAt = new Date().toISOString();
  }
  state.revision += 1;
  await scan(state);
}
export async function executeLiveReceipt(
  state: WardynState,
  index: number,
  provider: BinanceProvider,
  now = new Date(),
) {
  const pending = state.receipts[index];
  if (!pending?.decision.trade) throw new Error('No executable trade is attached to this receipt.');
  if (!provider.capabilities().spotExecution || !provider.executeTrade)
    throw new Error('Live Binance execution is disabled on this server.');
  if (now.getTime() - Date.parse(pending.before.observedAt) > 120000)
    throw new Error('Live quote is stale. Scan again before execution.');
  const account = await provider.getAccount();
  if (!account.canTrade)
    throw new Error('The connected Binance account does not report Spot trading permission.');
  const snapshots = await provider.getMarketSnapshots(account.balances.map((b) => b.asset));
  const current = calculatePortfolio(account.balances, snapshots, provider.source, now, {
    environment: provider.capabilities().environment,
    unvaluedAssets: account.unvaluedAssets,
  });
  const beforePosition = pending.before.positions.find((p) => p.asset === pending.decision.asset);
  const currentPosition = current.positions.find((p) => p.asset === pending.decision.asset);
  if (!beforePosition || !currentPosition || beforePosition.quantity !== currentPosition.quantity)
    throw new Error('Binance balance changed. Scan again before execution.');
  const prepared = await provider.prepareTrade(pending.decision.trade);
  const execution = await provider.executeTrade(prepared.intent, pending.id);
  const refreshed = await provider.getAccount();
  const refreshedMarkets = await provider.getMarketSnapshots(
    refreshed.balances.map((b) => b.asset),
  );
  const after = calculatePortfolio(refreshed.balances, refreshedMarkets, provider.source, now, {
    environment: provider.capabilities().environment,
    unvaluedAssets: refreshed.unvaluedAssets,
  });
  const remaining = evaluatePolicy(after, state.policy);
  const unresolved = pending.decision.triggers.filter((trigger) =>
    remaining.some(
      (v) => v.asset === trigger.asset && v.rule === trigger.rule && v.rule !== 'profit',
    ),
  );
  state.receipts[index] = {
    ...pending,
    resolvedAt: now.toISOString(),
    status: 'EXECUTED',
    after,
    execution,
    verified: unresolved.length === 0,
    verification: unresolved.length
      ? 'Binance order completed; refreshed balances show that some triggered limits remain.'
      : 'Binance order completed and refreshed account balances resolved the triggered limits.',
  };
  state.portfolio = after;
  invalidatePending(state);
}

export async function connectAccount(
  state: WardynState,
  provider: BinanceProvider = new BinanceCliProvider(),
) {
  invalidatePending(state);
  try {
    const capabilities = provider.capabilities();
    const account = await provider.getAccount();
    const snapshots = await provider.getMarketSnapshots(account.balances.map((b) => b.asset));
    const portfolio = calculatePortfolio(account.balances, snapshots, provider.source, new Date(), {
      environment: capabilities.environment,
      unvaluedAssets: account.unvaluedAssets,
    });
    state.mode = 'binance';
    state.connection = {
      status: 'CONNECTED',
      environment: capabilities.environment === 'demo' ? null : capabilities.environment,
      canTrade: account.canTrade && capabilities.spotExecution,
      message: null,
      connectedAt: new Date().toISOString(),
    };
    record(state, analyze(portfolio, state.policy, []));
  } catch (error) {
    state.connection = {
      status: 'ERROR',
      environment: null,
      canTrade: false,
      message: error instanceof Error ? error.message : 'Binance connection failed.',
      connectedAt: null,
    };
    state.revision += 1;
  }
}

export async function disconnectAccount(state: WardynState) {
  invalidatePending(state);
  const first = await observe(new DemoProvider(), state.policy, []);
  state.mode = 'demo';
  state.executionMode = 'monitor_only';
  state.connection = {
    status: 'DISCONNECTED',
    environment: null,
    canTrade: false,
    message: null,
    connectedAt: null,
  };
  record(state, first);
}
