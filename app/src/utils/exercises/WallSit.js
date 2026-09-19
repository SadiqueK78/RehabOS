import { genCheck } from '../GenFeedback';

export const wallSitInfo = {
    states: {
        STANDING: { feedback: 'Slide down the wall', audio: false, countRep: false, color: 'yellow' },
        DESCENDING: { feedback: 'Go lower, bend knees more!', audio: true, countRep: false, color: 'yellow' },
        HOLDING: { feedback: 'Hold it! Great form!', audio: true, countRep: false, color: 'green' },
        TOO_LOW: { feedback: 'Too low! Raise up slightly', audio: true, countRep: false, color: 'red' }
    },
    transitions: {
        STANDING: {
            descending: "DESCENDING",
        },
        DESCENDING: {
            holding: "HOLDING",
            standing: "STANDING",
        },
        HOLDING: {
            tooLow: "TOO_LOW",
            standing: "STANDING",
        },
        TOO_LOW: {
            holding: "HOLDING",
            standing: "STANDING",
        }
    },
    jointInfo: {
        joints: {
            left: {
                leftShoulder: 11,
                leftHip: 23,
                leftKnee: 25,
                leftAnkle: 27
            },
            right: {
                rightShoulder: 12,
                rightHip: 24,
                rightKnee: 26,
                rightAnkle: 28
            }
        },
        jointAngles: {
            leftKneeAngle: [23, 25, 27],
            rightKneeAngle: [24, 26, 28],
            leftHipAngle: [11, 23, 25],
            rightHipAngle: [12, 24, 26]
        }
    },
    targets: {
        thresholdKneeAngle: 150,
        targetKneeAngle: 100,
        minKneeAngle: 70
    },
    angleSetters: ['setKneeAngle', 'setHipAngle'],
    title: 'Wall Sit'
};

const getTransitionType = (jointAngles, closerSide) => {
    const { leftKneeAngle, rightKneeAngle } = jointAngles;
    
    const thresholdKneeAngle = wallSitInfo.targets["thresholdKneeAngle"];
    const targetKneeAngle = wallSitInfo.targets["targetKneeAngle"];
    const minKneeAngle = wallSitInfo.targets["minKneeAngle"];

    const kneeAngle = closerSide === "left" ? leftKneeAngle : rightKneeAngle;

    if (kneeAngle > thresholdKneeAngle) return "standing";
    if (kneeAngle <= targetKneeAngle && kneeAngle >= minKneeAngle) return "holding";
    if (kneeAngle < minKneeAngle) return "tooLow";
    if (kneeAngle < thresholdKneeAngle) return "descending"; 

    return null;
};

let currState;

export const checkWallSit = (
    landmarks,
    onFeedbackUpdate,
    setColor,
    setKneeAngle,
    setHipAngle,
    setRepCount,
    thresholdKneeAngle = 150,
    targetKneeAngle = 100,
    minKneeAngle = 70
) => {
    wallSitInfo.targets["thresholdKneeAngle"] = thresholdKneeAngle;
    wallSitInfo.targets["targetKneeAngle"] = targetKneeAngle;
    wallSitInfo.targets["minKneeAngle"] = minKneeAngle;

    currState = genCheck(
        wallSitInfo,
        getTransitionType,
        currState,
        landmarks,
        onFeedbackUpdate,
        setColor,
        setRepCount,
        {
            KneeAngle: setKneeAngle,
            HipAngle: setHipAngle
        }
    );
};

const backInfo = {
    states: {
        BACK_STRAIGHT: { feedback: "", audio: false, countRep: false, color: "" },
        BACK_BENT: { feedback: "Keep your back flat against the wall!", audio: true, countRep: false, color: "red" }
    },
    transitions: {
        BACK_STRAIGHT: {
            bent: "BACK_BENT",
        },
        BACK_BENT: {
            straight: "BACK_STRAIGHT",
        }
    },
    jointInfo: {
        joints: {
            leftShoulder: 11,
            leftHip: 23,
            leftKnee: 25,
            rightShoulder: 12,
            rightHip: 24,
            rightKnee: 26
        },
        jointAngles: {
            leftHipAngle: [11, 23, 25],
            rightHipAngle: [12, 24, 26]
        }
    },
    targets: {
        targetHipAngle: 150
    },
    disableVisibilityCheck: true
};

const getTransitionTypeBack = (jointAngles, closerSide) => {
    const { leftHipAngle, rightHipAngle } = jointAngles;
    const targetHipAngle = backInfo.targets["targetHipAngle"];

    const hipAngle = closerSide === "left" ? leftHipAngle : rightHipAngle;

    if (hipAngle <= targetHipAngle) return "bent";
    return "straight";
};

let currStateBack;

export const checkBackAlignment = (landmarks, onFeedbackUpdate, setColor, targetHipAngle = 150) => {
    backInfo.targets["targetHipAngle"] = targetHipAngle;

    currStateBack = genCheck(
        backInfo,
        getTransitionTypeBack,
        currStateBack,
        landmarks,
        onFeedbackUpdate,
        setColor,
        () => { } // no rep count for secondary check
    );
};
