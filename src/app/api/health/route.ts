import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'wardyn-backend',
      binanceCli: Boolean(process.env.WARDYN_BINANCE_CLI_PATH),
      remoteBinance: process.env.WARDYN_REMOTE_BINANCE_ENABLED === 'true',
      persistentStorage: Boolean(process.env.WARDYN_DATA_DIR),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
