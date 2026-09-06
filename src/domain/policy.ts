import { z } from 'zod';
export const policySchema = z.object({
  riskProfile: z.enum(['conservative', 'moderate', 'growth']),
  maxAssetAllocationPct: z.number().min(10).max(80),
  minStableReservePct: z.number().min(0).max(80),
  profitStrategy: z.enum(['scale_out', 'hold']),
  profitThresholdPct: z.number().min(5).max(500),
  profitScalePct: z.number().min(1).max(25),
  lossProtectionEnabled: z.boolean(),
  maxPositionDrawdownPct: z.number().min(5).max(60),
  overtradingProtection: z.boolean(),
  cooldownMinutes: z.number().int().min(1).max(1440),
  maxActionPct: z.number().min(1).max(100),
  executionMode: z.literal('approval_required'),
}).strict();
export type WardynPolicy = z.infer<typeof policySchema>;
export const defaultPolicy: WardynPolicy = {
  riskProfile: 'moderate', maxAssetAllocationPct: 30, minStableReservePct: 15,
  profitStrategy: 'scale_out', profitThresholdPct: 50, profitScalePct: 10,
  lossProtectionEnabled: true, maxPositionDrawdownPct: 18,
  overtradingProtection: true, cooldownMinutes: 60, maxActionPct: 100,
  executionMode: 'approval_required',
};
