/**
 * Upright desktop widget.
 * A tiny frameless, see-through, always-on-top posture dot. It loads the Upright
 * web app's /widget page, which runs Posture Guard on your webcam (all on-device).
 */
const { app, BrowserWindow, Menu, Tray, ipcMain, screen, session, shell, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

// Chimes must play without a click first.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const DEFAULT_URL = "https://oranges112.github.io/upright/";
const DOT = 50; // px, the see-through dot
const PILL = { w: 268, h: 58 }; // px, when it pops out

/* ---------- settings (saved in %APPDATA%/Upright/config.json) ---------- */
const cfgFile = () => path.join(app.getPath("userData"), "config.json");
function loadCfg() {
  try {
    return JSON.parse(fs.readFileSync(cfgFile(), "utf8"));
  } catch {
    return {};
  }
}
function saveCfg() {
  try {
    fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
    fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2));
  } catch {}
}
let cfg = {};

/** The web app to load. Change "url" in config.json to use your own copy (e.g. your Vercel site, for sync). */
function appUrl() {
  const u = process.env.UPRIGHT_URL || cfg.url || DEFAULT_URL;
  return u.endsWith("/") ? u : `${u}/`;
}

let widget = null;
let appWin = null;
let tray = null;
let expanded = false;
let flip = false;
let paused = false;
let status = { tone: "idle", label: "Starting…" };
/** top-left corner of the dot; the pill grows out from here */
let anchor = null;

function workAreaFor(pt) {
  return screen.getDisplayNearestPoint(pt).workArea;
}

/** Where the window should be for the dot / pill, keeping the dot in the same spot. */
function boundsFor(isExpanded) {
  const wa = workAreaFor(anchor);
  if (!isExpanded) {
    flip = false;
    return { x: anchor.x, y: anchor.y, width: DOT, height: DOT };
  }
  // open to the right, unless that would run off the screen: then open to the left
  flip = anchor.x + PILL.w > wa.x + wa.width;
  const x = flip ? anchor.x + DOT - PILL.w : anchor.x;
  const y = Math.round(anchor.y + (DOT - PILL.h) / 2);
  return { x, y, width: PILL.w, height: PILL.h };
}

function applyBounds() {
  if (!widget) return;
  widget.setBounds(boundsFor(expanded));
}

function createWidget() {
  const primary = screen.getPrimaryDisplay().workArea;
  anchor = cfg.anchor || { x: primary.x + primary.width - DOT - 24, y: primary.y + primary.height - DOT - 24 };
  // if the saved spot is on a monitor that's gone, bring it back
  const wa = workAreaFor(anchor);
  anchor.x = Math.min(Math.max(anchor.x, wa.x), wa.x + wa.width - DOT);
  anchor.y = Math.min(Math.max(anchor.y, wa.y), wa.y + wa.height - DOT);

  widget = new BrowserWindow({
    ...boundsFor(false),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: "Upright",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });
  widget.setAlwaysOnTop(true, "screen-saver");
  widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widget.loadURL(`${appUrl()}widget`);
  widget.once("ready-to-show", () => widget.showInactive());
  widget.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  // if the page fails to load (offline), retry every 15 s
  widget.webContents.on("did-fail-load", () => setTimeout(() => widget && widget.loadURL(`${appUrl()}widget`), 15000));
  widget.on("closed", () => (widget = null));
}

function openFullApp() {
  if (appWin) return appWin.focus();
  appWin = new BrowserWindow({
    width: 440,
    height: 860,
    title: "Upright",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  appWin.loadURL(appUrl());
  appWin.on("closed", () => (appWin = null));
}

function send(cmd) {
  if (widget) widget.webContents.send("cmd", cmd);
}

function menu() {
  return Menu.buildFromTemplate([
    { label: `Upright: ${status.label}`, enabled: false },
    { type: "separator" },
    { label: "Recalibrate (sit tall first)", click: () => send("calibrate") },
    { label: "Calibrate my second screen", click: () => send("calibrate2") },
    { label: "Test a nudge", click: () => send("test") },
    {
      label: paused ? "Resume Posture Guard" : "Pause Posture Guard",
      click: () => {
        paused = !paused;
        send(paused ? "pause" : "resume");
      },
    },
    { type: "separator" },
    { label: "Open full app (exercises, progress)", click: openFullApp },
    {
      label: widget && widget.isVisible() ? "Hide widget" : "Show widget",
      click: () => (widget && widget.isVisible() ? widget.hide() : widget && widget.showInactive()),
    },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: "separator" },
    { label: "Quit Upright", click: () => app.quit() },
  ]);
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip("Upright");
  tray.on("click", () => tray.popUpContextMenu(menu()));
  tray.on("right-click", () => tray.popUpContextMenu(menu()));
}

/* ---------- messages from the widget page ---------- */
ipcMain.handle("resize", (_e, isExpanded) => {
  expanded = !!isExpanded;
  applyBounds();
  return { flip };
});
ipcMain.handle("getPos", () => {
  const b = widget.getBounds();
  return { x: b.x, y: b.y };
});
ipcMain.on("moveTo", (_e, x, y) => {
  if (!widget) return;
  const b = widget.getBounds();
  widget.setBounds({ x, y, width: b.width, height: b.height });
  // keep the dot's position in step with the window
  anchor = expanded ? { x: flip ? x + PILL.w - DOT : x, y: Math.round(y - (DOT - PILL.h) / 2) } : { x, y };
});
ipcMain.on("dragEnd", () => {
  cfg.anchor = anchor;
  saveCfg();
  applyBounds();
});
ipcMain.on("status", (_e, s) => {
  status = s || status;
  if (tray) tray.setToolTip(`Upright: ${status.label}`);
});
ipcMain.on("contextMenu", () => menu().popup({ window: widget }));

/* ---------- start ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => widget && widget.showInactive());
  app.whenReady().then(() => {
    cfg = loadCfg();
    if (!cfg.url) {
      cfg.url = DEFAULT_URL;
      saveCfg();
    }
    // allow the camera and notifications for Upright only
    const allowed = new URL(appUrl()).origin;
    const ok = (wc, perm) => ["media", "notifications"].includes(perm) && wc && wc.getURL().startsWith(allowed);
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(ok(wc, perm)));
    session.defaultSession.setPermissionCheckHandler((wc, perm) => ok(wc, perm));
    app.setAppUserModelId("app.upright.desktop");

    createWidget();
    createTray();
    screen.on("display-removed", () => {
      const wa = workAreaFor(anchor);
      anchor = { x: Math.min(anchor.x, wa.x + wa.width - DOT), y: Math.min(anchor.y, wa.y + wa.height - DOT) };
      applyBounds();
    });
  });
  // keep running in the tray when the full-app window is closed
  app.on("window-all-closed", (e) => e.preventDefault());
}
