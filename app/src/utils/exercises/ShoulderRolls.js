import { genCheck, getTransitionType } from "../GenFeedback";

/**
 * Shoulder Rolls (Neck / Shoulder Tension Relief)
 * Engine-compatible implementation
 */

export const shoulderRollsInfo = {
  states: {
    INIT: {
      feedback: "Relax shoulders and stand straight",
      audio: false,
      countRep: false,
      color: "yellow",
    },
    UP: {
      feedback: "Lift shoulders up",
      audio: true,
      countRep: false,
      color: "yellow",
    },
    DOWN: {
      feedback: "Roll shoulders down",
      audio: true,
      countRep: false,
      color: "yellow",
    },
    COMPLETE: {
      feedback: "Good! Keep rolling smoothly",
      audio: true,
      countRep: true,
      color: "green",
    },
  },

  transitions: {
    INIT: { lifting: "UP" },
    UP: { lowering: "DOWN" },
    DOWN: { lifting: "COMPLETE" },
    COMPLETE: { lifting: "UP" },
  },

  jointInfo: {
    joints: {
      left: {
        leftShoulder: 11,
        leftHip: 23
      },
      right: {
        rightShoulder: 12,
        rightHip: 24
      }
    },

    // ✅ REQUIRED by engine
    jointAngles: {
      leftShoulderAngle: [23, 11, 13],   // hip → shoulder → elbow
      rightShoulderAngle: [24, 12, 14]
    }
  },

  targets: {
    raiseAngle: 60,
    lowerAngle: 30
  },

  conditions: {
    lifting: {
      states: ["INIT", "DOWN", "COMPLETE"],
      req: "shoulderAngle > raiseAngle",
      ret: "lifting"
    },
    lowering: {
      states: ["UP"],
      req: "shoulderAngle < lowerAngle",
      ret: "lowering"
    }
  },

  angleSetters: ["setShoulderAngle"],

  title: "Shoulder Rolls (Neck / Shoulder Tension)",
};

let currState;

/**
 * Shoulder Rolls checker
 */
export const checkShoulderRolls = (
  landmarks,
  onFeedbackUpdate,
  setColor,
  setCurrShoulderAngle,
  setRepCount,
  raiseAngle = 60
) => {
  shoulderRollsInfo.targets.raiseAngle = raiseAngle;

  currState = genCheck(
    shoulderRollsInfo,
    (...args) => getTransitionType(...args, shoulderRollsInfo, currState),
    currState,
    landmarks,
    onFeedbackUpdate,
    setColor,
    setRepCount,
    {
      ShoulderAngle: setCurrShoulderAngle
    }
  );
};
