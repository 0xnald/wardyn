import { expect, test } from 'vitest';
import { defaultPolicy, policySchema } from './policy';
test('policy bounds reject unrestricted execution and malformed numbers', () => {
  expect(policySchema.safeParse(defaultPolicy).success).toBe(true);
  expect(policySchema.safeParse({ ...defaultPolicy, executionMode: 'automatic' }).success).toBe(
    false,
  );
  expect(policySchema.safeParse({ ...defaultPolicy, maxAssetAllocationPct: 101 }).success).toBe(
    false,
  );
  expect(policySchema.safeParse({ ...defaultPolicy, cooldownMinutes: -1 }).success).toBe(false);
  expect(policySchema.safeParse({ ...defaultPolicy, maxActionPct: NaN }).success).toBe(false);
});
