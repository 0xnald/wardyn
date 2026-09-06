import { afterEach, expect, test, vi } from 'vitest';
import { fallbackPolicy, interpretPolicy } from './policy';
afterEach(() => vi.unstubAllEnvs());
test('local parser handles the demo mandate without claiming AI', () => {
  const draft = fallbackPolicy('Keep at least 15% in stablecoins, never let one asset exceed 30% of my portfolio, and take profits gradually.');
  expect(draft.policy.minStableReservePct).toBe(15);
  expect(draft.policy.maxAssetAllocationPct).toBe(30);
  expect(draft.source).toBe('RULE_BASED');
});
test('invalid or unavailable model output cannot change execution authority', async () => {
  vi.stubEnv('WARDYN_AI_API_KEY', 'test-only'); vi.stubEnv('WARDYN_AI_MODEL', 'test-model');
  const mockFetch = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'draft_policy', input: { policy: { executionMode: 'automatic' } } }] })));
  const draft = await interpretPolicy('Manage my existing portfolio safely.', mockFetch);
  expect(draft.source).toBe('RULE_BASED');
  expect(draft.policy.executionMode).toBe('approval_required');
});
