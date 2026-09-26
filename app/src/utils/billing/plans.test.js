import {
  PLANS,
  FREE_PLAN,
  planById,
  activePlan,
  sessionMonth,
  usage,
  entitlement,
  canBookSession,
  canCreateRehabPlan,
  canChooseTherapist,
  nextReset,
  priceLabel,
  nextPlanUp,
} from "./plans";

const NOW = new Date("2026-09-24T10:00:00");
const sub = (planId, status = "active") => ({ planId, status });
const appt = (date, status = "scheduled") => ({ scheduledDate: date, status });

describe("the plans themselves", () => {
  it("stay under the ceiling UPI AutoPay puts on a recurring charge", () => {
    for (const p of PLANS) expect(p.priceInr).toBeLessThanOrEqual(15000);
  });

  it("get more generous as they get more expensive", () => {
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].priceInr).toBeGreaterThan(PLANS[i - 1].priceInr);
      expect(PLANS[i].liveSessionsPerMonth).toBeGreaterThan(PLANS[i - 1].liveSessionsPerMonth);
      expect(PLANS[i].rehabPlans).toBeGreaterThanOrEqual(PLANS[i - 1].rehabPlans);
    }
  });

  it("keeps the camera exercises free, and only meters physiotherapist time", () => {
    expect(FREE_PLAN.priceInr).toBe(0);
    expect(FREE_PLAN.liveSessionsPerMonth).toBe(0);
    expect(FREE_PLAN.rehabPlans).toBe(1);
    expect(FREE_PLAN.therapistChoice).toBe(false);
  });

  it("names prices the way an Indian patient reads them", () => {
    expect(priceLabel(FREE_PLAN)).toBe("Free");
    expect(priceLabel(planById("carePlus"))).toBe("₹1,799");
  });
});

describe("which plan is in force", () => {
  it("uses the subscribed plan while Stripe says it is paying", () => {
    expect(activePlan(sub("care")).id).toBe("care");
    expect(activePlan(sub("care", "trialing")).id).toBe("care");
    expect(activePlan(sub("care", "past_due")).id).toBe("care");
  });

  it("falls back to free rather than locking a patient out", () => {
    expect(activePlan(sub("care", "canceled")).id).toBe("free");
    expect(activePlan(sub("care", "incomplete_expired")).id).toBe("free");
    expect(activePlan(null).id).toBe("free");
    expect(activePlan(sub("nonsense")).id).toBe("free");
  });
});

describe("counting what has been used", () => {
  it("counts sessions in the month they are booked for", () => {
    expect(sessionMonth(appt("2026-09-24"))).toBe("2026-09");
    expect(sessionMonth({ preferredDate: "2026-10-02" })).toBe("2026-10");
    expect(sessionMonth({})).toBeNull();
  });

  it("ignores cancelled sessions and other months", () => {
    const appointments = [
      appt("2026-09-02"),
      appt("2026-09-20", "completed"),
      appt("2026-09-21", "cancelled"),
      appt("2026-08-30"),
      appt("2026-10-01"),
    ];
    expect(usage({ appointments }, NOW).sessionsThisMonth).toBe(2);
  });

  it("counts rehab plans that are still in use", () => {
    const rehabPlans = [{ status: "approved" }, { status: "pending" }, { status: "archived" }];
    expect(usage({ rehabPlans }, NOW).rehabPlans).toBe(2);
  });
});

describe("what a patient may do", () => {
  it("turns live sessions off on the free plan, with a reason", () => {
    const r = canBookSession({ subscription: null, appointments: [] }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no-plan");
    expect(r.message).toMatch(/Recover/);
  });

  it("allows the plan's sessions and then stops", () => {
    const ctx = (n) => ({ subscription: sub("recover"), appointments: Array.from({ length: n }, () => appt("2026-09-10")) });
    expect(canBookSession(ctx(0), NOW)).toMatchObject({ allowed: true });
    expect(canBookSession(ctx(1), NOW).message).toMatch(/1 of 2 sessions left/);
    const full = canBookSession(ctx(2), NOW);
    expect(full.allowed).toBe(false);
    expect(full.reason).toBe("exhausted");
    expect(full.message).toMatch(/renew/);
  });

  it("counts an extra session bought on top of the plan", () => {
    const ctx = { subscription: sub("recover"), appointments: [appt("2026-09-10"), appt("2026-09-12")], extraSessions: 1 };
    expect(canBookSession(ctx, NOW).allowed).toBe(true);
    expect(entitlement(ctx, NOW).sessions).toMatchObject({ used: 2, limit: 3, remaining: 1 });
  });

  it("limits how many rehab plans are open at once", () => {
    const one = { subscription: sub("recover"), rehabPlans: [{ status: "approved" }] };
    expect(canCreateRehabPlan(one, NOW).allowed).toBe(false);
    const care = { subscription: sub("care"), rehabPlans: [{ status: "approved" }] };
    expect(canCreateRehabPlan(care, NOW).allowed).toBe(true);
  });

  it("only lets paying patients pick their physiotherapist", () => {
    expect(canChooseTherapist({ subscription: null }).allowed).toBe(false);
    expect(canChooseTherapist({ subscription: sub("recover") }).allowed).toBe(true);
    expect(canChooseTherapist({ subscription: null }).message).toMatch(/Recover plan/);
  });

  it("renews the allowance on the first of next month", () => {
    const reset = nextReset(NOW);
    expect(reset.getMonth()).toBe(9); // October
    expect(reset.getDate()).toBe(1);
    expect(nextReset(new Date("2026-12-15T10:00:00")).getFullYear()).toBe(2027);
  });
});

describe("upgrade prompts", () => {
  it("points at the next plan up, and stops at the top", () => {
    expect(nextPlanUp("free").id).toBe("recover");
    expect(nextPlanUp("care").id).toBe("carePlus");
    expect(nextPlanUp("carePlus")).toBeNull();
  });
});
