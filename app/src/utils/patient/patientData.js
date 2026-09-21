import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, deleteField } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { DEMO_USER, isDemoActive, updateDemoData, useDemo } from "./demoPatient";

/**
 * Patient data for the dashboard and Digital Twin, stored on the patient's `users/{email}`
 * document (the same document the rest of the app already uses):
 *
 *   profile        { name, age, sex, heightCm, weightKg, condition, affectedArea }
 *   healthLogs     { [timestampMs]: { heartRate, systolic, diastolic, spo2, temperature,
 *                                     sleepHours, mood (1-5), pain (0-10), painArea, note } }
 *   reminders      [{ id, type: "medication"|"hydration"|"custom", title, time: "HH:MM" }]
 *   planDone       { "YYYY-MM-DD": [itemId, ...] }   ticks on Today's Plan
 *   rehabPlan      written by the Rehab Plan page (exercises + weekly schedule)
 *   exerciseHistory written by exercise sessions ({ exercise, repCount, duration, rom })
 */

/**
 * Live view of the signed-in patient's document: { user, data, loading }. In demo mode this is
 * the demo patient (user.isDemo) and their locally stored record.
 */
export function usePatient() {
  const demo = useDemo();
  const [state, setState] = useState({ user: null, data: null, loading: true });

  useEffect(() => {
    const auth = getAuth();
    let unsubDoc = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDoc();
      if (!user) {
        setState({ user: null, data: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, user, loading: true }));
      unsubDoc = onSnapshot(
        doc(db, "users", user.email),
        (snap) => setState({ user, data: snap.exists() ? snap.data() : {}, loading: false }),
        (err) => {
          console.error("usePatient:", err);
          setState({ user, data: {}, loading: false });
        }
      );
    });
    return () => {
      unsubDoc();
      unsubAuth();
    };
  }, []);

  return demo.active ? { user: DEMO_USER, data: demo.data, loading: false } : state;
}

const userRef = (email) => doc(db, "users", email);

// In demo mode every write goes to the local demo record instead of Firestore.
const demoWrite = (fn) => updateDemoData((d) => ({ ...d, ...fn(d) }));

/** Merge fields into the patient profile. */
export const saveProfile = (email, profile) =>
  isDemoActive()
    ? demoWrite((d) => ({ profile: { ...d.profile, ...profile } }))
    : setDoc(userRef(email), { profile }, { merge: true });

export const addHealthLog = (email, entry, at = Date.now()) =>
  isDemoActive()
    ? demoWrite((d) => ({ healthLogs: { ...d.healthLogs, [String(at)]: { ...entry, at } } }))
    : setDoc(userRef(email), { healthLogs: { [String(at)]: { ...entry, at } } }, { merge: true });

export const deleteHealthLog = (email, at) =>
  isDemoActive()
    ? demoWrite((d) => {
        const healthLogs = { ...d.healthLogs };
        delete healthLogs[String(at)];
        return { healthLogs };
      })
    : setDoc(userRef(email), { healthLogs: { [String(at)]: deleteField() } }, { merge: true });

export const saveReminders = (email, reminders) =>
  isDemoActive() ? demoWrite(() => ({ reminders })) : setDoc(userRef(email), { reminders }, { merge: true });

export const setPlanDone = (email, dateKey, doneIds) =>
  isDemoActive()
    ? demoWrite((d) => ({ planDone: { ...d.planDone, [dateKey]: doneIds } }))
    : setDoc(userRef(email), { planDone: { [dateKey]: doneIds } }, { merge: true });

/** Save an exercise session summary ({ [timestamp]: { exercise, repCount, ... } }). */
export const saveExerciseSession = (email, summary) =>
  isDemoActive()
    ? demoWrite((d) => ({ exerciseHistory: { ...d.exerciseHistory, ...summary } }))
    : setDoc(userRef(email), { exerciseHistory: summary }, { merge: true });

// ---------------------------------------------------------------------------------------------
// Pure helpers (no Firebase), unit-tested in patientData.test.js
// ---------------------------------------------------------------------------------------------

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Vital sign definitions: label, unit and the ranges used to flag readings. */
export const VITALS = {
  heartRate: { label: "Heart Rate", unit: "bpm", classify: (v) => (v < 50 ? "low" : v > 100 ? "high" : "normal") },
  bloodPressure: {
    label: "Blood Pressure",
    unit: "mmHg",
    classify: ([s, d]) => (s >= 140 || d >= 90 ? "high" : s >= 130 || d >= 80 ? "elevated" : s < 90 || d < 60 ? "low" : "normal"),
  },
  spo2: { label: "Oxygen Level", unit: "%", classify: (v) => (v < 90 ? "very low" : v < 95 ? "low" : "normal") },
  temperature: {
    label: "Temperature",
    unit: "°C",
    classify: (v) => (v >= 38 ? "fever" : v > 37.2 ? "elevated" : v < 35.5 ? "low" : "normal"),
  },
  sleepHours: { label: "Sleep", unit: "h", classify: (v) => (v < 6 ? "short" : v > 10 ? "long" : "good") },
};

export const STATUS_COLOR = {
  normal: "success",
  good: "success",
  elevated: "warning",
  short: "warning",
  long: "warning",
  low: "warning",
  high: "error",
  fever: "error",
  "very low": "error",
};

export const MOODS = ["Very low", "Low", "Okay", "Good", "Great"];

/** Health log entries sorted oldest → newest. */
export const sortedLogs = (healthLogs = {}) =>
  Object.values(healthLogs || {})
    .filter((e) => e && e.at)
    .sort((a, b) => a.at - b.at);

/** Most recent value of each measure (they may come from different log entries). */
export function latestVitals(healthLogs) {
  const out = {};
  for (const e of sortedLogs(healthLogs)) {
    for (const k of ["heartRate", "spo2", "temperature", "sleepHours", "mood", "pain", "painArea"]) {
      if (e[k] !== undefined && e[k] !== null && e[k] !== "") out[k] = { value: e[k], at: e.at };
    }
    if (e.systolic && e.diastolic) out.bloodPressure = { value: [e.systolic, e.diastolic], at: e.at };
  }
  return out;
}

/** Daily series for charts over the last `days` days: [{ date, label, value }] (null = no reading). */
export function dailySeries(healthLogs, field, days = 7, now = new Date()) {
  const byDay = {};
  for (const e of sortedLogs(healthLogs)) {
    const v = e[field];
    if (v === undefined || v === null || v === "") continue;
    const k = dateKey(new Date(e.at));
    (byDay[k] = byDay[k] || []).push(Number(v));
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const vals = byDay[dateKey(d)];
    out.push({
      date: dateKey(d),
      label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value: vals ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
    });
  }
  return out;
}

/** Exercise sessions sorted oldest → newest. */
export const sortedSessions = (exerciseHistory = {}) =>
  Object.entries(exerciseHistory || {})
    .map(([ts, s]) => ({ ...s, at: Number(ts) }))
    .filter((s) => Number.isFinite(s.at))
    .sort((a, b) => a.at - b.at);

/** Consecutive days (ending today, or yesterday if nothing yet today) with at least one session. */
export function exerciseStreak(exerciseHistory, now = new Date()) {
  const days = new Set(sortedSessions(exerciseHistory).map((s) => dateKey(new Date(s.at))));
  const d = new Date(now);
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Sessions, reps and minutes over the last 7 days. */
export function weekSummary(exerciseHistory, now = Date.now()) {
  const week = sortedSessions(exerciseHistory).filter((s) => now - s.at < 7 * 86400000);
  return {
    sessions: week.length,
    reps: week.reduce((a, s) => a + (s.repCount || 0), 0),
    minutes: Math.round(week.reduce((a, s) => a + (s.duration || 0), 0) / 60),
    activeDays: new Set(week.map((s) => dateKey(new Date(s.at)))).size,
  };
}

const exerciseKeyFromTitle = (title = "") => title.replace(/\s*\(.*\)$/, "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * Today's Plan: exercises scheduled for today in the rehab plan, the patient's reminders and
 * any appointments today. Items are { id, type, title, time?, subtitle?, done, link? }.
 * Exercises also count as done when a session of that exercise was saved today.
 */
export function todaysPlan({ rehabPlan, reminders = [], planDone = {}, exerciseHistory, appointments = [] }, now = new Date()) {
  const key = dateKey(now);
  const ticked = new Set(planDone?.[key] || []);
  const doneToday = new Set(
    sortedSessions(exerciseHistory)
      .filter((s) => dateKey(new Date(s.at)) === key)
      // Sessions store the exercise key; older ones only have the display title.
      .map((s) => (s.exerciseKey || exerciseKeyFromTitle(s.exercise)).toLowerCase())
  );
  const items = [];

  const weekday = (now.getDay() + 6) % 7; // plan schedule starts on Monday
  const scheduled = rehabPlan?.weeklySchedule?.[weekday]?.exercises || [];
  // Saved plans keep ids in `exercises` and reps/sets in `exerciseDetails`.
  const details = [...(rehabPlan?.exerciseDetails || []), ...(rehabPlan?.exercises || []).filter((e) => typeof e === "object")];
  const prettyName = (id) => id.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  for (const id of scheduled) {
    const ex = details.find((e) => e.id === id) || { id, name: prettyName(id) };
    const itemId = `exercise:${id}`;
    const dose = ex.holdSeconds ? `${ex.sets} × ${ex.holdSeconds}s hold` : `${ex.sets || 2} × ${ex.reps || 10} reps`;
    items.push({
      id: itemId,
      type: "exercise",
      title: ex.name || id,
      subtitle: dose,
      done: ticked.has(itemId) || doneToday.has(id.toLowerCase()),
      link: `/exercise?exercise=${id}`,
    });
  }

  for (const r of reminders || []) {
    items.push({ id: `reminder:${r.id}`, type: r.type || "custom", title: r.title, time: r.time, done: ticked.has(`reminder:${r.id}`) });
  }

  for (const a of appointments || []) {
    const date = a.scheduledDate || a.preferredDate;
    if (date !== key || a.status === "cancelled" || a.status === "rejected") continue;
    items.push({
      id: `appointment:${a.id}`,
      type: "appointment",
      title: a.therapistName ? `Session with ${a.therapistName}` : "Physiotherapy session",
      time: a.scheduledTime || a.preferredTime,
      subtitle: a.status === "scheduled" ? "Confirmed" : a.status === "completed" ? "Completed" : "Awaiting confirmation",
      done: a.status === "completed" || ticked.has(`appointment:${a.id}`),
      link: "/book-session",
    });
  }

  return items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

/**
 * Range of motion per exercise from saved sessions: how far the tracked joint moved
 * (max − min angle) in each session. Returns { [exerciseTitle]: [{ at, range, label }] }.
 */
export function mobilityByExercise(exerciseHistory) {
  const out = {};
  for (const s of sortedSessions(exerciseHistory)) {
    if (!s.rom) continue;
    for (const [label, r] of Object.entries(s.rom)) {
      if (!Number.isFinite(r?.min) || !Number.isFinite(r?.max)) continue;
      const range = Math.round(r.max - r.min);
      if (range <= 0) continue;
      (out[s.exercise] = out[s.exercise] || []).push({ at: s.at, range, label });
    }
  }
  return out;
}

/** % change in range of motion: average of the latest 3 sessions vs the first 3 (≥ 4 sessions). */
export function mobilityChange(points) {
  if (!points || points.length < 4) return null;
  const n = Math.min(3, Math.floor(points.length / 2));
  const avg = (arr) => arr.reduce((a, p) => a + p.range, 0) / arr.length;
  const first = avg(points.slice(0, n));
  const last = avg(points.slice(-n));
  return first > 0 ? Math.round(((last - first) / first) * 100) : null;
}

export function bmi(profile) {
  const h = Number(profile?.heightCm) / 100;
  const w = Number(profile?.weightKg);
  if (!h || !w) return null;
  const value = Math.round((w / (h * h)) * 10) / 10;
  const category = value < 18.5 ? "Underweight" : value < 25 ? "Normal" : value < 30 ? "Overweight" : "Obese";
  return { value, category };
}

/** Plain-language observations for the Digital Twin, most important first. */
export function insights({ healthLogs, exerciseHistory, profile }) {
  const out = [];
  const v = latestVitals(healthLogs);
  const flag = (key, value) => VITALS[key].classify(value);

  if (v.bloodPressure) {
    const st = flag("bloodPressure", v.bloodPressure.value);
    if (st === "high") out.push({ level: "warning", text: "Your last blood pressure reading was high. Share it with your doctor if it stays high." });
    else if (st === "normal") out.push({ level: "good", text: "Blood pressure is within the normal range." });
  }
  if (v.spo2 && flag("spo2", v.spo2.value) !== "normal")
    out.push({ level: "warning", text: "Your oxygen level was below 95%. If you feel breathless, contact your doctor." });
  if (v.heartRate) {
    const st = flag("heartRate", v.heartRate.value);
    out.push(
      st === "normal"
        ? { level: "good", text: "Heart rate is within the normal range." }
        : { level: "warning", text: `Your resting heart rate was ${st}. Recheck while resting.` }
    );
  }
  if (v.temperature && flag("temperature", v.temperature.value) === "fever")
    out.push({ level: "warning", text: "You logged a fever. Rest and skip exercise until it settles." });

  const pain = dailySeries(healthLogs, "pain", 14).filter((p) => p.value !== null);
  if (pain.length >= 3) {
    const diff = pain[pain.length - 1].value - pain[0].value;
    if (diff <= -1) out.push({ level: "good", text: `Pain has eased by ${Math.abs(diff)} points over the last two weeks.` });
    if (diff >= 2) out.push({ level: "warning", text: "Pain has been rising. Tell your physiotherapist before your next session." });
  }

  const sleep = dailySeries(healthLogs, "sleepHours", 7).filter((p) => p.value !== null);
  if (sleep.length >= 3) {
    const avg = sleep.reduce((a, p) => a + p.value, 0) / sleep.length;
    out.push(avg >= 6.5 ? { level: "good", text: "Sleep has been good this week." } : { level: "info", text: `You averaged ${avg.toFixed(1)} h of sleep this week; aim for 7 or more.` });
  }

  for (const [exercise, points] of Object.entries(mobilityByExercise(exerciseHistory))) {
    const change = mobilityChange(points);
    if (change !== null && change >= 5) out.push({ level: "good", text: `${exercise}: range of motion improved by ${change}%.` });
    if (change !== null && change <= -10) out.push({ level: "info", text: `${exercise}: range of motion is lower than when you started. Go gently and mention it to your physio.` });
  }

  const week = weekSummary(exerciseHistory);
  if (week.activeDays >= 4) out.push({ level: "good", text: `You exercised on ${week.activeDays} days this week. Great consistency!` });
  else if (week.activeDays === 0 && sortedSessions(exerciseHistory).length) out.push({ level: "info", text: "No exercise sessions this week yet. A short session today helps recovery." });

  const b = bmi(profile);
  if (b && b.category !== "Normal") out.push({ level: "info", text: `BMI ${b.value} (${b.category.toLowerCase()}).` });

  const order = { warning: 0, info: 1, good: 2 };
  return out.sort((a, b2) => order[a.level] - order[b2.level]);
}
