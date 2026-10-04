import 'server-only';

import { ApiError } from '@/lib/server/admin-auth';
import { normalizeActaExtraction, type ExtraccionActa } from '@/lib/electoral/acta-schema';
import { getAdminServices } from '@/lib/firebase-admin';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    mesaNumero: { type: 'STRING', nullable: true },
    departamento: { type: 'STRING', nullable: true },
    provincia: { type: 'STRING', nullable: true },
    distrito: { type: 'STRING', nullable: true },
    electoresHabiles: { type: 'INTEGER', nullable: true },
    resultados: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          orden: { type: 'INTEGER' },
          organizacion: { type: 'STRING' },
          provincial: { type: 'INTEGER', nullable: true },
          distrital: { type: 'INTEGER', nullable: true },
          confianza: { type: 'NUMBER', nullable: true },
        },
        required: ['orden', 'organizacion', 'provincial', 'distrital', 'confianza'],
      },
    },
    especiales: {
      type: 'OBJECT',
      properties: {
        blancos: {
          type: 'OBJECT',
          properties: {
            provincial: { type: 'INTEGER', nullable: true },
            distrital: { type: 'INTEGER', nullable: true },
          },
          required: ['provincial', 'distrital'],
        },
        nulos: {
          type: 'OBJECT',
          properties: {
            provincial: { type: 'INTEGER', nullable: true },
            distrital: { type: 'INTEGER', nullable: true },
          },
          required: ['provincial', 'distrital'],
        },
        impugnados: {
          type: 'OBJECT',
          properties: {
            provincial: { type: 'INTEGER', nullable: true },
            distrital: { type: 'INTEGER', nullable: true },
          },
          required: ['provincial', 'distrital'],
        },
      },
      required: ['blancos', 'nulos', 'impugnados'],
    },
    totalesEmitidos: {
      type: 'OBJECT',
      properties: {
        provincial: { type: 'INTEGER', nullable: true },
        distrital: { type: 'INTEGER', nullable: true },
      },
      required: ['provincial', 'distrital'],
    },
    ciudadanosVotaron: { type: 'INTEGER', nullable: true },
    observaciones: { type: 'STRING', nullable: true },
    confianzaGeneral: { type: 'NUMBER' },
    advertencias: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [
    'mesaNumero', 'departamento', 'provincia', 'distrito', 'electoresHabiles',
    'resultados', 'especiales', 'totalesEmitidos', 'ciudadanosVotaron',
    'observaciones', 'confianzaGeneral', 'advertencias',
  ],
};

const PROMPT = `Analiza la imagen electoral del distrito de Chaclacayo (Elecciones Municipales 2026).
La imagen puede ser:
1. Una hoja de "CONTEO DE VOTOS ELECCIONES MUNICIPALES 2026 DISTRITO DE CHACLACAYO" (hoja de personero), que contiene una sola columna de "VOTOS". En este caso, asigna los votos extraídos a la columna "distrital" y deja "provincial" en null.
2. Un acta oficial de escrutinio de la ONPE con dos columnas: "TOTAL DE VOTOS MUNICIPAL PROVINCIAL" y "TOTAL DE VOTOS MUNICIPAL DISTRITAL". En este caso, extrae ambas columnas.

La mesa electoral se encuentra en la cabecera ("MESA Nº:"). Extrae el número de mesa.
En el distrito de Chaclacayo participan exactamente las siguientes 12 organizaciones políticas en este orden oficial:
  1. Alianza para el Progreso (Símbolo: A)
  2. Partido Político Nacional Perú Libre (Símbolo: Lápiz)
  3. Juntos por el Perú (Símbolo: JP)
  4. Acción Popular (Símbolo: Lampa)
  5. Renovación Popular (Símbolo: R)
  6. Fe en el Perú (Símbolo: Fe en el Perú)
  7. Partido Demócrata Verde (Símbolo: V)
  8. Avanza País Partido de Integración Social (Símbolo: Tren)
  9. Fuerza Ciudadana (Símbolo: Sol Fuerza Ciudadana)
  10. Partido País para Todos (Símbolo: Pista / Carretera)
  11. Somos Perú (Símbolo: Corazón)
  12. Podemos Perú (Símbolo: P)

Asocia cada fila al nombre oficial de la organización según el número de fila (1 al 12) y su símbolo.
Extrae también las filas de votos especiales:
  - VOTOS EN BLANCO (Fila 13)
  - VOTOS NULOS (Fila 14)
  - VOTOS IMPUGNADOS
Y la fila de "TOTAL DE VOTOS" (o TOTAL DE VOTOS EMITIDOS).

Reglas estrictas:
- Extrae de forma literal los números manuscritos.
- No sumes, no alteres y no inventes datos.
- Si una casilla especial está en blanco o con guión, interpreta como 0.
- Si un número es ilegible, devuelve null.
- Ignora nombres de personeros, firmas y horas.
- La confianza general debe ser un número entre 0 y 1. Agrega advertencias si la imagen tiene sombras o números dudosos.`;

type GeminiResponse = {
  error?: { code?: number; message?: string; status?: string };
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  modelVersion?: string;
};

export async function extractActaFromImage(
  image: Buffer,
  mimeType = 'image/webp',
): Promise<{
  extraction: ExtraccionActa;
  modelVersion: string;
}> {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const model = process.env.ACTA_VISION_MODEL || 'gemini-flash-latest';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  let endpoint: string;
  let headers: Record<string, string>;

  if (geminiApiKey) {
    // Google AI Studio (Nivel gratuito / Free Tier)
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    headers = {
      'Content-Type': 'application/json',
    };
  } else {
    // Fallback: Google Cloud Vertex AI mediante Service Account
    const { adminApp } = getAdminServices();
    const credential = adminApp.options.credential;
    if (!credential) {
      throw new ApiError(
        503,
        'Configura GEMINI_API_KEY de Google AI Studio (gratuita) o las credenciales de Google Cloud.',
      );
    }
    const accessToken = await credential.getAccessToken();
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    headers = {
      Authorization: `Bearer ${accessToken.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  try {
    const response = await fetch(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: image.toString('base64') } },
          ] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: controller.signal,
      },
    );
    const payload = await response.json() as GeminiResponse;
    if (!response.ok) {
      if (response.status === 429) {
        throw new ApiError(
          429,
          'Se superó temporalmente el límite de solicitudes por minuto de Google AI Studio. Espera un momento e intenta nuevamente.',
        );
      }
      if (payload.error?.message?.includes('API_KEY_INVALID') || payload.error?.message?.includes('API key not valid')) {
        throw new ApiError(403, 'La clave GEMINI_API_KEY de Google AI Studio no es válida.');
      }
      const disabled = payload.error?.message?.includes('disabled') || payload.error?.message?.includes('has not been used');
      throw new ApiError(
        disabled ? 503 : 502,
        disabled
          ? 'El reconocimiento de actas todavía no está habilitado en Google Cloud o Google AI Studio.'
          : (payload.error?.message || 'No se pudo interpretar la fotografía. Intenta nuevamente.'),
      );
    }
    const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    if (!raw) throw new ApiError(422, 'La imagen no produjo una lectura utilizable.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(502, 'El motor devolvió una lectura incompleta. Intenta nuevamente.');
    }
    const extraction = normalizeActaExtraction(parsed);
    if (!extraction.mesaNumero && extraction.resultados.length === 0) {
      throw new ApiError(422, 'No se reconoció un acta de escrutinio completa en la imagen.');
    }
    return { extraction, modelVersion: payload.modelVersion || model };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(504, 'El análisis tardó demasiado. Intenta nuevamente.');
    }
    throw new ApiError(502, 'No se pudo conectar con el reconocimiento de actas.');
  } finally {
    clearTimeout(timeout);
  }
}
