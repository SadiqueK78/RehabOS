import { makeRangeExercise } from "./rehabFactory";

/** Straight Leg Raise: one rep when the hip angle goes below 168° and reaches 140°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Straight Leg Raise",
  angle: "Hip",
  jointAngles: {
    leftHipAngle: [11, 23, 25],
    rightHipAngle: [12, 24, 26],
  },
  joints: {
    left: {
      leftShoulder: 11,
      leftHip: 23,
      leftKnee: 25,
    },
    right: {
      rightShoulder: 12,
      rightHip: 24,
      rightKnee: 26,
    },
  },
  direction: "down",
  threshold: 168,
  target: 140,
  cues: {
    ready: "Tighten your thigh and lift the straight leg",
    moving: "Keep lifting, knee straight",
    target: "Hold at the top",
    done: "Lower slowly, great rep!",
  },
});

export const straightLegRaiseInfo = info;
export const checkStraightLegRaise = check;
