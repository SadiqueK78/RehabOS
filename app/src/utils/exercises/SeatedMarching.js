import { makeRangeExercise } from "./rehabFactory";

/** Seated Marching: one rep when the hip angle goes below 86° and reaches 74°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Seated Marching",
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
  threshold: 86,
  target: 74,
  cues: {
    ready: "Lift one knee",
    moving: "Lift a little higher",
    target: "Good! Lower it slowly",
    done: "Now the other leg",
  },
});

export const seatedMarchingInfo = info;
export const checkSeatedMarching = check;
