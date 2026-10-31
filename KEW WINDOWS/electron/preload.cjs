// Kew for Windows — preload bridge. Cybergah Group.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kew", {
  info: (url) => ipcRenderer.invoke("kew:info", url),
  playlist: (url) => ipcRenderer.invoke("kew:playlist", url),
  search: (query, limit, source) => ipcRenderer.invoke("kew:search", query, limit, source),
  download: (opts) => ipcRenderer.invoke("kew:download", opts),
  cancel: (taskId) => ipcRenderer.invoke("kew:cancel", taskId),
  openPath: (p) => ipcRenderer.invoke("kew:openPath", p),
  showInFolder: (p) => ipcRenderer.invoke("kew:showInFolder", p),
  listMedia: (type) => ipcRenderer.invoke("kew:listMedia", type),
  notify: (title) => ipcRenderer.invoke("kew:notify", title),
  engineVersion: () => ipcRenderer.invoke("kew:engineVersion"),
  engineUpdate: () => ipcRenderer.invoke("kew:engineUpdate"),
  // save folder: chosen only through the native dialog in the main process
  getFolder: () => ipcRenderer.invoke("kew:getFolder"),
  chooseFolder: () => ipcRenderer.invoke("kew:chooseFolder"),
  resetFolder: () => ipcRenderer.invoke("kew:resetFolder"),
  onProgress: (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on("kew:progress", h);
    return () => ipcRenderer.removeListener("kew:progress", h);
  },
  // desktop prefs: browser/clipboard watch, autostart, translated tray labels
  setPrefs: (p) => ipcRenderer.invoke("kew:prefs", p),
  // fired when the user clicks a "video detected — download?" notification
  onDetectedUrl: (cb) => {
    const h = (_e, url) => cb(url);
    ipcRenderer.on("kew:detected-url", h);
    return () => ipcRenderer.removeListener("kew:detected-url", h);
  },
});
