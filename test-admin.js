const { initializeApp, cert } = require('firebase-admin/app');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');

let privateKey = "";
env.split('\n').forEach(line => {
  if (line.startsWith('FIREBASE_PRIVATE_KEY=')) {
    privateKey = line.replace('FIREBASE_PRIVATE_KEY=', '').replace(/^"|"$/g, '');
  }
});

try {
  const pk = privateKey ? privateKey.replace(/\\n/g, '\n') : undefined;
  console.log("Private key start:", pk ? pk.substring(0, 30) : "Missing");
  
  initializeApp({
    credential: cert({
      projectId: "karenacevedo-ac7dd",
      clientEmail: "firebase-adminsdk-fbsvc@karenacevedo-ac7dd.iam.gserviceaccount.com",
      privateKey: pk,
    }),
  });
  console.log("Success!");
} catch (e) {
  console.error("Error:", e);
}
