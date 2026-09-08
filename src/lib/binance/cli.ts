import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Decimal from 'decimal.js';
import { z } from 'zod';
import {
  assetSchema,
  decimalString,
  type AssetBalance,
  type MarketSnapshot,
  type TradeIntent,
} from '../../domain/models';
import type { AccountSnapshot, BinanceProvider, TradeResult } from './provider';
import { parseMarket } from './market';

const exec = promisify(execFile);
const accountSchema = z.object({
  canTrade: z.boolean().default(false),
  balances: z.array(z.object({ asset: assetSchema, free: decimalString, locked: decimalString })),
});
const exchangeSchema = z.object({
  symbols: z.array(
    z.object({
      symbol: z.string(),
      baseAsset: assetSchema,
      quoteAsset: assetSchema,
      status: z.string(),
      filters: z
        .array(
          z
            .object({
              filterType: z.string(),
              stepSize: decimalString.optional(),
              minQty: decimalString.optional(),
            })
            .passthrough(),
        )
        .default([]),
    }),
  ),
});
const orderSchema = z.object({
  symbol: z.string(),
  orderId: z.union([z.string(), z.number()]),
  clientOrderId: z.string().optional(),
  transactTime: z.number().optional(),
  status: z.string(),
  executedQty: decimalString,
  cummulativeQuoteQty: decimalString,
});
type SymbolInfo = z.infer<typeof exchangeSchema>['symbols'][number];

function environment() {
  const value = process.env.BINANCE_API_ENV ?? 'prod';
  if (!['prod', 'demo', 'testnet'].includes(value))
    throw new Error('BINANCE_API_ENV must be prod, demo, or testnet.');
  return value === 'prod'
    ? ('mainnet' as const)
    : value === 'demo'
      ? ('binance-demo' as const)
      : ('testnet' as const);
}
function enabled() {
  return process.env.WARDYN_BINANCE_READ_ENABLED === 'true';
}
function executionEnabled() {
  return process.env.WARDYN_BINANCE_EXECUTION_ENABLED === 'true';
}
function executionAssets() {
  return new Set(
    (process.env.WARDYN_BINANCE_EXECUTION_ASSETS ?? '')
      .split(',')
      .map((asset) => asset.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function parseAccount(input: unknown, symbols: SymbolInfo[]): AccountSnapshot {
  const account = accountSchema.parse(input);
  const raw = parseBalances(account);
  const tradable = new Set(
    symbols
      .filter((symbol) => symbol.quoteAsset === 'USDT' && symbol.status === 'TRADING')
      .map((symbol) => symbol.baseAsset),
  );
  const balances = raw
    .filter((balance) => balance.asset === 'USDT' || tradable.has(balance.asset))
    .map(({ asset, quantity }) => ({ asset, quantity }));
  const unvaluedAssets = raw
    .filter((balance) => balance.asset !== 'USDT' && !tradable.has(balance.asset))
    .map(({ asset, quantity }) => ({
      asset,
      quantity,
      reason: 'No active direct USDT Spot market',
    }));
  return {
    balances,
    unvaluedAssets,
    canTrade: account.canTrade,
    observedAt: new Date().toISOString(),
  };
}

export function parseBalances(input: unknown): AssetBalance[] {
  return accountSchema
    .parse(input)
    .balances.map((balance) => ({
      asset: balance.asset,
      quantity: new Decimal(balance.free).plus(balance.locked).toFixed(8),
    }))
    .filter((balance) => new Decimal(balance.quantity).gt(0));
}

export class BinanceCliProvider implements BinanceProvider {
  readonly source = 'binance-cli' as const;
  private symbols: SymbolInfo[] = [];
  capabilities() {
    return {
      accountRead: enabled(),
      marketData: true,
      spotExecution: enabled() && executionEnabled() && executionAssets().size > 0,
      executionMode: executionEnabled()
        ? ('approval_required' as const)
        : ('monitor_only' as const),
      environment: environment(),
      integration: 'binance-skills-cli' as const,
    };
  }
  private async call(
    command: string,
    args: string[] = [],
    authenticated = false,
  ): Promise<unknown> {
    if (authenticated && !enabled())
      throw new Error('Binance account reads are disabled on this server.');
    const profile = process.env.WARDYN_BINANCE_PROFILE;
    const cliArgs = ['spot', command, ...args, ...(profile ? ['--profile', profile] : [])];
    const wslDistro = process.env.WARDYN_BINANCE_CLI_WSL_DISTRO;
    if (wslDistro && !/^[A-Za-z0-9._-]{1,64}$/.test(wslDistro))
      throw new Error('WARDYN_BINANCE_CLI_WSL_DISTRO contains unsupported characters.');
    const executable = wslDistro
      ? 'wsl.exe'
      : process.env.WARDYN_BINANCE_CLI_PATH || 'binance-cli';
    const invocation = wslDistro
      ? ['-d', wslDistro, '--', '/root/.cargo/bin/binance-cli', ...cliArgs]
      : cliArgs;
    try {
      const { stdout } = await exec(
        executable,
        invocation,
        { timeout: 20000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, env: process.env },
      );
      return JSON.parse(stdout);
    } catch {
      throw new Error(
        `Binance CLI ${authenticated ? 'account' : 'market'} request failed. Check the CLI profile, permissions, and selected environment.`,
      );
    }
  }
  private async loadSymbols() {
    if (!this.symbols.length)
      this.symbols = exchangeSchema.parse(await this.call('exchange-info')).symbols;
    return this.symbols;
  }
  async getAccount() {
    const [account, symbols] = await Promise.all([
      this.call('get-account', ['--omit-zero-balances', 'true'], true),
      this.loadSymbols(),
    ]);
    return parseAccount(account, symbols);
  }
  async getBalances() {
    return (await this.getAccount()).balances;
  }
  async getMarketSnapshots(assets: string[] = []): Promise<MarketSnapshot[]> {
    const unique = [...new Set(assets)].filter((asset) => asset !== 'USDT');
    const markets: MarketSnapshot[] = [];
    for (let index = 0; index < unique.length; index += 5) {
      const batch = unique.slice(index, index + 5);
      markets.push(...await Promise.all(
      batch.map(async (asset) => {
        const symbol = `${asset}USDT`;
        const [ticker, candles] = await Promise.all([
          this.call('ticker24hr', ['--symbol', symbol]),
          this.call('klines', ['--symbol', symbol, '--interval', '1h', '--limit', '25']),
        ]);
        return parseMarket(asset, ticker, candles);
      })));
    }
    return [
      ...markets,
      {
        asset: 'USDT',
        priceUsdt: '1',
        change24hPct: 0,
        volatilityPct: 0,
        volume24hUsdt: '0',
        observedAt: new Date().toISOString(),
      },
    ];
  }
  async prepareTrade(intent: TradeIntent) {
    if (!executionEnabled()) return { intent, execution: 'monitor_only' as const };
    if (!executionAssets().has(intent.asset))
      throw new Error(`${intent.asset} is not in the server execution allowlist.`);
    const ceiling = new Decimal(process.env.WARDYN_BINANCE_MAX_ORDER_USDT ?? '100');
    if (new Decimal(intent.estimatedProceedsUsdt).gt(ceiling))
      throw new Error(`Trade exceeds the server order ceiling of ${ceiling.toFixed()} USDT.`);
    const symbol = (await this.loadSymbols()).find(
      (item) => item.symbol === `${intent.asset}USDT` && item.status === 'TRADING',
    );
    if (!symbol) throw new Error(`${intent.asset}USDT is not available for Spot execution.`);
    const lot = symbol.filters.find((filter) => filter.filterType === 'LOT_SIZE');
    let quantity = new Decimal(intent.quantity);
    if (lot?.stepSize) quantity = quantity.div(lot.stepSize).floor().mul(lot.stepSize);
    if (quantity.lte(0) || (lot?.minQty && quantity.lt(lot.minQty)))
      throw new Error('Trade quantity is below the Binance minimum for this symbol.');
    return {
      intent: { ...intent, quantity: quantity.toFixed() },
      execution: 'approval_required' as const,
    };
  }
  async executeTrade(intent: TradeIntent, idempotencyKey: string): Promise<TradeResult> {
    if (!executionEnabled()) throw new Error('Live Binance execution is disabled on this server.');
    const prepared = await this.prepareTrade(intent);
    const clientId = `wardyn_${idempotencyKey.replaceAll('-', '').slice(0, 20)}`;
    const raw = await this.call(
      'new-order',
      [
        '--symbol',
        `${intent.asset}USDT`,
        '--side',
        'SELL',
        '--rtype',
        'MARKET',
        '--quantity',
        prepared.intent.quantity,
        '--new-client-order-id',
        clientId,
        '--new-order-resp-type',
        'FULL',
      ],
      true,
    );
    const order = orderSchema.parse(raw);
    return {
      provider: 'binance-cli',
      environment: environment(),
      symbol: order.symbol,
      side: 'SELL',
      orderId: String(order.orderId),
      clientOrderId: order.clientOrderId,
      status: order.status,
      executedQuantity: order.executedQty,
      cumulativeQuoteQuantity: order.cummulativeQuoteQty,
      executedAt: new Date(order.transactTime ?? Date.now()).toISOString(),
    };
  }
}
