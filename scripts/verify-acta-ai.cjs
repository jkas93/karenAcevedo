const { readFileSync } = require('fs');
const admin = require('firebase-admin');

const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n/g, '\n');
}

async function main() {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const model = process.env.ACTA_VISION_MODEL || 'gemini-flash-latest';

  if (geminiApiKey) {
    console.log(`Verificando Google AI Studio (Free Tier) con modelo ${model}...`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Responde exactamente: ACTA_AI_OK' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 200 },
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Google AI Studio respondió ${response.status}: ${payload.error?.message || 'error desconocido'}`);
    }
    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!answer?.includes('ACTA_AI_OK')) throw new Error('Google AI Studio respondió, pero el modelo no entregó la confirmación esperada.');
    console.log(JSON.stringify({ ok: true, provider: 'Google AI Studio (Gratis)', model, answer }));
    return;
  }

  console.log(`No se encontró GEMINI_API_KEY. Verificando Vertex AI con Service Account...`);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  const credential = admin.credential.cert({
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  });
  const token = await credential.getAccessToken();
  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responde exactamente: ACTA_AI_OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 20 },
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Vertex AI respondió ${response.status}: ${payload.error?.message || 'error desconocido'}`);
  }
  const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!answer?.includes('ACTA_AI_OK')) throw new Error('Vertex AI respondió, pero el modelo no entregó la confirmación esperada.');
  console.log(JSON.stringify({ ok: true, provider: 'Google Cloud Vertex AI', projectId, location, model, answer }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
