import { useEffect, useState } from "react";

/**
 * Demo patient mode: lets anyone explore RehabOS as "Ramesh Sharma", a 72-year-old recovering
 * from a knee replacement, without a Google account. The demo record lives only in this
 * browser (localStorage) and is never written to Firestore; everything the demo patient does
 * (logging health, ticking the plan, saving exercise sessions) updates that local copy.
 */

const FLAG_KEY = "rehabosDemo";
const DATA_KEY = "rehabosDemoData";
export const DEMO_EVENT = "rehabos-demo-change";

export const DEMO_USER = {
  email: "demo.patient@rehabos.app",
  displayName: "Ramesh Sharma",
  isDemo: true,
};

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A realistic two-week recovery history, dated relative to `now`. */
export function buildDemoData(now = new Date()) {
  const at = (daysAgo, h = 9, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  const healthLogs = {};
  for (let i = 13; i >= 0; i--) {
    const t = at(i, 8, 30);
    healthLogs[t] = {
      at: t,
      heartRate: 70 + ((i * 7) % 9),
      systolic: 124 + ((i * 5) % 11),
      diastolic: 78 + ((i * 3) % 7),
      spo2: 96 + (i % 3),
      temperature: 36.5 + (i % 4) / 10,
      sleepHours: 6 + ((i * 3) % 4) * 0.5,
      mood: i < 7 ? 4 : 3,
      moodSource: "camera",
      pain: Math.max(2, Math.round(7 - (13 - i) * 0.35)),
      painArea: "Knee",
    };
  }

  // Heel slides and arm raises with steadily improving range of motion (measured by the camera).
  const exerciseHistory = {};
  [48, 52, 55, 57, 61, 64, 66, 70].forEach((range, i) => {
    exerciseHistory[at(14 - i * 2, 10)] = {
      exercise: "Heel Slide",
      exerciseKey: "heelSlide",
      repCount: 10,
      duration: 300,
      rom: { "Knee Angle": { min: 178 - range, max: 178 } },
    };
  });
  [120, 126, 131, 138, 142].forEach((range, i) => {
    exerciseHistory[at(13 - i * 3, 11)] = {
      exercise: "Arm Raise",
      exerciseKey: "armRaise",
      repCount: 10,
      duration: 240,
      rom: { "Shoulder Angle": { min: 18, max: 18 + range } },
    };
  });
  for (const d of [1, 3, 5]) exerciseHistory[at(d, 18)] = { exercise: "Ankle Pumps", exerciseKey: "anklePumps", repCount: 20, duration: 180 };

  const plan = [
    { id: "anklePumps", name: "Ankle Pumps", reps: 20, sets: 2, holdSeconds: 0, frequencyPerWeek: 7, difficulty: "beginner", muscleGroup: "Ankle & Circulation" },
    { id: "heelSlide", name: "Heel Slide", reps: 10, sets: 2, holdSeconds: 0, frequencyPerWeek: 7, difficulty: "beginner", muscleGroup: "Knee Mobility" },
    { id: "straightLegRaise", name: "Straight Leg Raise", reps: 10, sets: 2, holdSeconds: 2, frequencyPerWeek: 5, difficulty: "beginner", muscleGroup: "Quadriceps" },
    { id: "sitToStand", name: "Sit To Stand", reps: 8, sets: 2, holdSeconds: 0, frequencyPerWeek: 5, difficulty: "beginner", muscleGroup: "Legs & Independence" },
  ];
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weeklySchedule = dayNames.map((dayName, i) => ({
    day: i + 1,
    dayName,
    exercises: i % 2 === 0 ? ["anklePumps", "heelSlide", "straightLegRaise"] : ["anklePumps", "heelSlide", "sitToStand"],
  }));

  const inDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  };

  return {
    profile: {
      name: "Ramesh Sharma",
      age: 72,
      sex: "Male",
      heightCm: 168,
      weightKg: 68,
      condition: "Right knee replacement (6 weeks ago)",
      affectedArea: "Knee",
      twinAvatar: "senior",
    },
    healthLogs,
    exerciseHistory,
    // Same shape the Rehab Plan page saves.
    rehabPlan: {
      injuryDescription: "Right total knee replacement 6 weeks ago. Stiff knee, mild pain when climbing stairs.",
      matchedConditions: ["knee replacement"],
      exercises: plan.map((e) => e.id),
      exerciseDetails: plan,
      weeklySchedule,
      createdAt: at(20),
      status: "approved",
      therapistNotes: "Good progress on knee bend. Keep ice after exercise and add sit-to-stand on alternate days. — Dr. Meena Sharma",
    },
    reminders: [
      { id: "demo-med-1", type: "medication", title: "Paracetamol 500 mg", time: "10:30" },
      { id: "demo-med-2", type: "medication", title: "Blood pressure tablet", time: "20:00" },
      { id: "demo-water", type: "hydration", title: "Drink a glass of water", time: "15:00" },
    ],
    planDone: { [dayKey(now)]: ["reminder:demo-med-1"] },
    appointments: [
      {
        id: "demo-appt-1",
        patientEmail: DEMO_USER.email,
        patientName: "Ramesh Sharma",
        status: "scheduled",
        therapistName: "Dr. Meena Sharma",
        scheduledDate: dayKey(now),
        scheduledTime: "14:00",
        injuryDetails: "Knee replacement follow-up",
        createdAt: at(3),
      },
      {
        id: "demo-appt-2",
        patientEmail: DEMO_USER.email,
        patientName: "Ramesh Sharma",
        status: "pending",
        preferredDate: inDays(3),
        preferredTime: "11:00",
        injuryDetails: "Progress review",
        createdAt: at(1),
      },
    ],
  };
}

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: demo still works for this page view */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// In-memory copy, so the demo still works for this page view when localStorage is blocked.
let memory = { active: false, data: null };

export const isDemoActive = () => storage.get(FLAG_KEY) === "1" || memory.active;

export function getDemoData() {
  const raw = storage.get(DATA_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return memory.data || buildDemoData();
}

const notify = () => window.dispatchEvent(new CustomEvent(DEMO_EVENT));

/** Apply `updater(data) => newData` to the demo record and notify listeners. */
export function updateDemoData(updater) {
  const next = updater(getDemoData());
  memory = { active: true, data: next };
  storage.set(DATA_KEY, JSON.stringify(next));
  notify();
  return Promise.resolve();
}

/** Start (or restart) the demo with fresh data dated to today. */
export function startDemo() {
  const data = buildDemoData();
  memory = { active: true, data };
  storage.set(DATA_KEY, JSON.stringify(data));
  storage.set(FLAG_KEY, "1");
  // The demo patient is an older adult, so start with the senior coach and twin.
  storage.set("coachAvatar", JSON.stringify("senior"));
  notify();
}

export function exitDemo() {
  memory = { active: false, data: null };
  storage.remove(FLAG_KEY);
  storage.remove(DATA_KEY);
  notify();
}

/** { active, data } for the demo patient, updating live when the demo changes. */
export function useDemo() {
  const read = () => ({ active: isDemoActive(), data: isDemoActive() ? getDemoData() : null });
  const [state, setState] = useState(read);
  useEffect(() => {
    const onChange = () => setState(read());
    window.addEventListener(DEMO_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(DEMO_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return state;
}
