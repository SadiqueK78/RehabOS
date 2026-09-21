import { makeRangeExercise } from "./rehabFactory";

/** Sit to Stand: one rep when the knee angle goes above 120° and reaches 160°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Sit to Stand",
  angle: "Knee",
  jointAngles: {
    leftKneeAngle: [23, 25, 27],
    rightKneeAngle: [24, 26, 28],
  },
  joints: {
    left: {
      leftHip: 23,
      leftKnee: 25,
      leftAnkle: 27,
    },
    right: {
      rightHip: 24,
      rightKnee: 26,
      rightAnkle: 28,
    },
  },
  direction: "up",
  threshold: 120,
  target: 160,
  pick: "closer",
  cues: {
    ready: "Lean forward and stand up",
    moving: "Push through your heels",
    target: "Stand tall! Now sit down slowly",
    done: "Well done, rep complete",
  },
});

export const sitToStandInfo = info;
export const checkSitToStand = check;
