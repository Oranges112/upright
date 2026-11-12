/**
 * Side-photo body scan, all on this device.
 * MediaPipe's pose model finds your ear, shoulder, hip, knee and ankle in a side-on photo, so the
 * head angle no longer needs tapping, and we can also check the rest of your standing posture.
 * These are a rough guide from one photo, not a clinical assessment.
 */

import { headAngle, type Pt } from "./photos";

const VISION_VERSION = "1.2.2";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

export interface BodyPoints {
  nose?: Pt;
  ear: Pt;
  shoulder: Pt;
  hip?: Pt;
  knee?: Pt;
  ankle?: Pt;
}

export type Tone = "good" | "warn" | "bad";

export interface BodyCheck {
  id: "head" | "trunk" | "hips" | "knees";
  label: string;
  /** degrees; sign explained per check */
  deg: number;
  tone: Tone;
  verdict: string;
  tip?: string;
}

let landmarker: Promise<any> | null = null;

function getLandmarker(): Promise<any> {
  if (!landmarker) {
    landmarker = (async () => {
      const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(WASM);
      const opts = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "IMAGE" as const,
        // more than one, so someone else in the room (on a sofa, in the background) can't be mistaken for you
        numPoses: 3,
      });
      try {
        return await PoseLandmarker.createFromOptions(files, opts("GPU"));
      } catch {
        return await PoseLandmarker.createFromOptions(files, opts("CPU"));
      }
    })().catch((e) => {
      landmarker = null;
      throw e;
    });
  }
  return landmarker;
}

/** MediaPipe pose landmark numbers (left / right). */
const IDX = { nose: 0, ear: [7, 8], shoulder: [11, 12], hip: [23, 24], knee: [25, 26], ankle: [27, 28] } as const;
const SEEN = 0.5;

interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

/** Pick the side of the body facing the camera and return its points (pure, for tests). */
export function pointsFromLandmarks(lm: Landmark[]): BodyPoints | null {
  const vis = (i: number) => lm[i]?.visibility ?? 0;
  const sideScore = (s: 0 | 1) => [IDX.ear, IDX.shoulder, IDX.hip, IDX.knee, IDX.ankle].reduce((a, pair) => a + vis(pair[s]), 0);
  const s: 0 | 1 = sideScore(0) >= sideScore(1) ? 0 : 1;
  const pt = (i: number): Pt | undefined => (lm[i] && vis(i) >= SEEN ? { x: lm[i].x, y: lm[i].y } : undefined);
  // the ear and shoulder are the minimum; fall back to the other side's if this side's is hidden
  const ear = pt(IDX.ear[s]) ?? pt(IDX.ear[1 - s]);
  const shoulder = pt(IDX.shoulder[s]) ?? pt(IDX.shoulder[1 - s]);
  if (!ear || !shoulder) return null;
  const out: BodyPoints = {
    nose: pt(IDX.nose),
    ear,
    shoulder,
    hip: pt(IDX.hip[s]) ?? pt(IDX.hip[1 - s]),
    knee: pt(IDX.knee[s]) ?? pt(IDX.knee[1 - s]),
    ankle: pt(IDX.ankle[s]) ?? pt(IDX.ankle[1 - s]),
  };
  return plausible(out) ? out : null;
}

/** Reject impossible results (ear below the shoulder, knees above the hips...), which mean the model got lost. */
export function plausible(p: BodyPoints): boolean {
  const order = [p.ear, p.shoulder, p.hip, p.knee, p.ankle].filter(Boolean) as Pt[];
  for (let i = 1; i < order.length; i++) if (order[i].y <= order[i - 1].y) return false;
  // the ear can't be far from the shoulder compared with the rest of the body
  const es = Math.hypot(p.ear.x - p.shoulder.x, p.ear.y - p.shoulder.y);
  if (p.hip) {
    const sh = Math.hypot(p.shoulder.x - p.hip.x, p.shoulder.y - p.hip.y);
    if (es > sh * 0.9) return false;
  }
  return es > 0.01;
}

/** How much of the photo a pose covers from top to bottom: the person standing in front is the tallest. */
function height(lm: Landmark[]) {
  const ys = lm.filter((q) => (q.visibility ?? 0) >= SEEN).map((q) => q.y);
  return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
}

/** Of the people found, use the tallest one whose points make sense. */
export function pickPerson(people: Landmark[][]): BodyPoints | null {
  const sorted = [...people].sort((a, b) => height(b) - height(a));
  for (const lm of sorted) {
    const p = pointsFromLandmarks(lm);
    if (p) return p;
  }
  return null;
}

/** Find the body in a photo. Returns null if no person (or no ear/shoulder) was found. */
export async function scanPhoto(dataUrl: string): Promise<BodyPoints | null> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const lm = await getLandmarker();
  const res = lm.detect(img);
  return pickPerson(res?.landmarks ?? []);
}

const deg = (r: number) => Math.round((r * 180) / Math.PI);

/**
 * Turn the points into simple checks (pure, for tests). w/h = photo size in px.
 * "Forward" means the way you're facing (worked out from where your nose is vs your ear).
 */
export function bodyChecks(p: BodyPoints, w: number, h: number): BodyCheck[] {
  const X = (q: Pt) => q.x * w;
  const Y = (q: Pt) => q.y * h;
  // which way you're facing: nose in front of the ear, else the ear in front of the shoulder
  const f = p.nose ? Math.sign(X(p.nose) - X(p.ear)) || 1 : Math.sign(X(p.ear) - X(p.shoulder)) || 1;
  /** lean of the line from `a` (lower) up to `b` (upper), in degrees from vertical, + = forward */
  const lean = (a: Pt, b: Pt) => deg(Math.atan2(f * (X(b) - X(a)), Math.max(1, Y(a) - Y(b))));

  const out: BodyCheck[] = [];

  const head = headAngle(p.ear, p.shoulder, w, h);
  out.push({
    id: "head",
    label: "Head",
    deg: head,
    tone: head <= 10 ? "good" : head <= 20 ? "warn" : "bad",
    verdict: head <= 10 ? "Ears over shoulders 🙌" : head <= 20 ? "Mild forward head" : "Noticeable forward head",
    tip: head > 10 ? "Chin tucks, and Guard while you work." : undefined,
  });

  if (p.hip) {
    const t = lean(p.hip, p.shoulder);
    out.push({
      id: "trunk",
      label: "Upper body",
      deg: t,
      tone: Math.abs(t) <= 5 ? "good" : Math.abs(t) <= 10 ? "warn" : "bad",
      verdict: Math.abs(t) <= 5 ? "Shoulders stacked over hips" : t > 0 ? "Leaning / rounding forward" : "Leaning back behind your hips",
      tip:
        Math.abs(t) <= 5
          ? undefined
          : t > 0
            ? "Rows, face pulls and the chest stretch open you back up."
            : "Usually goes with hips pushed forward: stack your ribs over your hips.",
    });
  }

  if (p.hip && p.ankle) {
    const hp = lean(p.ankle, p.hip);
    out.push({
      id: "hips",
      label: "Hips",
      deg: hp,
      tone: hp <= 4 && hp >= -6 ? "good" : hp <= 8 ? "warn" : "bad",
      verdict: hp > 4 ? "Hips pushed forward of your feet" : hp < -6 ? "Hips sitting back behind your feet" : "Hips over your feet",
      tip: hp > 4 ? "Glute bridges and the hip flexor stretch; stand with soft knees." : undefined,
    });
  }

  if (p.hip && p.knee && p.ankle) {
    // how far the knee sits off the straight hip–ankle line: behind = locked back, in front = bent
    const a = Math.atan2(Y(p.hip) - Y(p.knee), X(p.hip) - X(p.knee));
    const b = Math.atan2(Y(p.ankle) - Y(p.knee), X(p.ankle) - X(p.knee));
    let inner = Math.abs(a - b);
    if (inner > Math.PI) inner = 2 * Math.PI - inner;
    const bend = 180 - deg(inner);
    const lineX = X(p.hip) + ((X(p.ankle) - X(p.hip)) * (Y(p.knee) - Y(p.hip))) / Math.max(1, Y(p.ankle) - Y(p.hip));
    const behind = f * (X(p.knee) - lineX) < 0;
    const signed = behind ? -bend : bend;
    out.push({
      id: "knees",
      label: "Knees",
      deg: signed,
      tone: signed < -10 ? "bad" : signed < -4 || signed > 20 ? "warn" : "good",
      verdict: signed < -4 ? "Knees locked back" : signed > 20 ? "Knees quite bent" : "Soft, relaxed knees",
      tip: signed < -4 ? "Unlock them a little: it takes the sway out of your lower back." : undefined,
    });
  }

  return out;
}
