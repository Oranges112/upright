/**
 * Upright desktop widget.
 * A tiny frameless, see-through, always-on-top posture dot. It loads the Upright
 * web app's /widget page, which runs Posture Guard on your webcam (all on-device).
 */
const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, net, powerMonitor, screen, session, shell, nativeImage, systemPreferences } = require("electron");
const path = require("path");
const fs = require("fs");

const MAC = process.platform === "darwin";
/** where Mac users download new versions (unsigned Mac apps can't update themselves) */
const MAC_DOWNLOAD = "https://github.com/Oranges112/upright/releases/latest/download/Upright-Mac.dmg";
const LATEST_RELEASE_API = "https://api.github.com/repos/Oranges112/upright/releases/latest";

// Development: UPRIGHT_PROFILE=some-folder runs a separate copy (own settings, own single-instance lock).
if (process.env.UPRIGHT_PROFILE) app.setPath("userData", path.resolve(process.env.UPRIGHT_PROFILE));

// Chimes must play without a click first.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const DEFAULT_URL = "https://oranges112.github.io/upright/";
const DOT = 50; // px, the see-through dot
const PILL = { w: 268, h: 58 }; // px, when it pops out

/* ---------- settings (%APPDATA%/Upright/config.json on Windows, ~/Library/Application Support/Upright on Mac) ---------- */
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
/** Posture Guard is paused (reported by the dot) */
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
  // (skipTransformProcessType: on a Mac, don't let this hide the dock icon behind our back)
  widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  widget.loadURL(`${appUrl()}widget`);
  widget.once("ready-to-show", () => {
    if (!cfg.hideDot) widget.showInactive();
  });
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
  if (MAC) void app.dock?.show();
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
    if (MAC) app.dock?.hide(); // back to just the dot and the menu-bar icon
  });
}

/* ---------- pause the dot while you exercise in the app window ---------- */
// (otherwise nods and stretches look like slouching and it nudges you mid-exercise)
let exercising = false;
function setExercising(on) {
  if (exercising === on) return;
  exercising = on;
  // the dot keeps its camera on and just stops judging (the app window also tells it directly)
  send(on ? "exercise-on" : "exercise-off");
  if (on) status = { tone: "idle", label: "Paused while you exercise" };
  if (tray) tray.setToolTip(`Upright: ${on ? "Paused while you exercise" : status.label}`);
}

/* ---------- upright:// links (from the website, shortcuts, or a second launch) ---------- */
const PROTOCOL = "upright";
function handleLink(url) {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return false;
  const parts = url.slice(PROTOCOL.length + 3).replace(/\/+$/, "").split("/").filter(Boolean);
  const [action, arg] = parts;
  if (widget && !widget.isVisible() && !cfg.hideDot) widget.showInactive();
  if (action === "start") openFullApp(`?start=${encodeURIComponent(arg || "default")}`);
  else if (action === "widget") {
    /* just make sure the dot is showing */
  } else openFullApp();
  return true;
}
const linkFrom = (argv) => argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`));

/* ---------- automatic updates (from the GitHub releases) ---------- */
// Checks on start and every few hours, downloads quietly, then offers "Restart to update".
// If you don't, it installs the next time Upright quits.
let updater = null;
/** idle | checking | none | downloading | ready | error */
let update = { state: "idle", version: null, pct: 0 };
const UPDATE_EVERY = 4 * 3600_000;

function setUpdate(patch) {
  update = { ...update, ...patch };
  for (const w of [appWin, widget]) if (w && !w.isDestroyed()) w.webContents.send("update", updateInfo());
}
function updateInfo() {
  // manual: the update is a download you install yourself (Mac), not a restart
  return { ...update, current: app.getVersion(), manual: MAC, platform: MAC ? "mac" : "windows" };
}
function updateLabel() {
  switch (update.state) {
    case "checking":
      return "Checking for updates…";
    case "downloading":
      return `Downloading update… ${update.pct}%`;
    case "ready":
      return MAC ? `Download Upright ${update.version}` : `Restart to update to ${update.version}`;
    case "none":
      return `Up to date (${app.getVersion()}) · check again`;
    case "error":
      return "Couldn't check for updates · try again";
    default:
      return "Check for updates";
  }
}
function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(__dirname, "icon.png") });
  if (onClick) n.on("click", onClick);
  n.show();
}
let manualCheck = false;
function checkForUpdates(manual = false) {
  if (MAC) return void checkMacUpdates(manual);
  if (!updater) {
    if (manual) notify("Updates", "Automatic updates only work in the installed app (Upright-Setup.exe).");
    return;
  }
  if (update.state === "downloading" || update.state === "checking") return;
  if (update.state === "ready") return installUpdate();
  manualCheck = manual;
  setUpdate({ state: "checking" });
  updater.checkForUpdates().catch(() => setUpdate({ state: "error" }));
}
function installUpdate() {
  if (MAC) {
    if (update.state === "ready") void shell.openExternal(MAC_DOWNLOAD);
    return;
  }
  if (update.state !== "ready" || !updater) return;
  setImmediate(() => updater.quitAndInstall(true, true));
}
/** "1.10.0" > "1.9.2" */
function newer(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

/**
 * Mac: Apple only lets signed apps replace themselves, so we look for a newer release and offer
 * the download. (Posture checks and screens still update by themselves: they load from the website.)
 */
async function checkMacUpdates(manual) {
  if (update.state === "checking") return;
  manualCheck = manual;
  setUpdate({ state: "checking" });
  try {
    const res = await net.fetch(LATEST_RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(String(res.status));
    const rel = await res.json();
    const latest = String(rel.tag_name || "").replace(/^desktop-v/, "");
    const hasMac = (rel.assets || []).some((a) => a.name === "Upright-Mac.dmg");
    if (latest && hasMac && newer(latest, app.getVersion())) {
      const firstTime = update.version !== latest;
      setUpdate({ state: "ready", version: latest });
      if (firstTime || manual) notify(`Upright ${latest} is available`, "Click to download it, then drag it into Applications to replace this one.", installUpdate);
    } else {
      setUpdate({ state: "none" });
      if (manual) notify("Upright is up to date", `You have the newest version (${app.getVersion()}).`);
    }
  } catch {
    setUpdate({ state: "error" });
    if (manual) notify("Couldn't check for updates", "Check your internet connection and try again.");
  }
}

function setupUpdates() {
  if (!app.isPackaged) return; // a development copy never updates itself
  if (MAC) {
    setTimeout(() => checkMacUpdates(false), 15_000);
    setInterval(() => checkMacUpdates(false), UPDATE_EVERY);
    return;
  }
  // testing: UPRIGHT_UPDATE_URL points a test copy at a local update server
  if (process.env.UPRIGHT_PROFILE && !process.env.UPRIGHT_UPDATE_URL) return;
  try {
    updater = require("electron-updater").autoUpdater;
  } catch {
    return;
  }
  if (process.env.UPRIGHT_UPDATE_URL) updater.setFeedURL({ provider: "generic", url: process.env.UPRIGHT_UPDATE_URL });
  updater.autoDownload = true;
  // a test copy must never install anything
  if (process.env.UPRIGHT_PROFILE) updater.autoInstallOnAppQuit = false;
  if (!process.env.UPRIGHT_PROFILE) updater.autoInstallOnAppQuit = true;
  updater.on("update-available", (i) => setUpdate({ state: "downloading", version: i.version, pct: 0 }));
  updater.on("download-progress", (p) => setUpdate({ state: "downloading", pct: Math.round(p.percent || 0) }));
  updater.on("update-not-available", () => {
    setUpdate({ state: "none" });
    if (manualCheck) notify("Upright is up to date", `You have the newest version (${app.getVersion()}).`);
  });
  updater.on("update-downloaded", (i) => {
    setUpdate({ state: "ready", version: i.version });
    notify(`Upright ${i.version} is ready`, "Click to restart and update now, or it'll update the next time Upright closes.", installUpdate);
  });
  updater.on("error", () => {
    setUpdate({ state: "error" });
    if (manualCheck) notify("Couldn't check for updates", "Check your internet connection and try again.");
  });
  setTimeout(() => checkForUpdates(false), 15_000);
  setInterval(() => checkForUpdates(false), UPDATE_EVERY);
}
ipcMain.handle("update:get", () => updateInfo());
ipcMain.on("update:check", () => checkForUpdates(true));
ipcMain.on("update:install", () => installUpdate());

function send(cmd) {
  if (widget) widget.webContents.send("cmd", cmd);
}

const PAUSES = [
  [15, "15 minutes"],
  [30, "30 minutes"],
  [60, "1 hour"],
  [120, "2 hours"],
];

function pauseItems() {
  if (paused) return [{ label: "▶ Turn Posture Guard back on", click: () => send("resume") }];
  return [
    {
      label: "Pause Posture Guard",
      submenu: [...PAUSES.map(([m, l]) => ({ label: `For ${l}`, click: () => send(`pause:${m}`) })), { type: "separator" }, { label: "Until I turn it back on", click: () => send("pause") }],
    },
  ];
}

function toggleDot() {
  if (!widget) return;
  cfg.hideDot = widget.isVisible();
  saveCfg();
  if (cfg.hideDot) widget.hide();
  else widget.showInactive();
}

/** Left click on the dot: the things you do most. */
function quickMenu() {
  return Menu.buildFromTemplate([
    { label: `Upright: ${status.label}`, enabled: false },
    { type: "separator" },
    { label: "🧍 Quick stretch (1 min)", click: () => openFullApp("?start=stretch") },
    { label: "🧘 Neck break", click: () => openFullApp("?start=default") },
    { type: "separator" },
    ...pauseItems(),
    { label: "Recalibrate (sit tall first)", click: () => send("calibrate") },
    { type: "separator" },
    { label: "Open Upright", click: () => openFullApp() },
  ]);
}

function menu() {
  return Menu.buildFromTemplate([
    { label: `Upright: ${status.label}`, enabled: false },
    ...(update.state === "ready" ? [{ label: `⬆ ${updateLabel()}`, click: installUpdate }] : []),
    { type: "separator" },
    { label: "Open Upright", click: () => openFullApp() },
    { label: "🧍 Quick stretch (1 min)", click: () => openFullApp("?start=stretch") },
    { label: "🧘 Neck break", click: () => openFullApp("?start=default") },
    { type: "separator" },
    ...pauseItems(),
    { label: "Recalibrate (sit tall first)", click: () => send("calibrate") },
    { label: "Test a nudge", click: () => send("test") },
    { type: "separator" },
    { label: widget && widget.isVisible() ? "Hide the floating dot" : "Show the floating dot", click: toggleDot },
    {
      label: MAC ? "Open at login" : "Start with Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => setOpenAtLogin(item.checked),
    },
    { type: "separator" },
    { label: updateLabel(), enabled: update.state !== "checking" && update.state !== "downloading", click: () => checkForUpdates(true) },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { label: "Quit Upright", click: () => app.quit() },
  ]);
}

/** Start with the computer: quietly, as just the dot (no app window). */
function setOpenAtLogin(on) {
  app.setLoginItemSettings({ openAtLogin: !!on, args: ["--background"] });
}
/** Started by the computer at login (not by you clicking the icon)? */
function startedAtLogin() {
  if (process.argv.includes("--background")) return true;
  try {
    return MAC && !!app.getLoginItemSettings().wasOpenedAtLogin;
  } catch {
    return false;
  }
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
  if (s && typeof s.paused === "boolean") paused = s.paused;
  if (tray) tray.setToolTip(`Upright: ${status.label}`);
});
ipcMain.on("contextMenu", () => menu().popup({ window: widget }));
ipcMain.on("quickMenu", () => quickMenu().popup({ window: widget }));

/* ---------- native notifications (reminders and posture nudges) ---------- */
let lastNotice = null;
ipcMain.on("notify", (_e, n) => {
  if (!n || !Notification.isSupported()) return;
  // one at a time per kind: a new posture nudge replaces the last one
  if (lastNotice && lastNotice.kind === n.kind) {
    try {
      lastNotice.n.close();
    } catch {}
  }
  const note = new Notification({ title: String(n.title || "Upright"), body: String(n.body || ""), icon: path.join(__dirname, "icon.png"), silent: true });
  note.on("click", () => {
    if (!handleLink(n.link)) openFullApp();
  });
  note.show();
  lastNotice = { kind: n.kind, n: note };
});

/* ---------- are you at the computer? (a break away from the desk counts as your stretch) ---------- */
ipcMain.handle("idle", () => {
  try {
    return { sec: powerMonitor.getSystemIdleTime(), locked: powerMonitor.getSystemIdleState(60) === "locked" };
  } catch {
    return { sec: 0, locked: false };
  }
});

/* ---------- desktop settings shown in the app's Settings ---------- */
ipcMain.handle("prefs:get", () => ({ openAtLogin: app.getLoginItemSettings().openAtLogin, showDot: !cfg.hideDot }));
ipcMain.on("prefs:set", (_e, p) => {
  if (!p) return;
  if (typeof p.openAtLogin === "boolean") setOpenAtLogin(p.openAtLogin);
  if (typeof p.showDot === "boolean" && widget) {
    cfg.hideDot = !p.showDot;
    saveCfg();
    if (cfg.hideDot) widget.hide();
    else widget.showInactive();
  }
});
ipcMain.on("exercising", (_e, on) => setExercising(!!on));

/* ---------- start ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // opening Upright again (desktop shortcut, Start menu, or an upright:// link) while it's already running
  app.on("second-instance", (_e, argv) => {
    if (!handleLink(linkFrom(argv))) {
      if (widget && !cfg.hideDot) widget.showInactive();
      openFullApp();
    }
  });
  // register upright:// links (the installer also does this); skip in development so we don't point Windows at a dev build
  if (app.isPackaged && !process.env.UPRIGHT_PROFILE) app.setAsDefaultProtocolClient(PROTOCOL);
  // Mac: links arrive as an event (including the one that launched us), and opening the app again
  // (Finder, Launchpad, Spotlight) "activates" the running copy instead of starting a second one
  let pendingLink = null;
  let started = false;
  app.on("open-url", (e, url) => {
    e.preventDefault();
    if (started && widget) handleLink(url);
    else pendingLink = url;
  });
  app.on("activate", () => {
    if (!started) return;
    if (widget && !cfg.hideDot) widget.showInactive();
    openFullApp();
  });
  // Mac: a menu-bar app; the dock icon only shows while the full app window is open
  if (MAC) app.dock?.hide();
  app.whenReady().then(async () => {
    cfg = loadCfg();
    const freshInstall = !cfg.url && !cfg.anchor && !cfg.appBounds;
    if (!cfg.url) {
      cfg.url = DEFAULT_URL;
      saveCfg();
    }
    // allow the camera and notifications for Upright only
    const allowed = new URL(appUrl()).origin;
    const ok = (wc, perm) => ["media", "notifications"].includes(perm) && wc && wc.getURL().startsWith(allowed);
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(ok(wc, perm)));
    session.defaultSession.setPermissionCheckHandler((wc, perm) => ok(wc, perm));
    if (!MAC) app.setAppUserModelId("app.upright.desktop");
    // Mac asks once whether Upright may use the camera (the dot needs it for Posture Guard)
    if (MAC && systemPreferences.getMediaAccessStatus("camera") === "not-determined") {
      try {
        await systemPreferences.askForMediaAccess("camera");
      } catch {}
    }

    createWidget();
    createTray();
    setupUpdates();
    // launched by a link (e.g. "Open Upright" on the website)
    const first = linkFrom(process.argv) || pendingLink;
    if (first) widget.once("ready-to-show", () => handleLink(first));
    // You clicked the Upright icon: open the app too (first time: that's where setup is).
    // Started with the computer: just the dot, quietly.
    else if (!startedAtLogin() || !cfg.welcomed) widget.once("ready-to-show", () => openFullApp());
    if (!cfg.welcomed) {
      cfg.welcomed = true;
      // a brand-new install starts with the computer (you can turn it off in Settings or the tray menu)
      if (freshInstall && app.isPackaged && !process.env.UPRIGHT_PROFILE) setOpenAtLogin(true);
      saveCfg();
    }
    // older versions turned on "start with the computer" without the quiet flag: add it
    else if (app.isPackaged && app.getLoginItemSettings().openAtLogin && !cfg.loginArgs) setOpenAtLogin(true);
    cfg.loginArgs = true;
    saveCfg();
    started = true;
    screen.on("display-removed", () => {
      const wa = workAreaFor(anchor);
      anchor = { x: Math.min(anchor.x, wa.x + wa.width - DOT), y: Math.min(anchor.y, wa.y + wa.height - DOT) };
      applyBounds();
    });
  });
  // keep running in the tray when the full-app window is closed
  app.on("window-all-closed", (e) => e.preventDefault());
}
