import { genCheck } from '../GenFeedback';

/** 
 * FSM list of 4 states, 3 types of transitions, joint information, target value information
 * States = FLAT_FOOT, RAISING, PEAK, FINISHED
 * Transitions = raising, peak, flat
 * Accesses leftAnkleAngle, rightAnkleAngle, leftKneeAngle, rightKneeAngle
 */
export const calfRaiseInfo = {
    states: {
        FLAT_FOOT: { feedback: "Rise up on your toes!", audio: false, countRep: false, color: "yellow" },
        RAISING: { feedback: "Keep going higher!", audio: true, countRep: false, color: "yellow" },
        PEAK: { feedback: "Excellent! Hold briefly!", audio: true, countRep: false, color: "green" },
        FINISHED: { feedback: "Great rep!", audio: false, countRep: true, color: "green" }
    },

    transitions: {
        FLAT_FOOT: {
            raising: "RAISING",
        },
        RAISING: {
            peak: "PEAK",
            flat: "FLAT_FOOT",
        },
        PEAK: {
            flat: "FINISHED",
        },
        FINISHED: {
            raising: "RAISING",
            flat: "FLAT_FOOT"
        }
    },

    jointInfo: {
        joints: {
            left: {
                leftHip: 23,
                leftKnee: 25,
                leftAnkle: 27,
                leftFootIndex: 31
            },
            right: {
                rightHip: 24,
                rightKnee: 26,
                rightAnkle: 28,
                rightFootIndex: 32
            }
        },
        jointAngles: {
            leftAnkleAngle: [25, 27, 31],
            rightAnkleAngle: [26, 28, 32],
            leftKneeAngle: [23, 25, 27],
            rightKneeAngle: [24, 26, 28]
        }
    },

    targets: {
        thresholdAnkleAngle: 150,
        targetAnkleAngle: 120,
    },

    angleSetters: ["setAnkleAngle"],

    title: "Calf Raise",
}

/**
 * Determines the type of transition based on calf raise extension (ankle angles).
 *
 * @param {object} jointAngles Object containing calculated angles for relevant joints.
 * @returns {string|null} The type of transition or null if no transition applies.
 */
const getTransitionType = (jointAngles, closerSide) => {
    const { leftAnkleAngle, rightAnkleAngle } = jointAngles;

    const targetAnkleAngle = calfRaiseInfo.targets["targetAnkleAngle"];
    const thresholdAnkleAngle = calfRaiseInfo.targets["thresholdAnkleAngle"];

    if (leftAnkleAngle <= targetAnkleAngle || rightAnkleAngle <= targetAnkleAngle)
        return "peak";
    if (leftAnkleAngle < thresholdAnkleAngle || rightAnkleAngle < thresholdAnkleAngle)
        return "raising";
    if (leftAnkleAngle > thresholdAnkleAngle || rightAnkleAngle > thresholdAnkleAngle)
        return "flat";
    return null;
};

let currState;

/**
 * Checks and updates the calf raise posture state, tracks ankle angle, and counts repetitions.
 * Leverages generalized feedback checking method.
 *
 * @param {Object} landmarks - The landmarks of the body to evaluate posture.
 * @param {Function} onFeedbackUpdate - Callback function to handle feedback updates.
 * @param {Function} setColor - Callback function to update color feedback.
 * @param {Function} setCurrAnkleAngle - Function to update the current ankle angle.
 * @param {Function} setRepCount - Function to update the repetition count.
 * @param {number} [targetAnkleAngle=120] - The target ankle angle to be used for evaluation.
 */
export const checkCalfRaise = (landmarks, onFeedbackUpdate, setColor, setCurrAnkleAngle, setRepCount, targetAnkleAngle = 120) => {
    calfRaiseInfo.targets["targetAnkleAngle"] = targetAnkleAngle;

    currState = genCheck(
        calfRaiseInfo,
        getTransitionType,
        currState,
        landmarks,
        onFeedbackUpdate,
        setColor,
        setRepCount,
        { AnkleAngle: setCurrAnkleAngle }
    );
};

/** 
 * FSM for checking if knees are straight during calf raise
 * States: KNEES_STRAIGHT, KNEES_BENT
 * Transitions: straight, bent
 * Accesses leftKneeAngle and rightKneeAngle
 */
const kneeLockoutInfo = {
    states: {
        KNEES_STRAIGHT: { feedback: "", audio: false, countRep: false, color: "" },
        KNEES_BENT: { feedback: "Keep your knees straight!", audio: false, countRep: false, color: "" }
    },

    transitions: {
        KNEES_STRAIGHT: {
            bent: "KNEES_BENT",
        },
        KNEES_BENT: {
            straight: "KNEES_STRAIGHT",
        }
    },

    jointInfo: {
        joints: {
            leftHip: 23,
            leftKnee: 25,
            leftAnkle: 27,
            rightHip: 24,
            rightKnee: 26,
            rightAnkle: 28
        },
        jointAngles: {
            leftKneeAngle: [23, 25, 27],
            rightKneeAngle: [24, 26, 28]
        }
    },

    targets: {
        targetKneeAngle: 160
    },

    disableVisibilityCheck: true
};

/**
 * Determines the type of transition based on knee posture.
 *
 * @param {object} jointAngles Object containing calculated angles for relevant joints.
 * @returns {string|null} The type of transition ("bent", "straight") or null if no transition applies.
 */
const getTransitionTypeKneeLockout = (jointAngles, closerSide) => {
    const { leftKneeAngle, rightKneeAngle } = jointAngles;
    const targetKneeAngle = kneeLockoutInfo.targets["targetKneeAngle"];

    if (leftKneeAngle <= targetKneeAngle || rightKneeAngle <= targetKneeAngle)
        return "bent";
    return "straight";
};

let currStateKnees;

/**
 * Checks and updates the knee lockout state based on the provided landmarks and target knee angle.
 * Leverages generalized feedback checking method.
 *
 * @param {Object} landmarks - The landmarks of the body to evaluate posture.
 * @param {Function} onFeedbackUpdate - Callback function to handle feedback updates.
 * @param {Function} setColor - Callback function to update color feedback.
 * @param {number} [targetKneeAngle=160] - The target knee angle to be used for evaluation.
 */
export const checkKneeLockout = (landmarks, onFeedbackUpdate, setColor, targetKneeAngle = 160) => {
    kneeLockoutInfo.targets["targetKneeAngle"] = targetKneeAngle;

    currStateKnees = genCheck(
        kneeLockoutInfo,
        getTransitionTypeKneeLockout,
        currStateKnees,
        landmarks,
        onFeedbackUpdate,
        setColor,
        () => { },
    );
};
