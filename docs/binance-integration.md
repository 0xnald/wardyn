# Binance integration verification

Verified against official sources on September 6, 2026.

## Actual integration path

Wardyn implements a read-only `BinanceCliProvider` using the official Binance CLI recommended by the Binance Skills Hub. It runs only `spot get-account`, `spot ticker24hr`, and `spot klines`. Arguments are fixed or drawn from a three-symbol allowlist; no shell is involved. Responses pass Zod validation before domain calculations.

- [Official Binance Skill](https://github.com/binance/binance-skills-hub/blob/main/skills/binance/binance/SKILL.md)
- [Official spot command reference](https://github.com/binance/binance-skills-hub/blob/main/skills/binance/binance/references/spot.md)
- [CLI installation and authentication](https://github.com/binance/binance-cli)
- [Spot market response schemas](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)

Install the official CLI using its supported platform instructions, configure a read-only account/profile, and set `WARDYN_BINANCE_READ_ENABLED=true`. `WARDYN_BINANCE_CLI_PATH` optionally points to the installed executable. The CLI uses its documented `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, and `BINANCE_API_ENV` variables or configured profile. Never put credentials in browser code or Git.

The initial app supports BTC, BNB, SOL, and USDT. Nonzero unsupported balances cause a clear error rather than silently understating total exposure. Balances include free and locked amounts for valuation. Because cost basis and historical position peaks are not supplied by account balances, live PnL and drawdown remain unknown. Live order execution is intentionally unavailable.

`publicSnapshots()` separately uses documented public REST endpoints for a read-only market preview. Public prices are not a connected account and are never labelled as Agent OS account access.

## MCP

[Official MCP documentation](https://developers.binance.com/en/docs/agent-native/mcp-server/agentic) specifies `https://agent.binance.com/mcp/agentic`, public market reads, permissioned account access, and user-confirmed writes. It does not enumerate exact tool names and schemas.

`node scripts/discover-binance.mjs` uses the official MCP SDK to initialize a connection and list actual tool schemas. Discovery was attempted from the development environment and the endpoint returned a transport error. No tool names were invented. OAuth account connection and MCP order execution are not implemented or claimed. The CLI adapter is the implemented Skills Hub path; deployment requires a Node host with that executable installed.

## Validation limits

Adapter parsing is covered by contract fixtures. Account reads require credentials and an installed CLI; no authenticated end-to-end account read has been verified in this build environment. Unavailable live data is shown as an error, never replaced by hidden demo data.

Volatility is the population standard deviation of log returns over the available completed hourly candles, expressed as a percentage. It is not annualized or predictive. Demo values are explicitly synthetic. All prices and portfolio values use USDT as the quote unit.
