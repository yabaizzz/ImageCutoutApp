const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { autoUpdater } = require("electron-updater");

const isDev = process.env.NODE_ENV === "development"; // 是否开发环境
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1024,
    frame: false, // 隐藏系统自带标题栏
    titleBarStyle: "hidden", // Mac 上更友好
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false, // 关闭 Node 集成
      contextIsolation: true, // 必须为 true
    },
  });

  if (isDev) {
    // ✅ 开发环境
    mainWindow.loadURL("http://localhost:8080");
    mainWindow.webContents.openDevTools();
  } else {
    // ✅ 生产环境
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    // 隐藏菜单
    mainWindow.setMenu(null);

    // 自动更新只在生产环境运行
    initAutoUpdater();
  }
}

// 自动更新封装
function initAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", () => {
    mainWindow.webContents.send("update-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("download-progress", progress);
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("update-downloaded");
  });

  autoUpdater.on("error", (err) => {
    console.error("自动更新错误:", err);
    mainWindow.webContents.send("update-error", err.message);
  });

  // 在已有的initAutoUpdater函数下方添加
  ipcMain.on("check-for-updates", () => {
    if (!isDev) {
      // 只在生产环境执行
      autoUpdater.checkForUpdatesAndNotify();

      // 检查到没有更新时的处理
      autoUpdater.once("update-not-available", () => {
        mainWindow.webContents.send("update-not-available");
      });
    }
  });
}
// 让渲染进程触发安装
ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

// 标题栏
ipcMain.on("window-minimize", () => {
  mainWindow.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("window-close", () => {
  mainWindow.close();
});

// 菜单栏
ipcMain.on("window-toggle-devtools", () =>
  mainWindow.webContents.toggleDevTools()
);
ipcMain.on("app-quit", () => app.quit());

app.whenReady().then(() => {
  createWindow();

  // 保存图片
  ipcMain.handle("save-image", async (event, src, filename) => {
    try {
      let buffer;

      if (src.startsWith("http")) {
        // 下载图片
        const response = await axios.get(src, { responseType: "arraybuffer" });
        buffer = Buffer.from(response.data);
      } else if (src.startsWith("data:image")) {
        // base64
        const base64Data = src.replace(/^data:image\/\w+;base64,/, "");
        buffer = Buffer.from(base64Data, "base64");
      } else {
        throw new Error("Invalid image source");
      }

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "保存处理后的图片",
        defaultPath: filename || "result.png",
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
      });

      if (canceled || !filePath)
        return { success: false, message: "用户取消保存" };

      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (err) {
      console.error("保存图片失败：", err);
      return { success: false, message: err.message };
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
