import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { isDemoActive, updateDemoData } from "../patient/demoPatient";
import { planById } from "./plans";

/**
 * Taking the payment and remembering what was bought.
 *
 * The server decides the price and talks to Stripe; this file only asks it to start a Checkout
 * Session, sends the patient there, and records what Stripe says when they come back.
 *
 * When no billing server is reachable — nobody has set STRIPE_SECRET_KEY, or the demo patient is
 * looking around — it falls back to a clearly labelled test mode that grants the plan locally
 * without taking any money. That keeps the whole product demonstrable without keys, and the UI
 * says plainly that no payment was taken.
 */

const API_BASE = process.env.REACT_APP_API_BASE || "";

/** Where the subscription lives on the patient's own record. */
export const subscriptionOf = (data) => data?.subscription || null;

export async function saveSubscription(email, subscription) {
  if (isDemoActive()) return updateDemoData((d) => ({ ...d, subscription }));
  return setDoc(doc(db, "users", email), { subscription }, { merge: true });
}

/** Extra sessions bought one at a time, counted on top of the plan's monthly allowance. */
export async function addSessionCredit(email, data) {
  const extra = (data?.extraSessions || 0) + 1;
  if (isDemoActive()) return updateDemoData((d) => ({ ...d, extraSessions: extra }));
  return setDoc(doc(db, "users", email), { extraSessions: extra }, { merge: true });
}

const testSubscription = (planId) => ({
  planId,
  status: "active",
  testMode: true,
  startedAt: Date.now(),
  currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
});

/**
 * Send the patient to Stripe Checkout. Returns what happened so the caller can tell them:
 * "redirecting" when Stripe took over, or "test" when the plan was granted without payment.
 */
export async function startCheckout({ planId, email }) {
  if (!email) throw new Error("Sign in before subscribing.");

  if (!isDemoActive()) {
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email, origin: window.location.origin }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
          return { outcome: "redirecting" };
        }
      }
    } catch {
      /* no billing server reachable: fall through to test mode */
    }
  }

  // Test mode: no money moves, and the plan is marked so the UI can say so.
  if (planId === "sessionTopup") {
    return { outcome: "test", topup: true };
  }
  await saveSubscription(email, testSubscription(planId));
  return { outcome: "test", plan: planById(planId) };
}

/**
 * Called on the way back from Stripe. The answer comes from the server asking Stripe, never
 * from the URL, so nobody can grant themselves a plan by editing the address bar.
 */
export async function confirmCheckout(sessionId) {
  const res = await fetch(`${API_BASE}/api/billing/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error("Could not confirm the payment with Stripe.");
  const info = await res.json();
  if (!info.paid) throw new Error("That payment has not completed.");
  return info;
}

/** Stripe's own page for changing card, plan or cancelling. */
export async function openBillingPortal(email) {
  const res = await fetch(`${API_BASE}/api/billing/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The server looks the Stripe customer up from the account, so it wants the email.
    body: JSON.stringify({ email, origin: window.location.origin }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error || "The billing portal is not available.");
  }
  const { url } = await res.json();
  window.location.href = url;
}
