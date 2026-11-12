/**
 * Upright desktop widget.
 * A tiny frameless, see-through, always-on-top posture dot. It loads the Upright
 * web app's /widget page, which runs Posture Guard on your webcam (all on-device).
 */
const { app, BrowserWindow, Menu, Tray, ipcMain, screen, session, shell, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

// Development: UPRIGHT_PROFILE=some-folder runs a separate copy (own settings, own single-instance lock).
if (process.env.UPRIGHT_PROFILE) app.setPath("userData", path.resolve(process.env.UPRIGHT_PROFILE));

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

/**
 * Where the full-app window opens: where you last left it, or a roomy desktop-sized window
 * (the app lays itself out for whatever size you give it).
 */
function appWindowBounds() {
  const saved = cfg.appBounds;
  if (saved && saved.width >= 360 && saved.height >= 560) {
    const wa = workAreaFor({ x: saved.x + 40, y: saved.y + 40 });
    const visible = saved.x + 80 > wa.x && saved.x < wa.x + wa.width - 80 && saved.y >= wa.y - 10 && saved.y < wa.y + wa.height - 80;
    if (visible) return saved;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.min(1280, Math.round(wa.width * 0.85));
  const height = Math.min(860, Math.round(wa.height * 0.9));
  return { width, height, x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2) };
}

/** The full app (exercises, gym, progress) in its own window. `query` can start a routine, e.g. "?start=quickie". */
function openFullApp(query = "") {
  if (appWin) {
    if (query) appWin.loadURL(appUrl() + query);
    if (appWin.isMinimized()) appWin.restore();
    appWin.show();
    return appWin.focus();
  }
  appWin = new BrowserWindow({
    ...appWindowBounds(),
    minWidth: 360,
    minHeight: 560,
    title: "Upright",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "appPreload.js"), backgroundThrottling: false },
  });
  appWin.loadURL(appUrl() + query);
  appWin.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  if (cfg.appMaximized) appWin.maximize();
  // remember the size and place you leave it at
  const remember = () => {
    if (!appWin || appWin.isMinimized()) return;
    cfg.appMaximized = appWin.isMaximized();
    if (!cfg.appMaximized && !appWin.isFullScreen()) cfg.appBounds = appWin.getBounds();
    saveCfg();
  };
  appWin.on("resized", remember);
  appWin.on("moved", remember);
  appWin.on("maximize", remember);
  appWin.on("unmaximize", remember);
  appWin.on("closed", () => {
    appWin = null;
    setExercising(false);
  });
}

/* ---------- pause the dot while you exercise in the app window ---------- */
// (otherwise nods and stretches look like slouching and it nudges you mid-exercise)
let exercising = false;
function setExercising(on) {
  if (exercising === on) return;
  exercising = on;
  if (!paused) send(on ? "pause" : "resume");
  if (on) status = { tone: "idle", label: "Paused while you exercise" };
  if (tray) tray.setToolTip(`Upright: ${on ? "Paused while you exercise" : status.label}`);
}

/* ---------- upright:// links (from the website, shortcuts, or a second launch) ---------- */
const PROTOCOL = "upright";
function handleLink(url) {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return false;
  const parts = url.slice(PROTOCOL.length + 3).replace(/\/+$/, "").split("/").filter(Boolean);
  const [action, arg] = parts;
  if (widget && !widget.isVisible()) widget.showInactive();
  if (action === "start") openFullApp(`?start=${encodeURIComponent(arg || "default")}`);
  else if (action === "widget") {
    /* just make sure the dot is showing */
  } else openFullApp();
  return true;
}
const linkFrom = (argv) => argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`));

function send(cmd) {
  if (widget) widget.webContents.send("cmd", cmd);
}

function menu() {
  return Menu.buildFromTemplate([
    { label: `Upright: ${status.label}`, enabled: false },
    { type: "separator" },
    { label: "Recalibrate (sit tall first)", click: () => send("calibrate") },
    { label: "Test a nudge", click: () => send("test") },
    {
      label: paused ? "Resume Posture Guard" : "Pause Posture Guard",
      click: () => {
        paused = !paused;
        if (!exercising) send(paused ? "pause" : "resume");
      },
    },
    { type: "separator" },
    { label: "Open full app (exercises, gym, progress)", click: () => openFullApp() },
    { label: "Start a quick neck break", click: () => openFullApp("?start=default") },
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
  // Always use the fixed dot/pill size. Re-using getBounds() here made the window grow a pixel
  // on every mouse move on screens with display scaling (e.g. 125%), because of rounding.
  const size = expanded ? PILL : { w: DOT, h: DOT };
  widget.setBounds({ x: Math.round(x), y: Math.round(y), width: size.w, height: size.h });
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
ipcMain.on("exercising", (_e, on) => setExercising(!!on));

/* ---------- start ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // opening Upright again (desktop shortcut, Start menu, or an upright:// link) while it's already running
  app.on("second-instance", (_e, argv) => {
    if (!handleLink(linkFrom(argv))) {
      if (widget) widget.showInactive();
      openFullApp();
    }
  });
  // register upright:// links (the installer also does this); skip in development so we don't point Windows at a dev build
  if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);
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
    // launched by a link (e.g. "Open Upright" on the website)
    const first = linkFrom(process.argv);
    if (first) widget.once("ready-to-show", () => handleLink(first));
    screen.on("display-removed", () => {
      const wa = workAreaFor(anchor);
      anchor = { x: Math.min(anchor.x, wa.x + wa.width - DOT), y: Math.min(anchor.y, wa.y + wa.height - DOT) };
      applyBounds();
    });
  });
  // keep running in the tray when the full-app window is closed
  app.on("window-all-closed", (e) => e.preventDefault());
}
