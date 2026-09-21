import { makeRangeExercise } from "./rehabFactory";

/** Side Arm Raise: one rep when the shoulder angle goes above 35° and reaches 85°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Side Arm Raise",
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
  threshold: 35,
  target: 85,
  cues: {
    ready: "Lift your arms out to the sides",
    moving: "Up to shoulder height",
    target: "Good! Lower slowly",
    done: "Well done",
  },
});

export const sideArmRaiseInfo = info;
export const checkSideArmRaise = check;
