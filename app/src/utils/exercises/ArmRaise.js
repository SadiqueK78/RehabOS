import { makeRangeExercise } from "./rehabFactory";

/** Arm Raise: one rep when the shoulder angle goes above 45° and reaches 150°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Arm Raise",
  angle: "Shoulder",
  jointAngles: {
    leftShoulderAngle: [23, 11, 13],
    rightShoulderAngle: [24, 12, 14],
  },
  joints: {
    left: {
      leftShoulder: 11,
      leftElbow: 13,
      leftHip: 23,
    },
    right: {
      rightShoulder: 12,
      rightElbow: 14,
      rightHip: 24,
    },
  },
  direction: "up",
  threshold: 45,
  target: 150,
  cues: {
    ready: "Raise your arms forward and up",
    moving: "Keep going up",
    target: "Great reach! Lower slowly",
    done: "Well done",
  },
});

export const armRaiseInfo = info;
export const checkArmRaise = check;
