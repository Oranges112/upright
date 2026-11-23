const { contextBridge, ipcRenderer } = require("electron");

// The only things the widget page can ask the desktop app to do.
contextBridge.exposeInMainWorld("uprightDesktop", {
  resize: (expanded) => ipcRenderer.invoke("resize", expanded),
  getPos: () => ipcRenderer.invoke("getPos"),
  moveTo: (x, y) => ipcRenderer.send("moveTo", x, y),
  dragEnd: () => ipcRenderer.send("dragEnd"),
  onCommand: (cb) => ipcRenderer.on("cmd", (_e, cmd) => cb(cmd)),
  setStatus: (s) => ipcRenderer.send("status", s),
  contextMenu: () => ipcRenderer.send("contextMenu"),
  // 1.4+
  quickMenu: () => ipcRenderer.send("quickMenu"),
  notify: (n) => ipcRenderer.send("notify", n),
  idle: () => ipcRenderer.invoke("idle"),
});
