import { genCheck } from '../GenFeedback';

/** 
 * FSM list of states, transitions, joint information, target value information
 * States = SEATED, EXTENDING, EXTENDED, LOWERING, FINISHED
 * Transitions = startExtending, fullyExtended, backToSeated, startLowering, completedRep
 * Accesses leftKneeAngle and rightKneeAngle
 */
export const seatedKneeExtensionInfo = {
    states: {
        SEATED: { feedback: "Extend your leg outward!", audio: false, countRep: false, color: "yellow" },
        EXTENDING: { feedback: "Straighten your knee more!", audio: true, countRep: false, color: "yellow" },
        EXTENDED: { feedback: "Excellent! Hold the extension!", audio: true, countRep: false, color: "green" },
        LOWERING: { feedback: "Good, slowly lower down", audio: true, countRep: false, color: "yellow" },
        FINISHED: { feedback: "Great rep!", audio: false, countRep: true, color: "green" }
    },

    transitions: {
        SEATED: {
            betweenAngles: "EXTENDING"
        },
        EXTENDING: {
            fullyExtended: "EXTENDED",
            belowStartAngle: "SEATED"
        },
        EXTENDED: {
            betweenAngles: "LOWERING"
        },
        LOWERING: {
            belowStartAngle: "FINISHED",
            fullyExtended: "EXTENDED"
        },
        FINISHED: {
            betweenAngles: "EXTENDING"
        }
    },

    jointInfo: {
        joints: {
            left: {
                leftHip: 23,
                leftKnee: 25,
                leftAnkle: 27
            },
            right: {
                rightHip: 24,
                rightKnee: 26,
                rightAnkle: 28
            }
        },
        jointAngles: {
            leftKneeAngle: [23, 25, 27],
            rightKneeAngle: [24, 26, 28]
        }
    },

    targets: {
        startAngle: 100,
        targetKneeAngle: 150
    },

    angleSetters: ["setKneeAngle"],

    title: "Seated Knee Extension"
};

/**
 * Determines the type of transition based on knee extension angle.
 *
 * @param {object} jointAngles Object containing calculated angles for relevant joints.
 * @param {string} closerSide The side of the body closer to the camera ("left" or "right").
 * @returns {string|null} The type of transition ("fullyExtended", "betweenAngles", "belowStartAngle").
 */
const getTransitionType = (jointAngles, closerSide) => {
    const { leftKneeAngle, rightKneeAngle } = jointAngles;
    
    // Prioritize the closer side's knee angle if available, otherwise take the max
    let activeKneeAngle = 0;
    if (closerSide === 'left' && leftKneeAngle) {
        activeKneeAngle = leftKneeAngle;
    } else if (closerSide === 'right' && rightKneeAngle) {
        activeKneeAngle = rightKneeAngle;
    } else {
        activeKneeAngle = Math.max(leftKneeAngle || 0, rightKneeAngle || 0);
    }

    const startAngle = seatedKneeExtensionInfo.targets["startAngle"];
    const targetKneeAngle = seatedKneeExtensionInfo.targets["targetKneeAngle"];

    if (activeKneeAngle >= targetKneeAngle) {
        return "fullyExtended";
    }
    if (activeKneeAngle <= startAngle) {
        return "belowStartAngle";
    }
    return "betweenAngles";
};

let currState;

/**
 * Checks and updates the Seated Knee Extension state, tracks knee angle, and counts repetitions.
 * Leverages generalized feedback checking method.
 *
 * @param {Object} landmarks - The landmarks of the body to evaluate posture.
 * @param {Function} onFeedbackUpdate - Callback function to handle feedback updates.
 * @param {Function} setColor - Callback function to set text color based on state.
 * @param {Function} setCurrKneeAngle - Function to update the current knee angle.
 * @param {Function} setRepCount - Function to update the repetition count.
 * @param {number} [targetKneeAngle=150] - The target knee angle to be used for evaluation.
 */
export const checkSeatedKneeExtension = (landmarks, onFeedbackUpdate, setColor, setCurrKneeAngle, setRepCount, targetKneeAngle = 150) => {
    seatedKneeExtensionInfo.targets["targetKneeAngle"] = targetKneeAngle;

    currState = genCheck(
        seatedKneeExtensionInfo,
        getTransitionType,
        currState,
        landmarks,
        onFeedbackUpdate,
        setColor,
        setRepCount,
        { KneeAngle: setCurrKneeAngle }
    );
};
