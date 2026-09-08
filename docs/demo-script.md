# Wardyn — 90-second demo

## Prepare

- Start the app with `pnpm dev` and open a fresh browser workspace.
- Use demo mode throughout the recording. Keep the simulated-funds badge visible.
- If demonstrating AI interpretation, configure valid server-side Anthropic credentials and a supported model first. Otherwise explicitly call the result a rule-based draft.
- Activate the default mandate before running the concentration scenario.
- Complete approvals within two minutes; expired proposals require a fresh scan.

## Story

| Time   | Screen / action                                  | Narration                                                                                                                                              |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–10s  | Landing, then Launch Wardyn                      | “Most AI agents help you enter trades. Wardyn manages what happens after you enter.”                                                                   |
| 10–25s | Your policy; interpret and inspect the mandate   | “Keep at least 15% in stablecoins, never let one asset exceed 30%, and take profits gradually. Wardyn turns this into a policy I review and activate.” |
| 25–35s | Activate policy; Overview; run SOL concentration | “Now SOL rallies to 34% of the portfolio. The same deterministic engine evaluates the new snapshot.”                                                   |
| 35–50s | Review decision on SOL                           | “Wardyn proposes REDUCE. The position is profitable, but concentration is above my rule. It sizes a partial sale to restore balance.”                  |
| 50–65s | Approve action; Confirm simulation               | “Nothing moves without approval. This demonstration uses simulated funds.”                                                                             |
| 65–80s | Receipt evidence and resulting allocation        | “SOL is back to 29%. Stable reserves are 18%. The receipt preserves the original state, policy trigger, proposed action, and verified result.”         |
| 80–90s | Wardyn Watch or a second scenario                | “A broad pullback within policy produces HOLD. Wardyn manages positions according to my rules. Your positions never go unwatched.”                     |

## Optional alternate scenes

- Severe deterioration: SOL has a 36% tracked-peak drawdown and triggers EXIT under the default 18% loss policy.
- Reserve shortfall: REBALANCE restores the stablecoin buffer.
- Connections: show Demo and Live Binance modes, the official Skills CLI activity, execution controls, and explain which credentials are needed. Do not claim a successful account connection unless it has been verified.
- Receipt export: download the JSON to show that evidence is retained beyond the visual card.

## Suggested submission copy

Built Wardyn for Binance Agent OS Mini Hackathon — Track A.

Most agents help you enter trades. Wardyn manages what happens after entry: user-defined policies, HOLD / REDUCE / EXIT / REBALANCE decisions, approval-first simulation, and evidence-backed decision receipts.

Binance integration uses the official Skills CLI for real Spot account and market data, with optional bounded Spot execution after explicit approval. The full demo runs without funds or credentials.

GitHub: https://github.com/0xnald/wardyn

Attach the recorded demo before posting. If the AI API is not configured in the recording, identify the parser as rule-based. Do not claim authenticated reads or a live trade unless that operation was completed in the recording.

## Entry checklist — user actions

- Verify current jurisdiction and competition eligibility with Binance.
- Follow @Binance and repost the announcement.
- Reply or quote-repost with the demo and repository.
- Complete the linked survey.
- Submit before September 8, 2026 at 23:59 UTC (September 9 at 00:59 Africa/Lagos).

This repository build does not post to social media or submit the entry survey.
