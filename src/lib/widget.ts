"use client";

/**
 * Floating mini widget: a tiny always-on-top window (Document Picture-in-Picture)
 * that stays above every app, so you can see your posture while you work.
 * Supported in Chrome and Edge on desktop.
 */

import { useSyncExternalStore } from "react";

let win: Window | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function widgetSupported() {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

export function useWidgetWindow() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => win,
    () => null,
  );
}

function copyStyles(target: Window) {
  for (const ss of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(ss.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const el = target.document.createElement("style");
      el.textContent = css;
      target.document.head.appendChild(el);
    } catch {
      if (ss.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = ss.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

/** Must be called from a click. Returns false if the browser can't do it. */
export async function openWidget(): Promise<boolean> {
  if (win) {
    win.focus();
    return true;
  }
  const dpip = (window as any).documentPictureInPicture;
  if (!dpip) return false;
  try {
    // preferInitialWindowPlacement: always open at this small size, instead of Chrome reusing
    // whatever size the window had last time (it remembers per site, so it could stay big)
    const w: Window = await dpip.requestWindow({ width: 232, height: 52, disallowReturnToOpener: true, preferInitialWindowPlacement: true });
    copyStyles(w);
    w.document.title = "Upright";
    w.document.documentElement.className = document.documentElement.className;
    const theme = document.documentElement.dataset.theme;
    if (theme) w.document.documentElement.dataset.theme = theme;
    w.document.body.className = `${document.body.className} widget-body`;
    w.addEventListener("pagehide", () => {
      win = null;
      emit();
    });
    win = w;
    emit();
    return true;
  } catch {
    return false;
  }
}

export function closeWidget() {
  win?.close();
  win = null;
  emit();
}

/** keep the widget's theme in step with the app */
export function syncWidgetTheme(theme: string | undefined) {
  if (!win) return;
  if (theme) win.document.documentElement.dataset.theme = theme;
  else delete win.document.documentElement.dataset.theme;
}
