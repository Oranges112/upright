const { contextBridge, ipcRenderer } = require("electron");

// The full-app window tells the desktop app when an exercise session starts and ends (so the
// posture dot can pause itself), and can show / trigger app updates in Settings.
contextBridge.exposeInMainWorld("uprightApp", {
  exercising: (on) => ipcRenderer.send("exercising", !!on),
  getUpdate: () => ipcRenderer.invoke("update:get"),
  checkUpdates: () => ipcRenderer.send("update:check"),
  installUpdate: () => ipcRenderer.send("update:install"),
  onUpdate: (cb) => {
    const h = (_e, info) => cb(info);
    ipcRenderer.on("update", h);
    return () => ipcRenderer.removeListener("update", h);
  },
});
