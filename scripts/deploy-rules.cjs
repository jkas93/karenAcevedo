const { readFileSync } = require('fs');
// Native crypto JWT generation

const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/\\n/g, '\n');
}

// Usar JWT de googleapis o crear token OAuth2 con el Service Account
const crypto = require('crypto');

async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signatureInput = `${b64(header)}.${b64(claim)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(privateKey, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener token: ' + JSON.stringify(data));
  return data.access_token;
}

async function createRuleset(token, projectId, fileName) {
  const rulesContent = readFileSync(fileName, 'utf-8');
  const createRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: {
        files: [{ name: fileName, content: rulesContent }],
      },
    }),
  });

  const ruleset = await createRes.json();
  if (!createRes.ok || !ruleset.name) {
    throw new Error(`Error creando ruleset de ${fileName}: ${JSON.stringify(ruleset)}`);
  }
  return ruleset.name;
}

async function releaseRuleset(token, projectId, releaseId, rulesetName) {
  const releaseRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${releaseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      release: {
        name: `projects/${projectId}/releases/${releaseId}`,
        rulesetName,
      },
    }),
  });

  const release = await releaseRes.json();
  if (!releaseRes.ok || !release.name) {
    throw new Error(`Error publicando ${releaseId}: ${JSON.stringify(release)}`);
  }
  console.log(`✅ Reglas publicadas en ${releaseId}:`, rulesetName);
}

async function deployRules() {
  const token = await getAccessToken();
  console.log('✅ Token OAuth obtenido.');

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !storageBucket) throw new Error('Falta la configuración del proyecto o bucket de Firebase.');

  const firestoreRuleset = await createRuleset(token, projectId, 'firestore.rules');
  await releaseRuleset(token, projectId, 'cloud.firestore', firestoreRuleset);

  const storageRuleset = await createRuleset(token, projectId, 'storage.rules');
  await releaseRuleset(token, projectId, `firebase.storage/${storageBucket}`, storageRuleset);
}

deployRules().catch((error) => {
  console.error('Error desplegando reglas:', error);
  process.exitCode = 1;
});
