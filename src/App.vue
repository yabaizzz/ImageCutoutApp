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
import { ref, onMounted } from "vue";

// 响应式数据
const showUpdateDialog = ref(false);
const downloading = ref(false);
const progressPercent = ref(0);
const progressText = ref("");
const updateDownloaded = ref(false);

// 初始化更新监听
onMounted(() => {
  // 确保在上下文隔离模式下通过preload暴露的API访问
  if (window.electronAPI) {
    // 监听更新可用事件
    window.electronAPI.onUpdateAvailable(() => {
      showUpdateDialog.value = true;
      downloading.value = true;
    });

    // 监听下载进度事件
    window.electronAPI.onDownloadProgress((progress) => {
      progressPercent.value = Math.floor(progress.percent);
      progressText.value = `已下载 ${formatBytes(
        progress.transferred
      )}/${formatBytes(progress.total)}`;
    });

    // 监听更新下载完成事件
    window.electronAPI.onUpdateDownloaded(() => {
      downloading.value = false;
      updateDownloaded.value = true;
      progressText.value = "下载完成，点击重启安装";
    });

    // 监听更新错误事件
    window.electronAPI.onUpdateError((error) => {
      console.error("更新失败:", error);
      showUpdateDialog.value = false;
      // 可根据需要添加错误提示
      ElMessage.error(`更新失败${error}`);
    });
  } else {
    console.warn("electronAPI未找到，可能是preload配置问题");
  }
});

// 格式化字节数显示
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// 触发安装更新
const installUpdate = () => {
  window.electronAPI?.installUpdate();
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
