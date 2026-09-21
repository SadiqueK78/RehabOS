/**
 * Turns MediaPipe face blendshapes into a mood reading.
 *
 * The face landmarker reports 52 expression signals (0..1) such as mouthSmileLeft or
 * browDownRight. A few of those tell us most of what we need about mood:
 *
 *   positive  smiling mouth, plus cheek raise (the eye crinkle of a genuine smile)
 *   negative  frowning mouth, lowered brows, raised inner brows (worry/sadness),
 *             pressed lips (tension)
 *
 * The result is the same 1-5 mood scale the app already stores for manual entries, so mood
 * charts and insights work the same whichever way it was recorded. Nothing here touches the
 * camera or the network: it is pure arithmetic over numbers, and unit-tested.
 */

export const MOOD_LABELS = ["Very low", "Low", "Okay", "Good", "Great"];
export const MOOD_FACES = ["😣", "😕", "😐", "🙂", "😄"];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const pair = (shapes, a, b) => (get(shapes, a) + get(shapes, b)) / 2;
const get = (shapes, name) => shapes?.[name] ?? 0;

/** Blendshape categories (array of { categoryName, score }) as a plain lookup. */
export function shapesToMap(categories = []) {
  const out = {};
  for (const c of categories) out[c.categoryName || c.displayName] = c.score;
  return out;
}

/**
 * Happiness score 0..1 and mood 1..5 from a blendshape map.
 * A neutral face lands near 0.5 (mood 3); a broad smile reaches 1 (mood 5).
 */
export function moodFromShapes(shapes) {
  const smile = pair(shapes, "mouthSmileLeft", "mouthSmileRight");
  const cheek = pair(shapes, "cheekSquintLeft", "cheekSquintRight");
  const frown = pair(shapes, "mouthFrownLeft", "mouthFrownRight");
  const browDown = pair(shapes, "browDownLeft", "browDownRight");
  const browWorry = get(shapes, "browInnerUp");
  const press = pair(shapes, "mouthPressLeft", "mouthPressRight");

  const positive = smile + 0.4 * cheek;
  const negative = 0.8 * frown + 0.35 * browDown + 0.3 * browWorry + 0.2 * press;
  const score = clamp01(0.5 + 1.2 * positive - 1.0 * negative);

  return {
    score,
    mood: 1 + Math.round(score * 4),
    signals: { smile, cheek, frown, browDown, browWorry },
  };
}

/**
 * One reading from a short check-in. Uses the best sustained expression (the median of the
 * top third of samples) so a genuine smile counts but a single odd frame does not.
 */
export function summariseSamples(samples = []) {
  const scores = samples.filter((s) => Number.isFinite(s)).sort((a, b) => b - a);
  if (!scores.length) return null;
  const top = scores.slice(0, Math.max(1, Math.round(scores.length / 3)));
  const score = top[Math.floor(top.length / 2)];
  return { score, mood: 1 + Math.round(score * 4), samples: scores.length };
}

// -------------------------------------------------------------------------------------------
// Happy meter: points and streaks for checking in (never for being happy — see below)
// -------------------------------------------------------------------------------------------

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Mood entries grouped by day: { "YYYY-MM-DD": best mood that day }. */
export function moodByDay(healthLogs = {}) {
  const out = {};
  for (const e of Object.values(healthLogs || {})) {
    if (!e || !e.at || !e.mood) continue;
    const k = dayKey(new Date(e.at));
    out[k] = Math.max(out[k] || 0, e.mood);
  }
  return out;
}

/** Consecutive days up to today (or yesterday, if today's check-in is still to come). */
export function moodStreak(healthLogs, now = new Date()) {
  const days = moodByDay(healthLogs);
  const d = new Date(now);
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days[dayKey(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/**
 * Happy points. Every check-in earns points regardless of how the patient feels: 10 for showing
 * up, plus a small streak bonus. Low mood never costs points — penalising it would push people
 * to fake a smile, and their physiotherapist needs the honest trend.
 */
export function happyPoints(healthLogs, now = new Date()) {
  const days = Object.keys(moodByDay(healthLogs)).sort();
  let points = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    const d = new Date(`${day}T12:00:00`);
    run = prev && (d - prev) / 86400000 <= 1.5 ? run + 1 : 1;
    prev = d;
    points += 10 + Math.min(10, (run - 1) * 2); // steadier check-ins earn a little more
  }
  return { points, days: days.length, streak: moodStreak(healthLogs, now) };
}

/**
 * The happy meter itself: the average mood over the last `days` days as a 0-100 fill, plus
 * how it compares with the period before. This is what rises and falls with how you feel.
 */
export function happyMeter(healthLogs, days = 7, now = new Date()) {
  const byDay = moodByDay(healthLogs);
  const avgOver = (from, to) => {
    const vals = [];
    for (let i = from; i < to; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const m = byDay[dayKey(d)];
      if (m) vals.push(m);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const recent = avgOver(0, days);
  const previous = avgOver(days, days * 2);
  if (recent === null) return { percent: null, average: null, change: null, checkIns: 0 };
  return {
    percent: Math.round(((recent - 1) / 4) * 100),
    average: Math.round(recent * 10) / 10,
    change: previous === null ? null : Math.round((recent - previous) * 10) / 10,
    checkIns: Object.keys(byDay).length,
  };
}

/** A short, kind message for the result screen. */
export function moodMessage(mood, streak) {
  const streakLine = streak >= 2 ? ` ${streak} days in a row!` : "";
  if (mood >= 5) return `Lovely smile!${streakLine}`;
  if (mood === 4) return `Good to see you smiling.${streakLine}`;
  if (mood === 3) return `Thanks for checking in.${streakLine}`;
  if (mood === 2) return "Thanks for being honest. A gentle exercise or a short walk may lift things a little.";
  return "Thanks for checking in. If you have felt low for a while, please tell your physiotherapist or doctor.";
}
