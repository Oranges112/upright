/**
 * On-device face tracking shared by Posture Guard and the exercise form check.
 * MediaPipe's tiny face detector gives a box plus 6 landmarks; we turn that into a few
 * relative measurements that work at any camera resolution. Nothing leaves the device.
 */

const VISION_VERSION = "1.2.2";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

/** One frame of measurements. */
export interface Sample {
  w: number; // face width / frame width (bigger = closer to the camera)
  cy: number; // eye-line height / frame height (bigger = lower)
  cx: number;
  pitch: number | null; // (nose y - ear y) / eye distance (bigger = chin down)
  roll: number | null; // eye-line angle in degrees (head tilt)
  yaw: number | null; // nose offset from eye midpoint / eye distance (head turn)
  /**
   * Eye-line-to-mouth distance / frame width (bigger = closer). Unlike face width, it barely
   * changes when you turn your head, so it still measures "head forward" while you look at
   * another screen.
   */
  em?: number | null;
  /** (nose y - ear y) / eye-to-mouth distance: chin-down measure that survives head turns */
  pitchM?: number | null;
  /** eye distance / eye-to-mouth distance: shrinks as you turn (used to undo the turn's effect on tilt) */
  edm?: number | null;
}

export interface Box {
  originX: number;
  originY: number;
  width: number;
  height: number;
}
export interface Detection {
  boundingBox?: Box;
  keypoints?: { x: number; y: number }[];
}

let detectorPromise: Promise<any> | null = null;

/** Loads the face detector once (GPU, falling back to CPU) and shares it. */
export function getFaceDetector(): Promise<any> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(WASM);
      const opts = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO" as const,
        minDetectionConfidence: 0.5,
      });
      try {
        return await FaceDetector.createFromOptions(files, opts("GPU"));
      } catch {
        return await FaceDetector.createFromOptions(files, opts("CPU"));
      }
    })().catch((e) => {
      detectorPromise = null; // allow a retry later
      throw e;
    });
  }
  return detectorPromise;
}

let lastTs = 0;
/** Detect the most prominent face in a playing <video>. Timestamps must always increase. */
export function detectFace(detector: any, video: HTMLVideoElement): Detection | null {
  if (!detector || video.readyState < 2 || !video.videoWidth) return null;
  lastTs = Math.max(lastTs + 1, performance.now());
  try {
    return detector.detectForVideo(video, lastTs)?.detections?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Turn a detection into relative measurements. Pure: easy to test. */
export function measureFace(det: Detection, W: number, H: number): Sample | null {
  const bb = det.boundingBox;
  if (!bb || !W || !H) return null;
  const out: Sample = {
    w: bb.width / W,
    cy: (bb.originY + bb.height / 2) / H,
    cx: (bb.originX + bb.width / 2) / W,
    pitch: null,
    roll: null,
    yaw: null,
  };
  const kp = det.keypoints;
  if (!kp || kp.length < 6) return out;
  // keypoints (normalised 0..1): 0 right eye, 1 left eye, 2 nose tip, 3 mouth, 4 right ear, 5 left ear
  const P = kp.map((p) => ({ x: p.x * W, y: p.y * H }));
  const [re, le, nose, mouth, rEar, lEar] = P;
  const ed = Math.hypot(le.x - re.x, le.y - re.y);
  if (ed < 4) return out;
  const eyeMid = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
  const earY = (rEar.y + lEar.y) / 2;
  const emPx = Math.hypot(mouth.x - eyeMid.x, mouth.y - eyeMid.y);
  let roll = (Math.atan2(le.y - re.y, le.x - re.x) * 180) / Math.PI;
  if (roll > 90) roll -= 180;
  if (roll < -90) roll += 180;
  const okEm = emPx >= 4;
  return {
    ...out,
    cy: eyeMid.y / H,
    cx: eyeMid.x / W,
    pitch: (nose.y - earY) / ed,
    roll,
    yaw: (nose.x - eyeMid.x) / ed,
    em: okEm ? emPx / W : null,
    pitchM: okEm ? (nose.y - earY) / emPx : null,
    edm: okEm ? ed / emPx : null,
  };
}

/**
 * Open the front camera at the best quality it offers (up to HD), in its natural shape.
 * Many laptop webcams only give their full, wide view at 16:9, and crop the sides at 4:3.
 */
export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
}

export const median = (xs: number[]) => {
  const a = [...xs].sort((p, q) => p - q);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
