import { makeRangeExercise } from "./rehabFactory";

/** Heel Slide: one rep when the knee angle goes below 150° and reaches 100°, then returns. */
const { info, check } = makeRangeExercise({
  title: "Heel Slide",
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
  threshold: 150,
  target: 100,
  cues: {
    ready: "Slide your heel toward you",
    moving: "Keep sliding, bend the knee",
    target: "Good bend! Slide back out",
    done: "Great rep!",
  },
});

export const heelSlideInfo = info;
export const checkHeelSlide = check;
