import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC0Oj1sMnKp7OJKXGQyzP7485Z1UlLBW94",
  authDomain: "karenacevedo-ac7dd.firebaseapp.com",
  projectId: "karenacevedo-ac7dd",
  storageBucket: "karenacevedo-ac7dd.firebasestorage.app",
  messagingSenderId: "1020158549486",
  appId: "1:1020158549486:web:83579abc4fbeaebac4c2ff"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setup() {
  console.log("Configurando roles iniciales...");
  
  try {
    await setDoc(doc(db, "usuarios", "71260540@fuerzaciudadana.pe"), {
      nombre: "Kevin Avalos",
      dni: "71260540",
      rol: "administrador",
      correo: "71260540@fuerzaciudadana.pe"
    });
    console.log("✅ Rol de Administrador asignado a Kevin.");

    await setDoc(doc(db, "usuarios", "25570849@fuerzaciudadana.pe"), {
      nombre: "Karen Acevedo",
      dni: "25570849",
      rol: "candidata",
      correo: "25570849@fuerzaciudadana.pe"
    });
    console.log("✅ Rol de Candidata asignado a Karen.");

  } catch (e) {
    console.error("❌ Error configurando roles:", e);
  }

  process.exit(0);
}

setup();
