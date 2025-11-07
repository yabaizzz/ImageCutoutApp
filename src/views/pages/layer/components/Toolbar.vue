<template>
  <div class="toolbar">
    <div class="tab-section">
      <div class="tabs-container">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: activeTabId === tab.id }"
          @click="handleSwitchTab(tab.id)"
        >
          <span class="tab-name">{{ tab.name }}</span>
          <span class="tab-close" @click.stop="handleRemoveTab(tab.id)">×</span>
        </div>
        <div class="tab-add" @click="handleAddTab">
          <el-icon><Plus /></el-icon>
        </div>
      </div>
    </div>

    <div class="tools-section">
      <el-upload
        action=""
        :auto-upload="false"
        :on-change="handleImageUpload"
        accept="image/*"
        :show-file-list="false"
      >
        <el-button type="primary" size="small">
          <el-icon><Upload /></el-icon> 加载图像
        </el-button>
      </el-upload>

      <el-button size="small" @click="handleZoomOut">
        <el-icon><ZoomOut /></el-icon> 缩小
      </el-button>
      <el-input
        v-model.number="zoomInput"
        size="small"
        style="width: 80px; margin: 0 5px"
        @change="handleZoomChange"
      />
      <el-button size="small" @click="handleZoomIn">
        <el-icon><ZoomIn /></el-icon> 放大
      </el-button>
      <el-button size="small" @click="handleResetView">
        <el-icon><Refresh /></el-icon> 重置视图
      </el-button>

      <el-button
        size="small"
        :type="swipeMode ? 'primary' : ''"
        @click="handleToggleSwipe"
      >
        {{ swipeMode ? "退出卷帘" : "启用卷帘" }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, watch } from "vue";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Refresh,
  Plus,
} from "@element-plus/icons-vue";

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  activeTabId: { type: String, default: "" },
  swipeMode: { type: Boolean, default: false },
  currentZoom: { type: Number, default: 100 },
});

const emit = defineEmits([
  "add-tab",
  "remove-tab",
  "switch-tab",
  "zoom-in",
  "zoom-out",
  "set-zoom",
  "reset-view",
  "toggle-swipe",
  "upload-image",
]);

const zoomInput = ref(props.currentZoom);

// 监听当前缩放变化
watch(
  () => props.currentZoom,
  (newVal) => {
    zoomInput.value = newVal;
  }
);

const handleAddTab = () => {
  emit("add-tab");
};

const handleRemoveTab = (tabId) => {
  emit("remove-tab", tabId);
};

const handleSwitchTab = (tabId) => {
  emit("switch-tab", tabId);
};

const handleZoomIn = () => {
  emit("zoom-in");
};

const handleZoomOut = () => {
  emit("zoom-out");
};

const handleZoomChange = () => {
  emit("set-zoom", zoomInput.value);
};

const handleResetView = () => {
  emit("reset-view");
};

const handleToggleSwipe = () => {
  emit("toggle-swipe");
};

const handleImageUpload = (uploadFile) => {
  const file = uploadFile.raw;
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;

    img.onload = () => {
      emit("upload-image", {
        name: file.name,
        src: e.target.result,
        width: img.width,
        height: img.height,
      });
    };
  };

  reader.readAsDataURL(file);
};
</script>

<style lang="scss" scoped>
.toolbar {
  padding: 10px;
  background-color: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.tab-section {
  margin-bottom: 10px;

  .tabs-container {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .tab-item {
    display: flex;
    align-items: center;
    padding: 5px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    cursor: pointer;
    background-color: #f9fafb;
    transition: all 0.2s;

    &:hover {
      background-color: #f3f4f6;
    }

    &.active {
      background-color: #1890ff;
      color: white;
      border-color: #1890ff;
    }

    .tab-name {
      margin-right: 8px;
    }

    .tab-close {
      font-size: 16px;
      line-height: 1;
      padding: 2px;
      border-radius: 2px;

      &:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .tab-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px dashed #e5e7eb;
    border-radius: 4px;
    cursor: pointer;
    color: #666;

    &:hover {
      border-color: #1890ff;
      color: #1890ff;
    }
  }
}

.tools-section {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
