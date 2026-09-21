import { genCheck } from "../GenFeedback";

/**
 * Builders for rehab exercises, which mostly share one of two shapes:
 *
 *  - range:  move a joint from its start angle past a threshold to a target and back (1 rep).
 *            e.g. heel slide (knee bends to 100°), arm raise (shoulder lifts to 150°).
 *  - hold:   keep a position for a number of seconds (1 rep per completed hold).
 *            e.g. single-leg balance.
 *
 * Each returns { info, check } in the shape ExercisePage expects: `info` is the FSM description
 * (states, joints, targets, angleSetters) and `check(landmarks, onFeedback, setColor,
 * setAngle, setRepCount, ...targets)` runs one frame through the shared genCheck engine.
 */

/**
 * @param {object} cfg
 * @param {string} cfg.title - display title
 * @param {string} cfg.angle - angle name used for jointAngles/targets/setter, e.g. "Knee"
 * @param {object} cfg.jointAngles - { leftKneeAngle: [a, b, c], rightKneeAngle: [...] }
 * @param {object} cfg.joints - { left: {...}, right: {...} } landmarks that must be visible
 * @param {"down"|"up"} cfg.direction - whether the angle decreases or increases toward the target
 * @param {number} cfg.threshold - angle at which movement is considered started
 * @param {number} cfg.target - angle that counts as reaching the goal
 * @param {"best"|"closer"} [cfg.pick] - use whichever side moved furthest, or the side facing the camera
 * @param {object} cfg.cues - feedback text: { ready, moving, target, done }
 */
export function makeRangeExercise(cfg) {
  const { title, angle, jointAngles, joints, direction, threshold, target, pick = "best", cues } = cfg;
  const thresholdKey = `threshold${angle}Angle`;
  const targetKey = `target${angle}Angle`;

  const info = {
    states: {
      READY: { feedback: cues.ready, audio: false, countRep: false, color: "yellow" },
      MOVING: { feedback: cues.moving, audio: true, countRep: false, color: "yellow" },
      TARGET: { feedback: cues.target, audio: true, countRep: false, color: "green" },
      DONE: { feedback: cues.done, audio: false, countRep: true, color: "green" },
    },
    transitions: {
      READY: { moving: "MOVING", hit: "TARGET" },
      MOVING: { hit: "TARGET", back: "READY" },
      TARGET: { back: "DONE" },
      DONE: { moving: "MOVING", hit: "TARGET" },
    },
    jointInfo: { joints, jointAngles },
    targets: { [thresholdKey]: threshold, [targetKey]: target },
    angleSetters: [`set${angle}Angle`],
    title,
    rehab: true,
  };

  const past = (v, limit) => (direction === "down" ? v <= limit : v >= limit);

  const value = (jointData, closerSide) => {
    const left = jointData[`left${angle}Angle`];
    const right = jointData[`right${angle}Angle`];
    if (pick === "closer") return closerSide === "left" ? left : right;
    return direction === "down" ? Math.min(left, right) : Math.max(left, right);
  };

  const getTransitionType = (jointData, closerSide) => {
    const v = value(jointData, closerSide);
    if (!Number.isFinite(v)) return null;
    if (past(v, info.targets[targetKey])) return "hit";
    if (past(v, info.targets[thresholdKey])) return "moving";
    return "back";
  };

  let state;
  const check = (landmarks, onFeedbackUpdate, setColor, setAngle, setRepCount, targetValue = target) => {
    info.targets[targetKey] = targetValue;
    state = genCheck(info, getTransitionType, state, landmarks, onFeedbackUpdate, setColor, setRepCount, {
      [`${angle}Angle`]: setAngle,
    });
  };

  return { info, check };
}

/**
 * Timed hold on one leg: a foot counts as lifted when the ankles differ in height by a set
 * fraction of leg length; holding for `seconds` counts one rep, then the foot must come down.
 */
export function makeBalanceHold({ title, seconds, cues }) {
  const info = {
    states: {
      STANDING: { feedback: cues.ready, audio: false, countRep: false, color: "yellow" },
      HOLDING: { feedback: cues.holding, audio: true, countRep: false, color: "yellow" },
      HELD: { feedback: cues.done, audio: true, countRep: true, color: "green" },
    },
    transitions: {
      STANDING: { lift: "HOLDING" },
      HOLDING: { held: "HELD", down: "STANDING" },
      HELD: { down: "STANDING" },
    },
    jointInfo: {
      joints: {
        left: { leftHip: 23, leftKnee: 25, leftAnkle: 27 },
        right: { rightHip: 24, rightKnee: 26, rightAnkle: 28 },
      },
      jointAngles: {},
      jointPos: { leftHipPos: 23, rightHipPos: 24, leftAnklePos: 27, rightAnklePos: 28 },
    },
    targets: { targetHoldTime: seconds },
    angleSetters: ["setHoldTime"],
    title,
    rehab: true,
    // Holding still is the point of the exercise, so frames without motion still advance it.
    allowStatic: true,
  };

  let holdStart = null;
  const getTransitionType = (jd) => {
    const legLen =
      (Math.abs(jd.leftHipPos.y - jd.leftAnklePos.y) + Math.abs(jd.rightHipPos.y - jd.rightAnklePos.y)) / 2 ||
      1;
    const lifted = Math.abs(jd.leftAnklePos.y - jd.rightAnklePos.y) / legLen > 0.12;
    if (!lifted) {
      holdStart = null;
      jd.leftHoldTime = jd.rightHoldTime = 0;
      return "down";
    }
    holdStart = holdStart ?? Date.now();
    const held = (Date.now() - holdStart) / 1000;
    jd.leftHoldTime = jd.rightHoldTime = Math.round(held * 10) / 10;
    return held >= info.targets.targetHoldTime ? "held" : "lift";
  };

  let state;
  const check = (
    landmarks,
    onFeedbackUpdate,
    setColor,
    setHoldTime,
    setRepCount,
    targetHoldTime = seconds,
  ) => {
    info.targets.targetHoldTime = targetHoldTime;
    state = genCheck(info, getTransitionType, state, landmarks, onFeedbackUpdate, setColor, setRepCount, {
      HoldTime: setHoldTime,
    });
  };

  return { info, check };
}
