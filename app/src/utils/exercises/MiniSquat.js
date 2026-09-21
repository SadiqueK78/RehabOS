import { makeRangeExercise } from "./rehabFactory";

/** Mini Squat: one rep when the knee angle goes below 165° and reaches 135°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Mini Squat",
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
  direction: "down",
  threshold: 165,
  target: 135,
  cues: {
    ready: "Bend your knees a little",
    moving: "Hips back, chest up",
    target: "Good depth! Stand up",
    done: "Great rep!",
  },
});

export const miniSquatInfo = info;
export const checkMiniSquat = check;
