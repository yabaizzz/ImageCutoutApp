const { app, BrowserWindow, Menu, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const isDev = process.env.NODE_ENV === "development"; //是否是开发环境
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1024,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (!isDev) {
    mainWindow.setMenu(null); // 生产环境隐藏菜单
  } else {
    // 开发环境菜单
    const menuTemplate = [
      { label: "文件", submenu: [{ label: "退出", role: "quit" }] },
      {
        label: "编辑",
        submenu: [
          { label: "撤销", role: "undo" },
          { label: "重做", role: "redo" },
          { type: "separator" },
          { label: "复制", role: "copy" },
          { label: "粘贴", role: "paste" },
        ],
      },
      {
        label: "视图",
        submenu: [
          { label: "刷新", role: "reload" },
          { label: "开发者工具", role: "toggleDevTools" },
        ],
      },
    ];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
  }

  if (isDev) {
    mainWindow.loadURL("http://localhost:8080"); // Vue dev server
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // 自动更新（只在生产环境）
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("update-available", () => {
      dialog.showMessageBox({
        type: "info",
        title: "更新可用",
        message: "发现新版本，正在下载...",
      });
    });

    autoUpdater.on("update-downloaded", () => {
      dialog
        .showMessageBox({
          type: "info",
          title: "更新下载完成",
          message: "新版本已下载，重启应用以安装。",
          buttons: ["重启", "稍后"],
        })
        .then((result) => {
          if (result.response === 0) autoUpdater.quitAndInstall();
        });
    });

    autoUpdater.on("error", (err) => {
      console.error("自动更新错误:", err);
    });
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
