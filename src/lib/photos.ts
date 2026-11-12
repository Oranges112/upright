"use client";

/** Side-profile photos are kept ONLY on this device (IndexedDB). Just the angle is synced. */

export interface Pt {
  x: number; // 0..1 of image width
  y: number; // 0..1 of image height
}

export interface PhotoRecord {
  testId: string;
  at: number;
  dataUrl: string;
  ear: Pt;
  shoulder: Pt;
  w: number;
  h: number;
  /** found automatically when the photo shows more of you (for the full-body check) */
  body?: { hip?: Pt; knee?: Pt; ankle?: Pt; nose?: Pt };
}

const DB = "upright-photos";
const STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "testId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(rec: PhotoRecord) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhoto(testId: string): Promise<PhotoRecord | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(testId);
      req.onsuccess = () => resolve((req.result as PhotoRecord) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Downscale a picked image to a reasonable JPEG data URL. */
export function compressImage(file: File, max = 900): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve({ dataUrl: c.toDataURL("image/jpeg", 0.82), w, h });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Forward-head angle: how far the ear sits in front of the shoulder, in degrees from vertical. Lower = better. */
export function headAngle(ear: Pt, shoulder: Pt, w: number, h: number): number {
  const dx = Math.abs(ear.x - shoulder.x) * w;
  const dy = Math.max(1, (shoulder.y - ear.y) * h);
  return Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
}

export function angleVerdict(deg: number) {
  if (deg <= 10) return { label: "Ears over shoulders 🙌", tone: "good" as const };
  if (deg <= 20) return { label: "Mild forward head", tone: "warn" as const };
  return { label: "Noticeable forward head", tone: "bad" as const };
}

/** Every saved photo, oldest first. */
export async function allPhotos(): Promise<PhotoRecord[]> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(((req.result as PhotoRecord[]) ?? []).sort((a, b) => a.at - b.at));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
