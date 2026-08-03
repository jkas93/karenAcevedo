import { auth } from '@/lib/firebase';

type ApiErrorPayload = { error?: string };

export async function authenticatedPost<TResponse>(
  url: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Debes iniciar sesion nuevamente.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as TResponse & ApiErrorPayload;
  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la operacion.');
  }

  return payload;
}
