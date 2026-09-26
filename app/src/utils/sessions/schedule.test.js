import {
  sessionStart,
  sessionState,
  canJoinSession,
  reminderDue,
  reminderKey,
  reminderText,
  todayLocal,
  isFutureSlot,
} from "./schedule";

const NOW = new Date("2026-09-24T14:00:00");
const appt = (over = {}) => ({
  id: "a1",
  status: "scheduled",
  scheduledDate: "2026-09-24",
  scheduledTime: "14:00",
  therapistName: "Dr. Meena Sharma",
  ...over,
});
const at = (hhmm) => new Date(`2026-09-24T${hhmm}:00`);

describe("sessionStart", () => {
  it("reads the slot in the patient's own timezone", () => {
    const start = sessionStart(appt());
    expect(start.getHours()).toBe(14);
    expect(start.getDate()).toBe(24);
  });

  it("copes with a single-digit hour", () => {
    expect(sessionStart(appt({ scheduledTime: "9:30" })).getHours()).toBe(9);
  });

  it("returns null when there is no confirmed slot", () => {
    expect(sessionStart(appt({ scheduledTime: null }))).toBeNull();
    expect(sessionStart(appt({ scheduledDate: "not a date" }))).toBeNull();
    expect(sessionStart(undefined)).toBeNull();
  });
});

describe("the join window", () => {
  it("stays shut until a quarter of an hour before the start", () => {
    expect(sessionState(appt(), at("13:40")).state).toBe("soon");
    expect(canJoinSession(appt(), at("13:40"))).toBe(false);
  });

  it("opens fifteen minutes early", () => {
    expect(sessionState(appt(), at("13:45")).state).toBe("joinable");
    expect(canJoinSession(appt(), at("13:59"))).toBe(true);
    expect(canJoinSession(appt(), at("14:00"))).toBe(true);
  });

  it("stays open for two hours after the start", () => {
    expect(canJoinSession(appt(), at("15:59"))).toBe(true);
    expect(sessionState(appt(), at("16:30")).state).toBe("missed");
    expect(canJoinSession(appt(), at("16:30"))).toBe(false);
  });

  it("lets the patient back into a call that is already running", () => {
    // The therapist starting the call sets the status to in-progress; the patient used to be
    // locked out at exactly that moment.
    const live = appt({ status: "in-progress" });
    expect(canJoinSession(live, at("14:05"))).toBe(true);
    expect(canJoinSession(live, at("18:00"))).toBe(true); // a long session, or a reconnect
    expect(sessionState(live, at("14:05")).state).toBe("live");
  });

  it("never opens for a session that is not booked yet, cancelled or finished", () => {
    expect(sessionState(appt({ status: "pending" }), NOW).state).toBe("pending");
    expect(canJoinSession(appt({ status: "pending" }), NOW)).toBe(false);
    expect(canJoinSession(appt({ status: "cancelled" }), NOW)).toBe(false);
    expect(canJoinSession(appt({ status: "completed" }), NOW)).toBe(false);
    expect(canJoinSession(appt({ scheduledTime: null }), NOW)).toBe(false);
  });
});

describe("reminders", () => {
  it("fires once the door opens and keeps firing until ten minutes after the start", () => {
    expect(reminderDue(appt(), at("13:40"))).toBe(false);
    expect(reminderDue(appt(), at("13:50"))).toBe(true);
    expect(reminderDue(appt(), at("14:09"))).toBe(true);
    expect(reminderDue(appt(), at("14:20"))).toBe(false);
  });

  it("always fires for a session that is already live", () => {
    expect(reminderDue(appt({ status: "in-progress" }), at("15:30"))).toBe(true);
  });

  it("counts down in words, and names the therapist", () => {
    expect(reminderText(appt(), at("13:50"))).toBe("Your session with Dr. Meena Sharma starts in 10 minutes.");
    expect(reminderText(appt(), at("14:00"))).toMatch(/starting now/);
    expect(reminderText(appt({ status: "in-progress" }), at("14:05"))).toMatch(/live now/);
    expect(reminderText(appt({ therapistName: null }), at("13:50"))).toMatch(/your physiotherapist/);
  });

  it("identifies a reminder by session and slot, so rescheduling announces again", () => {
    expect(reminderKey(appt())).toBe("a1:2026-09-24T14:00");
    expect(reminderKey(appt({ scheduledTime: "16:00" }))).not.toBe(reminderKey(appt()));
  });
});

describe("todayLocal", () => {
  it("reports the local calendar date, not the UTC one", () => {
    // 00:30 in India is still the previous day in UTC; toISOString would have said the 23rd.
    expect(todayLocal(new Date("2026-09-24T00:30:00"))).toBe("2026-09-24");
    expect(todayLocal(new Date("2026-09-24T23:30:00"))).toBe("2026-09-24");
  });
});

describe("isFutureSlot", () => {
  it("accepts a later slot and rejects one that has passed", () => {
    expect(isFutureSlot("2026-09-24", "14:30", NOW)).toBe(true);
    expect(isFutureSlot("2026-09-24", "13:30", NOW)).toBe(false);
    expect(isFutureSlot("", "13:30", NOW)).toBe(false);
  });
});
