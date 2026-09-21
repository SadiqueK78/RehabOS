import {
  shapesToMap,
  moodFromShapes,
  summariseSamples,
  moodByDay,
  moodStreak,
  happyPoints,
  happyMeter,
  moodMessage,
} from "./faceMood";

const NOW = new Date("2026-09-20T18:00:00");
const daysAgo = (n, hour = 9) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};
const logs = (entries) => Object.fromEntries(entries.map((e, i) => [`k${i}`, e]));

// A blendshape set roughly matching what the face landmarker reports for each expression.
const NEUTRAL = { mouthSmileLeft: 0.04, mouthSmileRight: 0.04, browDownLeft: 0.1, browDownRight: 0.1 };
const SMILE = { mouthSmileLeft: 0.7, mouthSmileRight: 0.72, cheekSquintLeft: 0.45, cheekSquintRight: 0.4 };
const SAD = { mouthFrownLeft: 0.5, mouthFrownRight: 0.55, browInnerUp: 0.45, browDownLeft: 0.2, browDownRight: 0.2 };

describe("moodFromShapes", () => {
  it("reads a neutral face as the middle of the scale", () => {
    const { mood, score } = moodFromShapes(NEUTRAL);
    expect(mood).toBe(3);
    expect(score).toBeGreaterThan(0.35);
    expect(score).toBeLessThan(0.65);
  });

  it("reads a smile as a high mood", () => {
    expect(moodFromShapes(SMILE).mood).toBe(5);
  });

  it("reads a frowning, worried face as a low mood", () => {
    expect(moodFromShapes(SAD).mood).toBeLessThanOrEqual(2);
  });

  it("keeps the score inside 0..1 and survives missing shapes", () => {
    expect(moodFromShapes({}).score).toBe(0.5);
    const extreme = moodFromShapes({ mouthSmileLeft: 1, mouthSmileRight: 1, cheekSquintLeft: 1, cheekSquintRight: 1 });
    expect(extreme.score).toBe(1);
    expect(moodFromShapes(undefined).mood).toBe(3);
  });

  it("converts landmarker categories into a lookup", () => {
    const map = shapesToMap([{ categoryName: "mouthSmileLeft", score: 0.6 }, { displayName: "browInnerUp", score: 0.2 }]);
    expect(map).toEqual({ mouthSmileLeft: 0.6, browInnerUp: 0.2 });
  });
});

// Blendshapes MediaPipe actually produced for the four (smiling) team photos in src/assets,
// captured by running the real face_landmarker model in a headless browser.
const REAL_FACES = {
  anish: { mouthSmileLeft: 0.476, mouthSmileRight: 0.248, browDownLeft: 0.216, browDownRight: 0.191, browInnerUp: 0.002, mouthPressLeft: 0.059, mouthPressRight: 0.009 },
  howell: { mouthSmileLeft: 0.72, mouthSmileRight: 0.784, browDownLeft: 0.028, browDownRight: 0.038, browInnerUp: 0.053, mouthPressLeft: 0.01, mouthPressRight: 0.02 },
  james: { mouthSmileLeft: 0.865, mouthSmileRight: 0.787, browDownLeft: 0.022, browDownRight: 0.029, browInnerUp: 0.064, mouthPressLeft: 0.037, mouthPressRight: 0.028 },
  jilin: { mouthSmileLeft: 0.891, mouthSmileRight: 0.894, browDownLeft: 0.061, browDownRight: 0.067, browInnerUp: 0.004, mouthPressLeft: 0.077, mouthPressRight: 0.2 },
};

describe("real faces", () => {
  it.each(Object.entries(REAL_FACES))("reads %s as a happy face", (_name, shapes) => {
    expect(moodFromShapes(shapes).mood).toBeGreaterThanOrEqual(4);
  });
});

describe("summariseSamples", () => {
  it("uses the best sustained expression rather than the average", () => {
    const samples = [0.5, 0.52, 0.5, 0.9, 0.92, 0.88];
    expect(summariseSamples(samples).score).toBeGreaterThan(0.85);
  });

  it("ignores a single stray frame", () => {
    const samples = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1];
    expect(summariseSamples(samples).score).toBe(0.5);
  });

  it("returns null when the face was never seen", () => {
    expect(summariseSamples([])).toBeNull();
    expect(summariseSamples([NaN, undefined])).toBeNull();
  });
});

describe("streaks and points", () => {
  it("counts consecutive days up to today", () => {
    const h = logs([{ at: daysAgo(0), mood: 4 }, { at: daysAgo(1), mood: 3 }, { at: daysAgo(2), mood: 5 }]);
    expect(moodStreak(h, NOW)).toBe(3);
  });

  it("keeps yesterday's streak alive before today's check-in", () => {
    const h = logs([{ at: daysAgo(1), mood: 3 }, { at: daysAgo(2), mood: 3 }]);
    expect(moodStreak(h, NOW)).toBe(2);
  });

  it("resets after a missed day", () => {
    const h = logs([{ at: daysAgo(0), mood: 4 }, { at: daysAgo(3), mood: 4 }]);
    expect(moodStreak(h, NOW)).toBe(1);
  });

  it("takes the best entry per day and ignores logs without a mood", () => {
    const h = logs([{ at: daysAgo(0, 8), mood: 2 }, { at: daysAgo(0, 20), mood: 5 }, { at: daysAgo(1), weight: 70 }]);
    expect(Object.keys(moodByDay(h))).toHaveLength(1);
    expect(Object.values(moodByDay(h))[0]).toBe(5);
    expect(moodStreak(h, NOW)).toBe(1);
  });

  it("awards points for checking in, never fewer for a low mood", () => {
    const happy = happyPoints(logs([{ at: daysAgo(0), mood: 5 }]), NOW);
    const low = happyPoints(logs([{ at: daysAgo(0), mood: 1 }]), NOW);
    expect(low.points).toBe(happy.points);
    expect(low.points).toBe(10);
  });

  it("pays a growing bonus for consecutive days", () => {
    const three = happyPoints(logs([0, 1, 2].map((n) => ({ at: daysAgo(n), mood: 3 }))), NOW);
    expect(three.points).toBe(10 + 12 + 14);
    expect(three.days).toBe(3);
    expect(three.streak).toBe(3);
  });

  it("starts at zero with no check-ins", () => {
    expect(happyPoints({}, NOW)).toEqual({ points: 0, days: 0, streak: 0 });
  });
});

describe("happyMeter", () => {
  it("fills the meter from the recent average mood", () => {
    const h = logs([0, 1, 2].map((n) => ({ at: daysAgo(n), mood: 5 })));
    expect(happyMeter(h, 7, NOW).percent).toBe(100);
    expect(happyMeter(logs([{ at: daysAgo(0), mood: 3 }]), 7, NOW).percent).toBe(50);
  });

  it("compares this week with the one before", () => {
    const h = logs([
      ...[0, 1, 2].map((n) => ({ at: daysAgo(n), mood: 4 })),
      ...[8, 9].map((n) => ({ at: daysAgo(n), mood: 2 })),
    ]);
    expect(happyMeter(h, 7, NOW).change).toBe(2);
  });

  it("reports nothing to show when there are no check-ins", () => {
    expect(happyMeter({}, 7, NOW)).toEqual({ percent: null, average: null, change: null, checkIns: 0 });
  });
});

describe("moodMessage", () => {
  it("mentions the streak once it is worth mentioning", () => {
    expect(moodMessage(5, 4)).toMatch(/4 days in a row/);
    expect(moodMessage(5, 1)).not.toMatch(/row/);
  });

  it("points a persistently low mood towards a clinician", () => {
    expect(moodMessage(1, 3)).toMatch(/physiotherapist|doctor/);
  });
});
