import { makeRangeExercise } from "./rehabFactory";

/** Standing Hip Abduction: one rep when the abduction angle goes above 100° and reaches 112°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Standing Hip Abduction",
  angle: "Abduction",
  jointAngles: {
    leftAbductionAngle: [24, 23, 25],
    rightAbductionAngle: [23, 24, 26],
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
  threshold: 100,
  target: 112,
  cues: {
    ready: "Lift one leg out to the side",
    moving: "Keep your body upright",
    target: "Good! Lower slowly",
    done: "Well done",
  },
});

export const hipAbductionInfo = info;
export const checkHipAbduction = check;
