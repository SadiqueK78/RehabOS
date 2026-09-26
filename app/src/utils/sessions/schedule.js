/**
 * When a booked physiotherapy session can be joined.
 *
 * This used to be duplicated in the patient's booking page and the therapist's dashboard, and
 * the two copies disagreed: the patient's version only accepted status "scheduled", so the
 * moment the therapist started the call (which sets the status to "in-progress") the patient's
 * Join button went dead and they were locked out of the call waiting for them.
 *
 * One rule for both sides now: a live session is always joinable, and a scheduled one opens a
 * quarter of an hour early and stays open for two hours.
 */

export const JOIN_OPENS_MIN = 15; // the door opens this long before the start
export const JOIN_CLOSES_MIN = 120; // and closes this long after it

/** The scheduled start as a local Date, or null when the session has no confirmed slot. */
export function sessionStart(appt) {
  if (!appt?.scheduledDate || !appt?.scheduledTime) return null;
  // Pad "9:05" to "09:05" so every browser parses it, and leave it without a timezone suffix
  // so it is read in the patient's own timezone rather than UTC.
  const time = String(appt.scheduledTime).trim().replace(/^(\d):/, "0$1:");
  const start = new Date(`${appt.scheduledDate}T${time}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * What this appointment is doing right now.
 * `state` is one of: cancelled, completed, pending, unscheduled, soon, joinable, live, missed.
 */
export function sessionState(appt, now = new Date()) {
  const base = { start: null, minutesUntil: null, canJoin: false };
  if (!appt) return { ...base, state: "unscheduled" };
  if (appt.status === "cancelled") return { ...base, state: "cancelled" };
  if (appt.status === "completed") return { ...base, state: "completed" };
  if (appt.status === "pending") return { ...base, state: "pending" };

  const start = sessionStart(appt);

  // A call that is already running can always be joined, however long it has been going: a
  // patient whose connection dropped has to be able to come back.
  if (appt.status === "in-progress") {
    return { start, minutesUntil: start ? (start - now) / 60000 : null, canJoin: true, state: "live" };
  }
  if (appt.status !== "scheduled") return { ...base, state: "unscheduled" };
  if (!start) return { ...base, state: "unscheduled" };

  const minutesUntil = (start - now) / 60000;
  if (minutesUntil > JOIN_OPENS_MIN) return { start, minutesUntil, canJoin: false, state: "soon" };
  if (minutesUntil < -JOIN_CLOSES_MIN) return { start, minutesUntil, canJoin: false, state: "missed" };
  return { start, minutesUntil, canJoin: true, state: "joinable" };
}

/** Can this person open the session room right now? */
export const canJoinSession = (appt, now = new Date()) => sessionState(appt, now).canJoin;

/** Where the session room lives. */
export const sessionPath = (appt) => `/session/${appt?.id ?? ""}`;

/**
 * Should we tell this person their session is starting? True from the moment the door opens
 * until ten minutes after the start, so someone who arrives late is still told where to go.
 */
export function reminderDue(appt, now = new Date()) {
  const { state, minutesUntil } = sessionState(appt, now);
  // A call that is already running is always worth announcing: whoever sees this reminder is
  // by definition not in the room yet, and the other person is sitting there waiting.
  if (state === "live") return true;
  if (state !== "joinable" || minutesUntil === null) return false;
  return minutesUntil <= JOIN_OPENS_MIN && minutesUntil >= -10;
}

/** Identifies one reminder, so the same session is not announced twice. */
export const reminderKey = (appt) => `${appt?.id}:${appt?.scheduledDate}T${appt?.scheduledTime}`;

/** A short human sentence for the reminder. */
export function reminderText(appt, now = new Date()) {
  const { state, minutesUntil } = sessionState(appt, now);
  const who = appt?.therapistName ? `with ${appt.therapistName}` : "with your physiotherapist";
  if (state === "live") return `Your session ${who} is live now.`;
  if (minutesUntil !== null && minutesUntil > 1) return `Your session ${who} starts in ${Math.round(minutesUntil)} minutes.`;
  return `Your session ${who} is starting now.`;
}

/**
 * Today as the calendar sees it here, for the earliest bookable date.
 * `toISOString().split("T")[0]` was wrong for anyone east or west of UTC: in India it reported
 * yesterday until half past five in the morning, so the date picker let patients book a day
 * that had already gone.
 */
export function todayLocal(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Is this requested slot still in the future? */
export function isFutureSlot(date, time, now = new Date()) {
  if (!date || !time) return false;
  const when = sessionStart({ scheduledDate: date, scheduledTime: time });
  return !!when && when.getTime() > now.getTime();
}
