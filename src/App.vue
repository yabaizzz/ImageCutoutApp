<template>
  <div class="app-container">
    <!-- 自定义标题栏 -->
    <CustomTitleBar title="遥感智能分析系统" />

    <!-- 主体内容 -->
    <div class="main-content">
      <router-view />
    </div>

    <!-- 下载进度弹窗（保留在App.vue，因为和全局更新相关） -->
    <el-dialog
      v-model="showUpdateDialog"
      title="发现新版本"
      width="400px"
      :close-on-click-modal="false"
    >
      <div v-if="downloading">
        <el-progress :percentage="progressPercent" />
        <p>{{ progressText }}</p>
      </div>
      <div v-else>
        <p>发现新版本，正在准备下载...</p>
      </div>
      <span slot="footer" class="dialog-footer" v-if="updateDownloaded">
        <el-button type="primary" @click="installUpdate">重启安装</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script setup>
import CustomTitleBar from "@/components/CustomTitleBar/index.vue";
import { ref } from "vue";

let ipcRenderer = null;
if (window && window.process && window.process.type) {
  ipcRenderer = window.require("electron").ipcRenderer;
}

const showUpdateDialog = ref(false);
const downloading = ref(false);
const progressPercent = ref(0);
const progressText = ref("");
const updateDownloaded = ref(false);

if (ipcRenderer) {
  ipcRenderer.on("update-available", () => {
    showUpdateDialog.value = true;
    downloading.value = true;
  });

  ipcRenderer.on("download-progress", (event, progress) => {
    progressPercent.value = Math.floor(progress.percent);
    progressText.value = `已下载 ${progress.transferred}/${progress.total} 字节`;
  });

  ipcRenderer.on("update-downloaded", () => {
    downloading.value = false;
    updateDownloaded.value = true;
    progressText.value = "下载完成，点击重启安装";
  });
}

const installUpdate = () => {
  ipcRenderer?.send("install-update");
};
</script>

<style lang="scss">
body {
  margin: 0;
}

.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 主体内容留出标题栏高度 */
.main-content {
  flex: 1;
  overflow: auto;
  width: 100%;
  height: calc(100% - 35px);
  padding-top: 35px;
  box-sizing: border-box;
}

/* 隐藏竖向滚动条，但保留横向 */
::-webkit-scrollbar {
  width: 0;
}
::-webkit-scrollbar:horizontal {
  height: 8px;
}
::-webkit-scrollbar-track:horizontal {
  background: #f1f1f1;
}
::-webkit-scrollbar-thumb:horizontal {
  background: #888;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:horizontal:hover {
  background: #555;
}
</style>
