import { buildDemoData, startDemo, exitDemo, isDemoActive, getDemoData } from "./demoPatient";
import { todaysPlan, latestVitals, insights, addHealthLog, setPlanDone, dateKey } from "./patientData";
import { setDoc } from "firebase/firestore";

jest.mock("../../firebaseConfig", () => ({ db: {} }));
jest.mock("firebase/auth", () => ({ getAuth: jest.fn(), onAuthStateChanged: jest.fn() }));
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), onSnapshot: jest.fn(), setDoc: jest.fn(() => Promise.resolve()), deleteField: jest.fn() }));

afterEach(() => exitDemo());

test("demo patient has a complete, realistic record", () => {
  const data = buildDemoData();
  expect(data.profile).toMatchObject({ name: "Ramesh Sharma", age: 72, twinAvatar: "senior" });
  expect(latestVitals(data.healthLogs).bloodPressure).toBeTruthy();
  // Today's plan resolves names and doses from the saved-plan shape (ids + exerciseDetails).
  const plan = todaysPlan({ ...data, appointments: data.appointments });
  const exercises = plan.filter((i) => i.type === "exercise");
  expect(exercises.length).toBeGreaterThanOrEqual(3);
  expect(exercises[0].title).not.toMatch(/^[a-z]+[A-Z]/); // a display name, not an id
  expect(plan.some((i) => i.type === "appointment")).toBe(true);
  expect(insights(data).length).toBeGreaterThan(2);
});

test("in demo mode writes go to the local demo record, never Firestore", async () => {
  startDemo();
  expect(isDemoActive()).toBe(true);
  await addHealthLog("demo.patient@rehabos.app", { heartRate: 88 }, 123);
  await setPlanDone("demo.patient@rehabos.app", dateKey(), ["x"]);
  expect(getDemoData().healthLogs["123"].heartRate).toBe(88);
  expect(getDemoData().planDone[dateKey()]).toEqual(["x"]);
  expect(setDoc).not.toHaveBeenCalled();
  exitDemo();
  expect(isDemoActive()).toBe(false);
});
