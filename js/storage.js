import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { FIREBASE_CONFIG, SHARED_DOCUMENT_ID } from "./config.js";

let firebaseApp = null;
let firestoreDb = null;
const LOAD_TIMEOUT_MS = 8000;
const SAVE_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    })
  ]);
}

function getBudgetDocumentRef() {
  if (!firebaseApp || !firestoreDb) {
    throw new Error("Storage has not been initialized.");
  }

  const appId = firebaseApp.options.appId || "default-app";

  return doc(
    firestoreDb,
    "artifacts",
    appId,
    "users",
    SHARED_DOCUMENT_ID,
    "budgets",
    "allData"
  );
}

export async function initStorage() {
  if (firebaseApp && firestoreDb) {
    return { firebaseApp, firestoreDb };
  }

  firebaseApp = initializeApp(FIREBASE_CONFIG);
  firestoreDb = getFirestore(firebaseApp);

  return { firebaseApp, firestoreDb };
}

export async function loadBudgets() {
  const snapshot = await withTimeout(getDoc(getBudgetDocumentRef()), LOAD_TIMEOUT_MS, "Budget load");

  if (!snapshot.exists()) {
    return {};
  }

  const data = snapshot.data();
  return data && typeof data.budgets === "object" ? data.budgets : {};
}

export async function saveBudgets(budgets) {
  await withTimeout(
    setDoc(
      getBudgetDocumentRef(),
      {
        budgets,
        updatedAt: Date.now()
      },
      { merge: true }
    ),
    SAVE_TIMEOUT_MS,
    "Budget save"
  );
}
