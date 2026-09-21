import { resetRepCount } from "../GenFeedback";
import { checkHeelSlide } from "./HeelSlide";
import { checkStraightLegRaise } from "./StraightLegRaise";
import { checkSitToStand } from "./SitToStand";
import { checkSeatedMarching } from "./SeatedMarching";
import { checkArmRaise } from "./ArmRaise";
import { checkSideArmRaise } from "./SideArmRaise";
import { checkWallPushUp } from "./WallPushUp";
import { checkHipAbduction } from "./HipAbduction";
import { checkMiniSquat } from "./MiniSquat";
import { checkAnklePumps } from "./AnklePumps";
import { checkSingleLegBalance } from "./SingleLegBalance";

jest.mock("../helpers/Audio", () => ({ playSoundCorrectRep: jest.fn(), playText: jest.fn() }));

/** 33 visible landmarks; `angles` maps [a, b, c] index triples to the angle wanted at b. */
function pose(angles, extra = {}) {
  const lm = Array.from({ length: 33 }, (_, i) => ({ x: 0.5 + i * 0.001, y: 0.5, z: 0, visibility: 1 }));
  for (const [[a, b, c], deg] of angles) {
    lm[b] = { ...lm[b], x: 0.5, y: 0.5 };
    lm[a] = { ...lm[a], x: 0.5, y: 0.3 };
    const r = (deg * Math.PI) / 180;
    lm[c] = { ...lm[c], x: 0.5 + 0.2 * Math.sin(r), y: 0.5 - 0.2 * Math.cos(r) };
  }
  for (const [i, p] of Object.entries(extra)) lm[i] = { ...lm[i], ...p };
  return lm;
}

/** Run a sequence of angle values through a range exercise and return the rep count. */
function run(check, triples, sequence, targets = []) {
  resetRepCount(0);
  let reps = 0;
  for (const deg of sequence) {
    check(pose(triples.map((t) => [t, deg])), () => {}, () => {}, () => {}, (n) => (reps = n), ...targets);
  }
  return reps;
}

const cycle = (start, mid, end) => [start, start - 1, mid, end, mid, start, start + 1];
const up = (start, mid, end) => [start, start + 1, mid, end, mid, start, start - 1];

describe("rehab range exercises count one rep per full movement", () => {
  const cases = [
    ["heel slide", checkHeelSlide, [[23, 25, 27], [24, 26, 28]], cycle(175, 130, 95)],
    ["straight leg raise", checkStraightLegRaise, [[11, 23, 25], [12, 24, 26]], cycle(178, 155, 135)],
    ["seated marching", checkSeatedMarching, [[11, 23, 25], [12, 24, 26]], cycle(95, 80, 70)],
    ["wall push-up", checkWallPushUp, [[11, 13, 15], [12, 14, 16]], cycle(172, 130, 100)],
    ["mini squat", checkMiniSquat, [[23, 25, 27], [24, 26, 28]], cycle(176, 150, 130)],
    ["sit to stand", checkSitToStand, [[23, 25, 27], [24, 26, 28]], up(90, 140, 168)],
    ["arm raise", checkArmRaise, [[23, 11, 13], [24, 12, 14]], up(15, 100, 155)],
    ["side arm raise", checkSideArmRaise, [[23, 11, 13], [24, 12, 14]], up(15, 60, 90)],
    ["hip abduction", checkHipAbduction, [[24, 23, 25], [23, 24, 26]], up(90, 105, 116)],
  ];

  test.each(cases)("%s", (_name, check, triples, seq) => {
    expect(run(check, triples, seq)).toBe(1);
    // A second cycle adds another rep; stopping part-way does not.
    resetRepCount(0);
    expect(run(check, triples, [...seq, ...seq])).toBe(2);
    expect(run(check, triples, seq.slice(0, 3))).toBe(0);
  });
});

test("ankle pumps need toes up then down for a rep", () => {
  const ankle = [[25, 27, 31], [26, 28, 32]];
  expect(run(checkAnklePumps, ankle, [105, 104, 88, 100, 126, 110])).toBe(1);
  expect(run(checkAnklePumps, ankle, [105, 104, 88, 95, 100])).toBe(0);
});

test("single-leg balance counts a hold only after the target time", () => {
  resetRepCount(0);
  let reps = 0;
  let now = 1_000_000;
  const spy = jest.spyOn(Date, "now").mockImplementation(() => now);
  const frame = (lifted) =>
    checkSingleLegBalance(
      pose([], { 23: { y: 0.5 }, 24: { y: 0.5 }, 27: { y: lifted ? 0.8 : 0.9 }, 28: { y: 0.9 } }),
      () => {},
      () => {},
      () => {},
      (n) => (reps = n),
      8
    );
  frame(false);
  frame(true);
  now += 5000;
  frame(true);
  expect(reps).toBe(0); // only 5 s
  now += 3500;
  frame(true);
  expect(reps).toBe(1); // 8.5 s held
  now += 5000;
  frame(true);
  expect(reps).toBe(1); // still the same hold
  frame(false);
  frame(true);
  now += 9000;
  frame(true);
  expect(reps).toBe(2);
  spy.mockRestore();
});
