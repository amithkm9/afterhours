import { NextRequest, NextResponse } from 'next/server';
import { analyze, importPerson, processNext, rankings, scheduleCohort, startDate, stateFor, updateSettings } from '@/src/lib/service';
import { EngineError } from '@/src/lib/validation';
import { DEMO_OWNER } from '@/src/lib/store';

export const dynamic = 'force-dynamic';

function session(request: NextRequest) {
  const existing = request.cookies.get('afterhours-session')?.value;
  return existing && /^[a-f0-9-]{36}$/.test(existing) ? existing : crypto.randomUUID();
}

async function handle(request: NextRequest) {
  const owner = session(request);
  const path = new URL(request.url).pathname.replace(/^\/api\//, '');
  const readOwner = new URL(request.url).searchParams.get('demo') === '1' ? DEMO_OWNER : owner;
  let result: unknown;
  try {
    if (request.method === 'GET' && path === 'state') result = await stateFor(readOwner);
    else if (request.method === 'GET' && path === 'rankings') result = await rankings(readOwner, new URL(request.url).searchParams.get('personId') || '');
    else if (request.method === 'POST') {
      if (Number(request.headers.get('content-length') || 0) > 12_000) throw new EngineError('INVALID_INPUT', 'Request is too large.');
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) throw new EngineError('INVALID_ORIGIN', 'Please use the website to perform this action.', false, 403);
      const text = await request.text();
      if (text.length > 12_000) throw new EngineError('INVALID_INPUT', 'Request is too large.');
      let parsed: unknown;
      try { parsed = text ? JSON.parse(text) : {}; }
      catch { throw new EngineError('INVALID_INPUT', 'Request must contain valid JSON.'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new EngineError('INVALID_INPUT', 'Request must be a JSON object.');
      const body = parsed as Record<string, unknown>;
      if (path === 'import') result = await importPerson(owner, body);
      else if (path === 'settings') result = await updateSettings(owner, body);
      else if (path === 'analyze') result = await analyze(owner, String(body.personId || ''));
      else if (path === 'dates') result = await startDate(owner, String(body.personAId || ''), String(body.personBId || ''));
      else if (path === 'dates/schedule') result = await scheduleCohort(owner);
      else if (path === 'jobs/step') result = await processNext(owner);
      else if (/^dates\/[a-zA-Z0-9-]+\/step$/.test(path)) result = await processNext(owner, path.split('/')[1]);
      else throw new EngineError('NOT_FOUND', 'Endpoint not found.', false, 404);
    } else throw new EngineError('NOT_FOUND', 'Endpoint not found.', false, 404);
    const response = NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('afterhours-session', owner, { httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unexpected error occurred.', code: error instanceof EngineError ? error.code : 'SERVER_ERROR' },
      { status: error instanceof EngineError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = handle;
export const POST = handle;
