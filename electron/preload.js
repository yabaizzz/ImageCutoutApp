const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // 标题栏
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowMaximize: () => ipcRenderer.send("window-maximize"),
  windowClose: () => ipcRenderer.send("window-close"),

  //菜单
  windowToggleDevTools: () => ipcRenderer.send("window-toggle-devtools"),
  appQuit: () => ipcRenderer.send("app-quit"),

  // 自动更新
  installUpdate: () => ipcRenderer.send("install-update"),
  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", callback),
  onDownloadProgress: (callback) =>
    ipcRenderer.on("download-progress", (event, progress) =>
      callback(progress)
    ),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", callback),
  // 保存图片
  saveImage: (buffer, filename) =>
    ipcRenderer.invoke("save-image", buffer, filename),
});
