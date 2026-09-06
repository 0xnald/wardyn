import { z } from 'zod';

// Monetary quantities cross boundaries as decimal strings, denominated in USDT.
export const decimalString = z.string().regex(/^\d+(\.\d+)?$/).refine(v => Number.isFinite(Number(v)), 'Finite decimal required');
export const assetSchema = z.enum(['BTC', 'BNB', 'SOL', 'USDT']);
export type Asset = z.infer<typeof assetSchema>;
export const balanceSchema = z.object({ asset: assetSchema, quantity: decimalString, entryPriceUsdt: decimalString.optional(), peakPriceUsdt: decimalString.optional() });
export type AssetBalance = z.infer<typeof balanceSchema>;
export const snapshotSchema = z.object({ asset: assetSchema, priceUsdt: decimalString.refine(v => Number(v) > 0), change24hPct: z.number().finite(), volume24hUsdt: decimalString, volatilityPct: z.number().finite().nonnegative(), observedAt: z.string().datetime() });
export type MarketSnapshot = z.infer<typeof snapshotSchema>;
export type Position = AssetBalance & { priceUsdt: string; valueUsdt: string; allocationPct: number; pnlPct: number | null; pnlUsdt: string | null; drawdownPct: number | null; volatilityPct: number; change24hPct: number };
export type Portfolio = { positions: Position[]; totalValueUsdt: string; stableReservePct: number; observedAt: string; source: 'demo' | 'binance-cli' | 'binance-mcp' | 'binance-public' };
export type DecisionKind = 'HOLD' | 'REDUCE' | 'EXIT' | 'REBALANCE';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type RiskAssessment = { score: number; level: RiskLevel; breakdown: { factor: string; points: number; explanation: string }[] };
export type PolicyViolation = { asset: Asset | 'PORTFOLIO'; rule: 'concentration' | 'reserve' | 'profit' | 'drawdown'; actualPct: number; limitPct: number; explanation: string };
export type DecisionEvidence = { label: string; value: string };
export type TradeIntent = { asset: Exclude<Asset, 'USDT'>; side: 'SELL'; quantity: string; estimatedProceedsUsdt: string; positionPct: number };
export type WardynDecision = { id: string; asset: Asset | 'PORTFOLIO'; decision: DecisionKind; confidence: 'RULE_CONFIRMED' | 'INSUFFICIENT_DATA'; reasons: string[]; evidence: DecisionEvidence[]; triggers: PolicyViolation[]; trade: TradeIntent | null; approvalRequired: boolean; cooldown: boolean };
export type WardynReceipt = { id: string; createdAt: string; decision: WardynDecision; before: Portfolio; expectedAfter: Portfolio | null; after: Portfolio | null; status: 'HOLD' | 'PENDING' | 'SIMULATED' | 'REJECTED' | 'SUPERSEDED'; verified: boolean | null; verification: string | null };
export type MonitoringRun = { id: string; startedAt: string; events: { stage: string; message: string; timestamp: string }[]; decisions: WardynDecision[]; risk: RiskAssessment };
