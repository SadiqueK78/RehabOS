import { genCheck } from "../GenFeedback";

/**
 * Ankle pumps: one rep is toes pulled up (dorsiflexion) followed by toes pointed down
 * (plantarflexion). Uses the knee-ankle-toe angle of the leg nearest the camera.
 */
export const anklePumpsInfo = {
  states: {
    NEUTRAL: { feedback: "Pull your toes up toward you", audio: false, countRep: false, color: "yellow" },
    UP: { feedback: "Good! Now point your toes down", audio: true, countRep: false, color: "yellow" },
    DOWN: { feedback: "Great pump! Toes up again", audio: false, countRep: true, color: "green" },
  },
  transitions: {
    NEUTRAL: { up: "UP" },
    UP: { down: "DOWN" },
    DOWN: { up: "UP" },
  },
  jointInfo: {
    joints: {
      left: { leftKnee: 25, leftAnkle: 27, leftFootIndex: 31 },
      right: { rightKnee: 26, rightAnkle: 28, rightFootIndex: 32 },
    },
    jointAngles: { leftAnkleAngle: [25, 27, 31], rightAnkleAngle: [26, 28, 32] },
  },
  targets: { targetDorsiAngle: 92, targetPlantarAngle: 122 },
  angleSetters: ["setAnkleAngle"],
  title: "Ankle Pumps",
  rehab: true,
};

const getTransitionType = (jointData, closerSide) => {
  const angle = jointData[`${closerSide}AnkleAngle`];
  if (!Number.isFinite(angle)) return null;
  if (angle <= anklePumpsInfo.targets.targetDorsiAngle) return "up";
  if (angle >= anklePumpsInfo.targets.targetPlantarAngle) return "down";
  return null;
};

let currState;

export const checkAnklePumps = (
  landmarks,
  onFeedbackUpdate,
  setColor,
  setAnkleAngle,
  setRepCount,
  targetDorsiAngle = 92,
  targetPlantarAngle = 122,
) => {
  anklePumpsInfo.targets.targetDorsiAngle = targetDorsiAngle;
  anklePumpsInfo.targets.targetPlantarAngle = targetPlantarAngle;
  currState = genCheck(
    anklePumpsInfo,
    getTransitionType,
    currState,
    landmarks,
    onFeedbackUpdate,
    setColor,
    setRepCount,
    {
      AnkleAngle: setAnkleAngle,
    },
  );
};
