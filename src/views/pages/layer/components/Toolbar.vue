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
        v-model="zoomInput"
        size="small"
        style="width: 100px; margin: 0 5px"
        placeholder="如: 1:1"
        @change="handleZoomChange"
        @blur="handleZoomBlur"
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
        :disabled="!canEnableSwipe"
      >
        {{ swipeMode ? "退出卷帘" : "启用卷帘" }}
      </el-button>

      <!-- 拖动按钮 -->
      <el-button
        size="small"
        :type="dragMode ? 'primary' : ''"
        @click="handleToggleDrag"
        :disabled="!canUseDrag"
      >
        <el-icon><Position /></el-icon>
        {{ dragMode ? "退出拖动" : "拖动图像" }}
      </el-button>

      <!-- 区域选择按钮 -->
      <el-button
        size="small"
        :type="rectSelectMode ? 'primary' : ''"
        @click="handleToggleRectSelect"
        :disabled="!canUseRectSelect || dragMode"
      >
        <el-icon><Select /></el-icon>
        {{ rectSelectMode ? "退出选择" : "区域选择" }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { fileUpload } from "@/api/api";
import { useCommonStore, useLayerStore } from "@/store";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Refresh,
  Plus,
  Select,
  Position,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const store = useCommonStore();
const layerStore = useLayerStore();

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  activeTabId: { type: String, default: "" },
  swipeMode: { type: Boolean, default: false },
  currentZoom: { type: Number, default: 1 },
  rectSelectMode: { type: Boolean, default: false },
  dragMode: { type: Boolean, default: false },
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
  "toggle-rect-select",
  "toggle-drag",
  "upload-image",
]);

const zoomInput = ref("1:1");

// 计算是否可以启用卷帘模式
const canEnableSwipe = computed(() => {
  const visibleLayers =
    props.tabs
      .find((tab) => tab.id === props.activeTabId)
      ?.layers?.filter((layer) => layer.visible) || [];
  return visibleLayers.length >= 2;
});

// 计算是否可以使用矩形选择
const canUseRectSelect = computed(() => {
  const currentTab = props.tabs.find((tab) => tab.id === props.activeTabId);
  const visibleLayers =
    currentTab?.layers?.filter((layer) => layer.visible) || [];
  return visibleLayers.length >= 2;
});

// 计算是否可以使用拖动
const canUseDrag = computed(() => {
  const currentTab = props.tabs.find((tab) => tab.id === props.activeTabId);
  return currentTab && currentTab.layers && currentTab.layers.length > 0;
});

// 将zoom值转换为比例字符串
const zoomToRatioString = (zoom) => {
  if (zoom === 1) return "1:1";

  // 如果zoom是整数，直接显示
  if (Number.isInteger(zoom)) {
    return `${zoom}:1`;
  }

  // 如果是小数，转换为分数形式
  // 常见的比例转换
  const commonRatios = {
    0.1: "1:10",
    0.2: "1:5",
    0.25: "1:4",
    0.5: "1:2",
    0.75: "3:4",
    1.25: "5:4",
    1.5: "3:2",
    2: "2:1",
    2.5: "5:2",
    3: "3:1",
    4: "4:1",
    5: "5:1",
  };

  // 查找最接近的常见比例
  let closestRatio = "1:1";
  let minDiff = Infinity;

  for (const [zoomValue, ratio] of Object.entries(commonRatios)) {
    const diff = Math.abs(zoom - parseFloat(zoomValue));
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = ratio;
    }
  }

  // 如果差异很小，使用常见比例，否则精确显示
  if (minDiff < 0.01) {
    return closestRatio;
  }

  // 精确显示为分数
  const numerator = Math.round(zoom * 100);
  const denominator = 100;

  // 简化分数
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(numerator, denominator);

  return `${numerator / divisor}:${denominator / divisor}`;
};

// 解析比例输入为zoom值
const parseRatioToZoom = (input) => {
  // 移除所有空格
  const cleanInput = input.replace(/\s/g, "");

  // 检查是否是比例格式 (如: 1:100)
  if (cleanInput.includes(":")) {
    const parts = cleanInput.split(":");
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);

      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
  }

  // 检查是否是数字 (如: 0.5 表示缩放50%)
  const numericValue = parseFloat(cleanInput);
  if (!isNaN(numericValue)) {
    return numericValue;
  }

  // 无效输入
  return null;
};

// 监听当前缩放变化，更新输入框显示
watch(
  () => props.currentZoom,
  (newVal) => {
    zoomInput.value = zoomToRatioString(newVal);
  },
  { immediate: true }
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
  const zoomValue = parseRatioToZoom(zoomInput.value);

  if (zoomValue !== null) {
    // 限制缩放范围
    const clampedZoom = Math.max(0.1, Math.min(5, zoomValue));
    console.log("clampedZoom", zoomValue, clampedZoom);
    emit("set-zoom", clampedZoom);
  } else {
    // 输入无效，恢复显示
    ElMessage.warning("请输入有效的比例格式，如: 1:1 或 0.5");
    // 恢复之前的显示
    zoomInput.value = zoomToRatioString(props.currentZoom);
  }
};

// 失去焦点时也应用更改
const handleZoomBlur = () => {
  handleZoomChange();
};

const handleResetView = () => {
  emit("reset-view");
};

const handleToggleSwipe = () => {
  if (!canEnableSwipe.value && !props.swipeMode) {
    ElMessage.warning("启用卷帘需要至少两个可见图层");
    return;
  }
  emit("toggle-swipe");
};

// 处理矩形选择模式切换
const handleToggleRectSelect = () => {
  if (!canUseRectSelect.value && !props.rectSelectMode) {
    ElMessage.warning("区域选择需要至少两个可见图层");
    return;
  }
  emit("toggle-rect-select");
};

// 处理拖动模式切换
const handleToggleDrag = () => {
  if (!canUseDrag.value && !props.dragMode) {
    ElMessage.warning("请先加载图像");
    return;
  }
  emit("toggle-drag");
};

const handleImageUpload = (uploadFile) => {
  const file = uploadFile.raw;
  fileUpload(file).then((res) => {
    if (res.data.message == "图像上传成功") {
      ElMessage.success("图像上传成功");

      // 确保图像URL支持跨域访问
      let imageUrl = store.baseUrl + res.data.image_info.image_url;

      emit("upload-image", {
        imageId: res.data.image_id,
        name: res.data.image_info.filename,
        src: imageUrl,
        width: res.data.image_info.image_width,
        height: res.data.image_info.image_height,
      });
    }
  });
};
</script>

<style lang="scss" scoped>
.toolbar {
  padding: 10px;
  background-color: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tab-section {
  .tabs-container {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .tab-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    background-color: #f9fafb;
    transition: all 0.2s ease;
    min-width: 120px;

    &:hover {
      background-color: #f3f4f6;
      border-color: #d1d5db;
    }

    &.active {
      background-color: #1890ff;
      color: white;
      border-color: #1890ff;
      box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
    }

    .tab-name {
      margin-right: 8px;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tab-close {
      font-size: 16px;
      line-height: 1;
      padding: 2px;
      border-radius: 3px;
      transition: background-color 0.2s;

      &:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .tab-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px dashed #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    color: #666;
    transition: all 0.2s ease;

    &:hover {
      border-color: #1890ff;
      color: #1890ff;
      background-color: #f0f7ff;
    }
  }
}

.tools-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

// 响应式设计
@media (max-width: 768px) {
  .tools-section {
    gap: 6px;

    .el-button {
      padding: 6px 8px;
    }
  }
}
</style>
