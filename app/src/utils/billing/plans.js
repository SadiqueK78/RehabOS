/**
 * What a RehabOS subscription buys.
 *
 * The product is physiotherapy for people who cannot easily travel to a clinic, so the things
 * worth metering are the two that cost a real physiotherapist's time: how many rehab plans they
 * review, and how many live video sessions they run. Everything the camera does on the patient's
 * own device — exercises, the 3D coach, the mood check-in, the digital twin — stays free and
 * unmetered, because charging per repetition would push patients to exercise less.
 *
 * Every price is in whole rupees per month and sits under the 15,000 INR ceiling that UPI
 * AutoPay puts on recurring payments, so a patient can pay by UPI mandate rather than needing a
 * card.
 */

export const CURRENCY = "inr";

export const PLANS = [
  {
    id: "free",
    name: "Self-guided",
    tagline: "Exercise at home with the camera coach",
    priceInr: 0,
    rehabPlans: 1,
    liveSessionsPerMonth: 0,
    cadence: "No live sessions",
    therapistChoice: false,
    priorityBooking: false,
    features: [
      "Unlimited camera-guided exercises",
      "3D coach in English and Hindi",
      "Daily mood check-in and digital twin",
      "1 AI rehab plan (no physiotherapist review)",
    ],
  },
  {
    id: "recover",
    name: "Recover",
    tagline: "A physiotherapist reviews your plan and sees you twice a month",
    priceInr: 499,
    rehabPlans: 1,
    liveSessionsPerMonth: 2,
    cadence: "About one session a fortnight",
    therapistChoice: true,
    priorityBooking: false,
    popular: true,
    features: [
      "Everything in Self-guided",
      "1 rehab plan reviewed and approved by a physiotherapist",
      "2 live video sessions a month",
      "Choose your own physiotherapist",
      "Progress report your physiotherapist can read",
    ],
  },
  {
    id: "care",
    name: "Care",
    tagline: "Weekly contact while you are getting your movement back",
    priceInr: 999,
    rehabPlans: 2,
    liveSessionsPerMonth: 4,
    cadence: "About one session a week",
    therapistChoice: true,
    priorityBooking: true,
    features: [
      "Everything in Recover",
      "2 rehab plans, so a second injury does not wait",
      "4 live video sessions a month",
      "Priority booking, including same-week slots",
      "Written notes after every session",
    ],
  },
  {
    id: "carePlus",
    name: "Care Plus",
    tagline: "Close supervision after surgery or a fall",
    priceInr: 1799,
    rehabPlans: 3,
    liveSessionsPerMonth: 8,
    cadence: "About two sessions a week",
    therapistChoice: true,
    priorityBooking: true,
    features: [
      "Everything in Care",
      "3 rehab plans",
      "8 live video sessions a month",
      "Same-day booking when a slot is free",
      "Your physiotherapist is alerted if pain or mood worsens",
    ],
  },
];

/** Bought on its own when someone needs one more session than their plan covers. */
export const SESSION_TOPUP = {
  id: "sessionTopup",
  name: "Extra live session",
  priceInr: 349,
  description: "One more video session this month, without changing your plan.",
};

export const FREE_PLAN = PLANS[0];

export const planById = (id) => PLANS.find((p) => p.id === id) || FREE_PLAN;

/** Statuses Stripe reports for a subscription that is genuinely paying for access. */
const LIVE_STATUSES = ["active", "trialing", "past_due"];

/**
 * The plan a patient is actually on. Anything Stripe has cancelled, or never started, falls
 * back to the free plan rather than locking the patient out of their own exercises.
 */
export function activePlan(subscription) {
  if (!subscription || !LIVE_STATUSES.includes(subscription.status)) return FREE_PLAN;
  return planById(subscription.planId);
}

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The date a session was booked for, which is what the monthly allowance counts. */
export function sessionMonth(appt) {
  const date = appt?.scheduledDate || appt?.preferredDate;
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : monthKey(d);
}

/**
 * Sessions booked this month and rehab plans held, from the patient's own records.
 *
 * `since` is when the current plan started. Sessions booked before that were booked under a
 * different arrangement and do not spend this plan's allowance — otherwise a patient who books
 * a session and subscribes afterwards finds their new plan already used up.
 */
export function usage({ appointments = [], rehabPlans = [], since = null } = {}, now = new Date()) {
  const thisMonth = monthKey(now);
  const sessions = appointments.filter((a) => {
    if (!a || a.status === "cancelled") return false;
    if (sessionMonth(a) !== thisMonth) return false;
    if (since && a.createdAt && a.createdAt < since) return false;
    return true;
  }).length;
  const plans = rehabPlans.filter((p) => p && p.status !== "archived").length;
  return { sessionsThisMonth: sessions, rehabPlans: plans, month: thisMonth };
}

const allowance = (limit, used, extra = 0) => {
  const total = limit + extra;
  return { used, limit: total, remaining: Math.max(0, total - used), exhausted: used >= total };
};

/**
 * What this patient may do right now: the plan's allowances minus what they have already used,
 * plus any extra sessions they bought on top.
 */
export function entitlement({ subscription, appointments, rehabPlans, extraSessions = 0 } = {}, now = new Date()) {
  const plan = activePlan(subscription);
  // The allowance counts from the start of the current billing period, or from when the plan
  // was first granted.
  const since = subscription?.currentPeriodStart || subscription?.startedAt || null;
  const used = usage({ appointments, rehabPlans, since }, now);
  return {
    plan,
    sessions: allowance(plan.liveSessionsPerMonth, used.sessionsThisMonth, extraSessions),
    plans: allowance(plan.rehabPlans, used.rehabPlans),
    therapistChoice: plan.therapistChoice,
    priorityBooking: plan.priorityBooking,
    renewsOn: nextReset(now),
  };
}

/** When the monthly session allowance comes back. */
export function nextReset(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/** May they book another live session, and if not, why not? */
export function canBookSession(ctx, now = new Date()) {
  const e = entitlement(ctx, now);
  if (e.plan.liveSessionsPerMonth === 0 && !e.sessions.limit) {
    return { allowed: false, reason: "no-plan", entitlement: e, message: "Live sessions are part of the Recover plan and above." };
  }
  if (e.sessions.exhausted) {
    return {
      allowed: false,
      reason: "exhausted",
      entitlement: e,
      message: `You have used all ${e.sessions.limit} sessions this month. They renew on ${e.renewsOn.toLocaleDateString()}.`,
    };
  }
  return { allowed: true, reason: "ok", entitlement: e, message: `${e.sessions.remaining} of ${e.sessions.limit} sessions left this month.` };
}

/** May they start another rehab plan? */
export function canCreateRehabPlan(ctx, now = new Date()) {
  const e = entitlement(ctx, now);
  if (e.plans.exhausted) {
    return {
      allowed: false,
      reason: "exhausted",
      entitlement: e,
      message: `Your plan covers ${e.plans.limit} rehab plan${e.plans.limit === 1 ? "" : "s"}. Replace the current one, or upgrade for more.`,
    };
  }
  return { allowed: true, reason: "ok", entitlement: e, message: `${e.plans.remaining} of ${e.plans.limit} rehab plans left.` };
}

/** May they pick which physiotherapist sees them? */
export function canChooseTherapist(ctx) {
  const e = entitlement(ctx);
  return {
    allowed: e.therapistChoice,
    entitlement: e,
    message: e.therapistChoice ? "Choose the physiotherapist you would like." : "Choosing your own physiotherapist comes with the Recover plan.",
  };
}

/** "₹499" / "Free", for display. */
export const priceLabel = (plan) => (plan.priceInr === 0 ? "Free" : `₹${plan.priceInr.toLocaleString("en-IN")}`);

/** The next plan up, for an upgrade prompt. */
export function nextPlanUp(planId) {
  const i = PLANS.findIndex((p) => p.id === planId);
  return i >= 0 && i < PLANS.length - 1 ? PLANS[i + 1] : null;
}
