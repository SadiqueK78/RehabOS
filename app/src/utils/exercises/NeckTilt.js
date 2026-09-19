import { genCheck } from '../GenFeedback';

export const neckTiltInfo = {
    states: {
        CENTER: {
            feedback: 'Tilt head to one side',
            audio: false,
            countRep: false,
            color: 'yellow'
        },
        TILTING: {
            feedback: 'Tilt further, ear to shoulder',
            audio: true,
            countRep: false,
            color: 'yellow'
        },
        TILTED: {
            feedback: 'Hold the stretch!',
            audio: true,
            countRep: false,
            color: 'green'
        },
        FINISHED: {
            feedback: 'Excellent! Now other side',
            audio: false,
            countRep: true,
            color: 'green'
        }
    },
    transitions: {
        CENTER: { to_tilting: 'TILTING' },
        TILTING: { to_tilted: 'TILTED', to_center: 'CENTER' },
        TILTED: { to_center: 'FINISHED' },
        FINISHED: { to_tilting: 'TILTING' }
    },
    jointInfo: {
        joints: {
            left: {
                leftEar: 7,
                leftShoulder: 11
            },
            right: {
                rightEar: 8,
                rightShoulder: 12
            }
        },
        jointAngles: {
            leftTiltAngle: [7, 0, 8]
        },
        jointPos: {
            leftNosePos: 0,
            leftEarPos: 7,
            rightEarPos: 8
        }
    },
    targets: {
        thresholdTiltAngle: 160,
        targetTiltAngle: 140
    },
    angleSetters: ['setTiltAngle'],
    title: 'Neck Tilt',
    disableVisibilityCheck: true
};

let currStateNeckTilt;

const getTransitionTypeNeckTilt = (jointData, closerSide) => {
    const currentState = currStateNeckTilt || 'CENTER';
    const { leftTiltAngle } = jointData;
    const { thresholdTiltAngle, targetTiltAngle } = neckTiltInfo.targets;

    if (currentState === 'CENTER' && leftTiltAngle < thresholdTiltAngle) {
        return 'to_tilting';
    }
    if (currentState === 'TILTING') {
        if (leftTiltAngle < targetTiltAngle) return 'to_tilted';
        if (leftTiltAngle > thresholdTiltAngle) return 'to_center';
    }
    if (currentState === 'TILTED' && leftTiltAngle > thresholdTiltAngle) {
        return 'to_center';
    }
    if (currentState === 'FINISHED' && leftTiltAngle < thresholdTiltAngle) {
        return 'to_tilting';
    }

    return "null";
};

export const checkNeckTilt = (
    landmarks,
    onFeedbackUpdate,
    setColor,
    setCurrTiltAngle,
    setRepCount,
    thresholdTiltAngle = 160,
    targetTiltAngle = 140
) => {
    neckTiltInfo.targets.thresholdTiltAngle = thresholdTiltAngle;
    neckTiltInfo.targets.targetTiltAngle = targetTiltAngle;

    currStateNeckTilt = genCheck(
        neckTiltInfo,
        getTransitionTypeNeckTilt,
        currStateNeckTilt,
        landmarks,
        onFeedbackUpdate,
        setColor,
        setRepCount,
        { TiltAngle: setCurrTiltAngle }
    );
};
