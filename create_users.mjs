import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC0Oj1sMnKp7OJKXGQyzP7485Z1UlLBW94",
  authDomain: "karenacevedo-ac7dd.firebaseapp.com",
  projectId: "karenacevedo-ac7dd",
  storageBucket: "karenacevedo-ac7dd.firebasestorage.app",
  messagingSenderId: "1020158549486",
  appId: "1:1020158549486:web:83579abc4fbeaebac4c2ff"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function create() {
  console.log("Iniciando creación de usuarios en Firebase...");

  try {
    await createUserWithEmailAndPassword(auth, "71260540@fuerzaciudadana.pe", "110693");
    console.log("✅ Usuario de Kevin creado exitosamente.");
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("ℹ️ El usuario de Kevin ya existe.");
    } else {
      console.error("❌ Error creando a Kevin:", error.message);
    }
  }

  try {
    await createUserWithEmailAndPassword(auth, "25570849@fuerzaciudadana.pe", "12345678");
    console.log("✅ Usuario de Karen creado exitosamente.");
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("ℹ️ El usuario de Karen ya existe.");
    } else {
      console.error("❌ Error creando a Karen:", error.message);
    }
  }

  process.exit(0);
}

create();
