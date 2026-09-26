/**
 * Where a patient's entitlements live.
 *
 * Two backends, chosen by what the environment provides:
 *
 *   Firestore   when FIREBASE_SERVICE_ACCOUNT is set. This is what runs in production and the
 *               only one that works on Vercel, where each request may land on a fresh instance
 *               with a read-only disk and nothing kept between invocations.
 *   JSON file   otherwise, for running the server locally without Firebase credentials.
 *
 * If a service account is configured but Firestore cannot be reached, this throws rather than
 * quietly writing to a file that will vanish. A failed write must be visible: the webhook then
 * answers with an error, Stripe retries, and the payment is not lost.
 *
 * Records are keyed by the patient's email, lowercased, under billing/{email}.
 */

const fs = require("fs");
const path = require("path");

const FILE = process.env.BILLING_STORE || path.join(__dirname, ".billing-store.json");
const configured = () => !!process.env.FIREBASE_SERVICE_ACCOUNT;

let firestore = null;
let initError = null;

function db() {
  if (!configured()) return null;
  if (firestore || initError) {
    if (initError) throw initError;
    return firestore;
  }
  try {
    // The modular API: firebase-admin v10 removed the old `admin.apps` namespace, and reaching
    // for it is what silently sent production entitlements to a temporary file.
    const { initializeApp, getApps, cert } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(credential) });
    firestore = getFirestore(app);
    return firestore;
  } catch (err) {
    initError = new Error(`Firestore is configured but unusable: ${err.message}`);
    throw initError;
  }
}

const readFile = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
};

const writeFile = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

const key = (email) => String(email || "").toLowerCase();

/** The entitlement record for one patient, or null. */
async function recordFor(email) {
  if (!email) return null;
  const store = db();
  if (store) {
    const snap = await store.collection("billing").doc(key(email)).get();
    return snap.exists ? snap.data() : null;
  }
  return readFile()[key(email)] || null;
}

/** Merge fields into a patient's record and return what it now says. */
async function updateRecord(email, patch) {
  if (!email) return null;
  const id = key(email);
  const store = db();
  const next = { ...(await recordFor(email)), ...patch, email: id, updatedAt: Date.now() };
  if (store) {
    await store.collection("billing").doc(id).set(next, { merge: true });
    return next;
  }
  const all = readFile();
  all[id] = next;
  writeFile(all);
  return next;
}

/** For /api/health: which backend is live, and whether it is healthy. */
function status() {
  if (!configured()) return { store: "local file", ok: true, note: "set FIREBASE_SERVICE_ACCOUNT for production" };
  try {
    db();
    return { store: "firestore", ok: true };
  } catch (err) {
    return { store: "firestore", ok: false, error: err.message };
  }
}

module.exports = { recordFor, updateRecord, status, usingFirestore: () => configured() };
