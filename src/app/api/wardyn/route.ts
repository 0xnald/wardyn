import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '../../../server/store';
import { action, activatePolicy, connectAccount, runScenario, scan } from '../../../server/service';
import { policySchema } from '../../../domain/policy';
import { interpretPolicy } from '../../../lib/ai/policy';
import { publicSnapshots } from '../../../lib/binance/market';
import { loopbackHost, sameOrigin } from '../../../server/request-security';

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
  z.object({ command: z.literal('action'), receiptId: z.string().uuid(), approve: z.boolean() }),
  z.object({ command: z.literal('monitor'), enabled: z.boolean() }),
  z.object({ command: z.literal('connect') }),
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
  if (!sameOrigin(request.headers.get('origin'), request.headers.get('host')))
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
    if (command.command === 'connect' && !loopbackHost(request.headers.get('host')))
      return response(
        { error: 'Account access is restricted to this local installation.' },
        id,
        403,
      );
    const result = await store.update(id, async (state) => {
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
          await action(state, command.receiptId, command.approve);
          break;
        case 'monitor':
          state.monitoring = command.enabled;
          state.revision += 1;
          break;
        case 'connect':
          await connectAccount(state);
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
