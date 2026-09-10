import { NextResponse } from 'next/server';
import { adminCommand, createChallenge, deviceCommand, rateRequest } from '@/lib/server/autoclicker';
import { ApiError, apiErrorResponse } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/');
    if (!['admin', 'device/challenge', 'device/command'].includes(path)) throw new ApiError(404, 'Ruta desconocida.');
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Se requiere JSON.');
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError(400, 'Falta contenido.');
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 16384) { await reader.cancel(); throw new ApiError(413, 'Solicitud demasiado grande.'); }
      chunks.push(value);
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); }
    catch { throw new ApiError(400, 'JSON inválido.'); }
    if (path !== 'admin') await rateRequest(request, path, 240);
    const result = path === 'admin' ? await adminCommand(request, body) : path === 'device/challenge' ? await createChallenge(body) : await deviceCommand(body);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = apiErrorResponse(error);
    response.headers.set('Cache-Control', 'no-store');
    if (error instanceof ApiError && error.status === 429) response.headers.set('Retry-After', '60');
    return response;
  }
}
