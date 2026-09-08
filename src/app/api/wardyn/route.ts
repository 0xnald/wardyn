import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '../../../server/store';
import {
  action,
  activatePolicy,
  connectAccount,
  disconnectAccount,
  runScenario,
  scan,
} from '../../../server/service';
import { policySchema } from '../../../domain/policy';
import { interpretPolicy } from '../../../lib/ai/policy';
import { publicSnapshots } from '../../../lib/binance/market';
import { loopbackHost, sameOrigin, validAccessCode } from '../../../server/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const commandSchema = z.discriminatedUnion('command', [
  z.object({
    command: z.literal('scenario'),
    scenario: z.enum(['balanced', 'concentration', 'drawdown', 'deterioration', 'reserve']),
  }),
  z.object({ command: z.literal('scan') }),
  z.object({ command: z.literal('policy'), policy: policySchema }),
  z.object({ command: z.literal('interpret'), text: z.string().min(10).max(2000) }),
  z.object({
    command: z.literal('action'),
    receiptId: z.string().uuid(),
    approve: z.boolean(),
    confirmation: z.string().max(20).optional(),
  }),
  z.object({ command: z.literal('monitor'), enabled: z.boolean() }),
  z.object({ command: z.literal('connect') }),
  z.object({ command: z.literal('disconnect') }),
  z.object({
    command: z.literal('execution-mode'),
    mode: z.enum(['monitor_only', 'approval_required']),
  }),
  z.object({ command: z.literal('markets') }),
]);
const lastAiCall = new Map<string, number>();
function session(request: NextRequest) {
  const supplied = request.cookies.get('wardyn-session')?.value;
  return supplied && z.string().uuid().safeParse(supplied).success ? supplied : crypto.randomUUID();
}
function response(value: unknown, id: string, status = 200) {
  const result = NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  result.cookies.set('wardyn-session', id, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 604800,
  });
  return result;
}
export async function GET(request: NextRequest) {
  const id = session(request);
  try {
    return response(await store.update(id, async (s) => s), id);
  } catch {
    return response({ error: 'Could not load the saved Wardyn session.' }, id, 500);
  }
}
export async function POST(request: NextRequest) {
  const id = session(request);
  const local = loopbackHost(request.headers.get('host'));
  const remoteEnabled = process.env.WARDYN_REMOTE_BINANCE_ENABLED === 'true';
  const remoteAuthorized =
    remoteEnabled &&
    validAccessCode(request.headers.get('x-wardyn-access-code'), process.env.WARDYN_ACCESS_CODE);
  if (
    !sameOrigin(
      request.headers.get('origin'),
      request.headers.get('host'),
      process.env.WARDYN_ALLOWED_ORIGIN,
    )
  )
    return response({ error: 'Request origin is not allowed.' }, id, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return response({ error: 'JSON is required.' }, id, 415);
  try {
    const raw = await request.text();
    if (raw.length > 8192) return response({ error: 'Request is too large.' }, id, 413);
    const command = commandSchema.parse(JSON.parse(raw));
    if (command.command === 'interpret') {
      const now = Date.now();
      if (now - (lastAiCall.get(id) ?? 0) < 5000)
        return response({ error: 'Wait a few seconds before generating another draft.' }, id, 429);
      if (lastAiCall.size > 5000) lastAiCall.clear();
      lastAiCall.set(id, now);
      return response(await interpretPolicy(command.text), id);
    }
    if (command.command === 'markets')
      return response({ snapshots: await publicSnapshots(), source: 'binance-public' }, id);
    if (command.command === 'connect' && !local && !remoteAuthorized)
      return response(
        {
          error: remoteEnabled
            ? 'Enter the Wardyn backend access code before connecting Binance.'
            : 'Remote Binance access is disabled on this server.',
        },
        id,
        401,
      );
    const result = await store.update(id, async (state) => {
      if (
        state.mode === 'binance' &&
        !local &&
        !remoteAuthorized &&
        command.command !== 'disconnect'
      )
        throw new Error('The Wardyn backend access code is required for this live session.');
      switch (command.command) {
        case 'scenario':
          await runScenario(state, command.scenario);
          break;
        case 'scan':
          await scan(state);
          break;
        case 'policy':
          await activatePolicy(state, command.policy);
          break;
        case 'action':
          await action(state, command.receiptId, command.approve, command.confirmation);
          break;
        case 'monitor':
          state.monitoring = command.enabled;
          state.revision += 1;
          break;
        case 'connect':
          await connectAccount(state);
          break;
        case 'disconnect':
          await disconnectAccount(state);
          break;
        case 'execution-mode':
          if (command.mode === 'approval_required' && !state.connection.canTrade)
            throw new Error(
              'Trading is unavailable. Enable server execution and connect a Spot-trading account first.',
            );
          state.executionMode = command.mode;
          state.revision += 1;
          break;
      }
      return state;
    });
    return response(result, id);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'Some values are invalid or outside policy bounds.'
        : error instanceof Error
          ? error.message
          : 'The request failed.';
    return response({ error: message }, id, 400);
  }
}
