/** Bridge the Upright desktop app exposes to the widget page (see desktop/preload.js). Absent in a normal browser. */
export interface DesktopBridge {
  /** grow into the pill (true) or shrink to the dot (false); flip = the pill opens to the left */
  resize: (expanded: boolean) => Promise<{ flip: boolean }>;
  getPos: () => Promise<{ x: number; y: number }>;
  moveTo: (x: number, y: number) => void;
  dragEnd: () => void;
  /** menu clicks from the tray / right-click menu: calibrate, pause, resume, test (older versions also send calibrate2) */
  onCommand: (cb: (cmd: string) => void) => void;
  setStatus: (status: { tone: string; label: string; paused?: boolean }) => void;
  contextMenu: () => void;
  /** desktop app 1.4+: native notifications, how long the computer has been idle, settings */
  notify?: (n: DesktopNotice) => void;
  idle?: () => Promise<{ sec: number; locked: boolean }>;
  /** the quick menu (left click on the dot) */
  quickMenu?: () => void;
}

export interface DesktopNotice {
  title: string;
  body: string;
  kind: string;
  /** upright:// link opened when it's clicked */
  link: string;
}

/** Desktop-app settings shown in Settings (desktop app 1.4+). */
export interface DesktopPrefs {
  openAtLogin: boolean;
  showDot: boolean;
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : (window as any).uprightDesktop;
}

/** Bridge in the desktop app's full-app window (see desktop/appPreload.js). Absent in a normal browser. */
export interface UpdateInfo {
  state: "idle" | "checking" | "none" | "downloading" | "ready" | "error";
  /** the new version, once one is found */
  version: string | null;
  pct: number;
  /** the version you're running */
  current: string;
  /** true on a Mac: an update is a download you install yourself, not a restart (desktop app 1.3+) */
  manual?: boolean;
  platform?: "windows" | "mac";
}

export interface AppBridge {
  /** an exercise session started / ended: the desktop posture dot pauses meanwhile */
  exercising: (on: boolean) => void;
  /** app updates (desktop app 1.2.2+) */
  getUpdate?: () => Promise<UpdateInfo>;
  checkUpdates?: () => void;
  installUpdate?: () => void;
  onUpdate?: (cb: (u: UpdateInfo) => void) => () => void;
  /** desktop app 1.4+ */
  notify?: (n: DesktopNotice) => void;
  idle?: () => Promise<{ sec: number; locked: boolean }>;
  getPrefs?: () => Promise<DesktopPrefs>;
  setPrefs?: (p: Partial<DesktopPrefs>) => void;
}

export function appBridge(): AppBridge | undefined {
  return typeof window === "undefined" ? undefined : (window as any).uprightApp;
}

/** Tells the desktop app (if we're inside it) that exercises are running while this component is mounted. */
export function signalExercising() {
  appBridge()?.exercising(true);
  return () => appBridge()?.exercising(false);
}

/** Opens the installed desktop app (Windows or Mac; registered when it's installed). */
export const OPEN_DESKTOP_APP = "upright://open";
export const DESKTOP_KEY = "upright:desktop-installed";
