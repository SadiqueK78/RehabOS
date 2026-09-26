/**
 * Where a patient's entitlements live.
 *
 * Two backends, chosen by what the environment provides:
 *
 *   Firestore   when FIREBASE_SERVICE_ACCOUNT is set. This is what runs in production and the
 *               only one that works on Vercel, where each request may land on a fresh instance
 *               with a read-only disk and nothing kept between invocations.
 *   JSON file   otherwise, for running the server locally without any Firebase credentials.
 *
 * Records are keyed by the patient's email, lowercased, and live under billing/{email} so they
 * sit apart from the users collection the app itself writes.
 */

const fs = require("fs");
const path = require("path");

const FILE = process.env.BILLING_STORE || path.join(__dirname, ".billing-store.json");

let firestore = null;
let firestoreTried = false;

function db() {
  if (firestoreTried) return firestore;
  firestoreTried = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const admin = require("firebase-admin");
    const credential = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credential) });
    }
    firestore = admin.firestore();
  } catch (err) {
    // Better to fall back to the file and log loudly than to silently lose a payment.
    console.error("Billing store: Firestore unavailable, using the local file.", err.message);
    firestore = null;
  }
  return firestore;
}

const readFile = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
};

const writeFile = (data) => {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Billing store write failed:", err.message);
  }
};

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

module.exports = { recordFor, updateRecord, usingFirestore: () => !!db() };
