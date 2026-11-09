/** Bridge the Upright desktop app exposes to the widget page (see desktop/preload.js). Absent in a normal browser. */
export interface DesktopBridge {
  /** grow into the pill (true) or shrink to the dot (false); flip = the pill opens to the left */
  resize: (expanded: boolean) => Promise<{ flip: boolean }>;
  getPos: () => Promise<{ x: number; y: number }>;
  moveTo: (x: number, y: number) => void;
  dragEnd: () => void;
  /** menu clicks from the tray / right-click menu: calibrate, calibrate2, pause, resume, test */
  onCommand: (cb: (cmd: string) => void) => void;
  setStatus: (status: { tone: string; label: string }) => void;
  contextMenu: () => void;
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : (window as any).uprightDesktop;
}
