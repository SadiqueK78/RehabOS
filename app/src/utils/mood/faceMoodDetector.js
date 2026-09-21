import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import faceLandmarkerTask from "../../shared/models/face_landmarker.task";
import { shapesToMap, moodFromShapes } from "./faceMood";

/**
 * The camera half of the mood check-in.
 *
 * MediaPipe's face landmarker runs entirely in the browser through WebAssembly: frames go from
 * the webcam straight into the model and never leave the device. We keep only the numbers it
 * produces - no photo or video is stored or uploaded anywhere.
 */

let landmarker = null;
let loading = null;

export async function loadFaceMood() {
  if (landmarker) return landmarker;
  if (!loading) {
    loading = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
      );
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: faceLandmarkerTask },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      return landmarker;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

/** Read one frame. Returns null while no face is in view. */
export function readFrame(video, timestamp) {
  if (!landmarker || !video || video.readyState < 2) return null;
  const result = landmarker.detectForVideo(video, timestamp);
  const shapes = result?.faceBlendshapes?.[0]?.categories;
  if (!shapes || !shapes.length) return null;
  return moodFromShapes(shapesToMap(shapes));
}

export function releaseFaceMood() {
  try {
    landmarker?.close();
  } catch {
    /* already gone */
  }
  landmarker = null;
  loading = null;
}
