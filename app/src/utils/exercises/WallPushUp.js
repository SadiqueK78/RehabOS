import { makeRangeExercise } from "./rehabFactory";

/** Wall Push-up: one rep when the elbow angle goes below 155° and reaches 105°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Wall Push-up",
  angle: "Elbow",
  jointAngles: {
    leftElbowAngle: [11, 13, 15],
    rightElbowAngle: [12, 14, 16],
  },
  joints: {
    left: {
      leftShoulder: 11,
      leftElbow: 13,
      leftWrist: 15,
    },
    right: {
      rightShoulder: 12,
      rightElbow: 14,
      rightWrist: 16,
    },
  },
  direction: "down",
  threshold: 155,
  target: 105,
  cues: {
    ready: "Bend your elbows toward the wall",
    moving: "Keep your body straight",
    target: "Good! Push back out",
    done: "Great rep!",
  },
});

export const wallPushUpInfo = info;
export const checkWallPushUp = check;
