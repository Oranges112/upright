const { contextBridge, ipcRenderer } = require("electron");

// The full-app window only tells the desktop app when an exercise session starts and ends,
// so the posture dot can pause itself meanwhile.
contextBridge.exposeInMainWorld("uprightApp", {
  exercising: (on) => ipcRenderer.send("exercising", !!on),
});
