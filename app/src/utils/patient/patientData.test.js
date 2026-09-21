import {
  VITALS,
  latestVitals,
  dailySeries,
  exerciseStreak,
  weekSummary,
  todaysPlan,
  mobilityByExercise,
  mobilityChange,
  bmi,
  insights,
  dateKey,
} from "./patientData";

jest.mock("../../firebaseConfig", () => ({ db: {} }));
jest.mock("firebase/auth", () => ({ getAuth: jest.fn(), onAuthStateChanged: jest.fn() }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), onSnapshot: jest.fn(), setDoc: jest.fn(), deleteField: jest.fn() }));

const day = (n, h = 10) => new Date(2026, 8, n, h).getTime(); // September 2026

test("vital signs are classified with standard adult ranges", () => {
  expect(VITALS.heartRate.classify(72)).toBe("normal");
  expect(VITALS.heartRate.classify(110)).toBe("high");
  expect(VITALS.bloodPressure.classify([118, 76])).toBe("normal");
  expect(VITALS.bloodPressure.classify([132, 84])).toBe("elevated");
  expect(VITALS.bloodPressure.classify([150, 95])).toBe("high");
  expect(VITALS.spo2.classify(98)).toBe("normal");
  expect(VITALS.spo2.classify(92)).toBe("low");
  expect(VITALS.temperature.classify(38.4)).toBe("fever");
});

test("latest vitals take the newest value of each measure", () => {
  const logs = {
    a: { at: day(10), heartRate: 80, systolic: 130, diastolic: 85 },
    b: { at: day(12), heartRate: 72, sleepHours: 7 },
  };
  const v = latestVitals(logs);
  expect(v.heartRate.value).toBe(72);
  expect(v.bloodPressure.value).toEqual([130, 85]);
  expect(v.sleepHours.value).toBe(7);
});

test("daily series averages per day and leaves gaps empty", () => {
  const logs = { a: { at: day(18, 8), heartRate: 70 }, b: { at: day(18, 20), heartRate: 80 }, c: { at: day(20), heartRate: 75 } };
  const s = dailySeries(logs, "heartRate", 3, new Date(2026, 8, 20, 12));
  expect(s.map((p) => p.value)).toEqual([75, null, 75]);
});

test("streak counts consecutive days ending today or yesterday", () => {
  const hist = { [day(17)]: {}, [day(18)]: {}, [day(19)]: {} };
  expect(exerciseStreak(hist, new Date(2026, 8, 19, 20))).toBe(3);
  expect(exerciseStreak(hist, new Date(2026, 8, 20, 9))).toBe(3); // nothing yet today
  expect(exerciseStreak(hist, new Date(2026, 8, 22, 9))).toBe(0);
});

test("week summary adds up sessions, reps and minutes", () => {
  const hist = { [day(19)]: { repCount: 10, duration: 300 }, [day(20)]: { repCount: 5, duration: 120 }, [day(1)]: { repCount: 99, duration: 999 } };
  expect(weekSummary(hist, day(20, 12))).toEqual({ sessions: 2, reps: 15, minutes: 7, activeDays: 2 });
});

test("today's plan combines scheduled exercises, reminders and appointments", () => {
  const now = new Date(2026, 8, 21, 9); // Monday
  const plan = todaysPlan(
    {
      rehabPlan: {
        exercises: [{ id: "heelSlide", name: "Heel Slide", reps: 10, sets: 2 }],
        weeklySchedule: [{ exercises: ["heelSlide"] }, { exercises: [] }],
      },
      reminders: [{ id: "m1", type: "medication", title: "Blood pressure tablet", time: "08:00" }],
      planDone: { [dateKey(now)]: ["reminder:m1"] },
      exerciseHistory: { [day(21, 8)]: { exercise: "Heel Slide", exerciseKey: "heelSlide", repCount: 10 } },
      appointments: [{ id: "a1", scheduledDate: dateKey(now), scheduledTime: "14:00", status: "scheduled", therapistName: "Dr. Meena" }],
    },
    now
  );
  expect(plan.map((i) => [i.type, i.title, i.done])).toEqual([
    ["medication", "Blood pressure tablet", true],
    ["appointment", "Session with Dr. Meena", false],
    ["exercise", "Heel Slide", true],
  ]);
});

test("mobility change compares latest sessions with the first ones", () => {
  const hist = {};
  [50, 52, 54, 60, 64, 66].forEach((range, i) => (hist[day(i + 1)] = { exercise: "Heel Slide", rom: { "Knee Angle": { min: 180 - range, max: 180 } } }));
  const points = mobilityByExercise(hist)["Heel Slide"];
  expect(points.map((p) => p.range)).toEqual([50, 52, 54, 60, 64, 66]);
  expect(mobilityChange(points)).toBe(22); // 52 → 63.3
});

test("bmi and insights", () => {
  expect(bmi({ heightCm: 168, weightKg: 68 })).toEqual({ value: 24.1, category: "Normal" });
  const found = insights({ healthLogs: { a: { at: Date.now(), systolic: 150, diastolic: 95, heartRate: 72 } }, exerciseHistory: {}, profile: {} });
  expect(found[0].level).toBe("warning");
  expect(found.map((i) => i.text).join(" ")).toMatch(/blood pressure/i);
});
