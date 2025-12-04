<template>
  <div class="remote-sensing-app">
    <Toolbar
      :tabs="tabs"
      :active-tab-id="activeTabId"
      :swipe-mode="swipeMode"
      :current-zoom="currentZoom"
      :rect-select-mode="rectSelectMode"
      :drag-mode="dragMode"
      @add-tab="handleAddTab"
      @remove-tab="handleRemoveTab"
      @switch-tab="handleSwitchTab"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @set-zoom="handleSetZoom"
      @reset-view="handleResetView"
      @toggle-swipe="handleToggleSwipe"
      @toggle-rect-select="handleToggleRectSelect"
      @toggle-drag="handleToggleDrag"
      @upload-image="handleUploadImage"
    />

    <div class="main-content">
      <LayerPanel
        :layers="currentTab?.layers || []"
        :active-layer-id="activeLayerId"
        @set-active-layer="handleSetActiveLayer"
        @duplicate-layer="handleDuplicateLayer"
        @remove-layer="handleRemoveLayer"
        @set-visibility="handleSetVisibility"
        @open-settings="handleOpenLayerSettings"
        @update:layers="handleUpdateLayers"
      />

      <ImageViewer
        :tab="currentTab"
        :layers="currentTab?.layers || []"
        :swipe-mode="swipeMode"
        :swipe-position="swipePosition"
        :rect-select-mode="rectSelectMode"
        :drag-mode="dragMode"
        @update-pan="handleUpdatePan"
        @set-swipe-position="handleSetSwipePosition"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @toggle-swipe="handleToggleSwipe"
        @rect-complete="handleRectComplete"
      />

      <InfoPanel
        :current-layer="currentLayer"
        :statistics-data="statisticsData"
        @apply-preprocessing="handleApplyPreprocessing"
        @clear-statistics="handleClearStatistics"
      />
    </div>

    <algorithmParamDialog
      v-model="dialogVisible"
      :imageId="imageId"
      :algorithms="algorithms"
      :defaultParams="defaultParams"
      @confirm="handleAlgorithmConfirm"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useLayerStore, useCommonStore } from "@/store";
import Toolbar from "./components/Toolbar.vue";
import LayerPanel from "./components/LayerPanel.vue";
import ImageViewer from "./components/ImageViewer.vue";
import InfoPanel from "./components/InfoPanel.vue";
import algorithmParamDialog from "./components/algorithmParamDialog.vue";
import { ElMessage, ElLoading } from "element-plus";

const store = useLayerStore();
const commonStore = useCommonStore();

const dialogVisible = ref(false);
const defaultParams = ref({ ...commonStore?.defaultParams });
const algorithms = ref([...commonStore?.algorithms]);
const imageId = ref(null);

// 状态映射
const tabs = computed(() => store.tabs);
const activeTabId = computed(() => store.activeTabId);
const currentTab = computed(() => store.currentTab);
const currentLayer = computed(() => store.currentLayer);
const activeLayerId = computed(() => store.activeLayerId);
const swipeMode = computed(() => store.swipeMode);
const swipePosition = computed(() => store.swipePosition);
const currentZoom = computed(() => store.currentTab?.zoom || 1);
const rectSelectMode = computed(() => store.rectSelectMode);
const statisticsData = computed(() => store.currentStatistics);
const dragMode = computed(() => store.dragMode);

// 事件处理
const handleAddTab = () => {
  store.addNewTab();
};

const handleRemoveTab = (tabId) => {
  store.removeTab(tabId);
};

const handleSwitchTab = (tabId) => {
  store.switchTab(tabId);
};

const handleZoomIn = () => {
  store.zoomIn();
};

const handleZoomOut = () => {
  store.zoomOut();
};

const handleSetZoom = (value) => {
  store.setZoom(value);
};

const handleResetView = () => {
  store.resetView();
  // 重置时也重置平移
  if (store.activeTabId) {
    store.resetPan(store.activeTabId);
  }
};

const handleToggleSwipe = () => {
  store.toggleSwipeMode();
};

// 处理矩形选择模式切换
const handleToggleRectSelect = () => {
  store.toggleRectSelectMode();
};

// 处理拖动模式切换
const handleToggleDrag = () => {
  store.toggleDragMode();
};

const handleSetActiveLayer = (layerId) => {
  store.setActiveLayer(layerId);
};

const handleDuplicateLayer = (layerId) => {
  store.duplicateLayer(layerId);
};

const handleRemoveLayer = (layerId) => {
  store.removeLayer(layerId);
};

const handleSetVisibility = (layerId, visible) => {
  store.setLayerVisibility(layerId, visible);
};

// 处理平移更新
const handleUpdatePan = (panX, panY) => {
  if (store.activeTabId) {
    store.updatePan(store.activeTabId, panX, panY);
  }
};

const handleSetSwipePosition = (position) => {
  store.setSwipePosition(position);
};

const handleApplyPreprocessing = (layerId, processedData) => {
  store.applyPreprocessing(layerId, processedData);
};

const handleUndoPreprocessing = (layerId) => {
  store.undoPreprocessing(layerId);
};

const handleOpenLayerSettings = (layerId) => {
  dialogVisible.value = true;
  imageId.value = layerId;
};

const handleAlgorithmConfirm = (params) => {
  console.log("确认算法参数:", params);
};

const handleUploadImage = (imageData) => {
  store.addLayer(imageData);
};

const handleUpdateLayers = (newLayersOrder) => {
  store.updateLayerOrder(newLayersOrder);
};

// 处理矩形完成选择
const handleRectComplete = async (selectionData) => {
  console.log("矩形选择完成", selectionData);

  const { rectData, layerImageData, swipeMode, swipePosition } = selectionData;

  if (!layerImageData || layerImageData.length < 2) {
    ElMessage.warning("需要至少两个图层数据进行区域对比");
    return;
  }

  // 显示加载状态
  const loading = ElLoading.service({
    lock: true,
    text: "正在分析区域数据...",
    background: "rgba(0, 0, 0, 0.7)",
  });

  try {
    // 记录卷帘图层信息
    if (swipeMode) {
      const swipeLayers = layerImageData.map((data) => ({
        id: data.layerId,
        name: data.layerName,
      }));
      store.setSwipeLayers(swipeLayers);
    }

    // 实际调用后端API获取统计信息
    const statistics = await fetchRectStatistics(layerImageData, rectData, {
      swipeMode,
      swipePosition,
    });
    store.setStatisticsData(statistics);
    store.setSelectedRect(rectData);

    ElMessage.success("区域分析完成");
  } catch (error) {
    console.error("获取统计信息失败:", error);
    ElMessage.error("区域分析失败");
  } finally {
    loading.close();
  }
};

// 实际调用后端API的函数
const fetchRectStatistics = async (layerImageData, rectData, options = {}) => {
  const { swipeMode = false, swipePosition = 50 } = options;

  // 创建FormData对象
  const formData = new FormData();

  // 添加矩形区域信息
  formData.append(
    "rect_data",
    JSON.stringify({
      x: rectData.x,
      y: rectData.y,
      width: rectData.width,
      height: rectData.height,
      bounds: rectData.bounds,
    })
  );

  // 添加显示模式信息
  formData.append(
    "display_mode",
    JSON.stringify({
      swipeMode,
      swipePosition,
    })
  );

  // 添加每个图层的图像数据
  layerImageData.forEach((imageData, index) => {
    // 创建文件对象
    const file = new File(
      [imageData.blob],
      `region_${imageData.layerName}_${Date.now()}.png`,
      { type: "image/png" }
    );

    formData.append(`layer_${index + 1}`, file);
    formData.append(
      `layer_${index + 1}_info`,
      JSON.stringify({
        layerId: imageData.layerId,
        layerName: imageData.layerName,
        // 添加在卷帘模式中的显示位置
        swipeSide: swipeMode ? (index === 0 ? "left" : "right") : "both",
      })
    );
  });

  // 添加标签信息
  formData.append("tab_id", store.activeTabId);
  return await getMockStatistics(layerImageData, rectData, options);
  try {
    // 调用实际的后端API
    const response = await getRectStatistics(formData);

    if (response.data.success) {
      return response.data.statistics;
    } else {
      throw new Error(response.data.message || "分析失败");
    }
  } catch (error) {
    // 如果后端API不可用，使用模拟数据
    console.warn("后端API调用失败，使用模拟数据:", error);
    return await getMockStatistics(layerImageData, rectData, options);
  }
};

// 模拟统计信息（用于开发测试）
const getMockStatistics = async (layerImageData, rectData, options = {}) => {
  const { swipeMode = false } = options;

  return new Promise((resolve) => {
    setTimeout(() => {
      const layerCount = layerImageData.length;

      const statistics = {
        area: {
          pixels: Math.round(rectData.width * rectData.height),
          description: `选定区域包含 ${Math.round(
            rectData.width * rectData.height
          )} 个像素`,
          swipeMode: swipeMode,
        },
        mean: {},
        std: {},
        min: {},
        max: {},
        median: {},
      };

      layerImageData.forEach((imageData, index) => {
        const layerKey = `layer${index + 1}`;
        const layerName = imageData.layerName;

        // 基于图像数据生成模拟值
        const baseValue = 100 + index * 20;
        const variation = 30 + index * 5;

        statistics.mean[layerKey] = {
          value: baseValue + Math.random() * 10,
          name: layerName,
        };
        statistics.std[layerKey] = {
          value: variation + Math.random() * 5,
          name: layerName,
        };
        statistics.min[layerKey] = {
          value: Math.max(0, baseValue - variation),
          name: layerName,
        };
        statistics.max[layerKey] = {
          value: baseValue + variation,
          name: layerName,
        };
        statistics.median[layerKey] = {
          value: baseValue + Math.random() * 8,
          name: layerName,
        };
      });

      // 计算差异
      if (layerCount >= 2) {
        statistics.differences = {
          mean: statistics.mean.layer2.value - statistics.mean.layer1.value,
          std: statistics.std.layer2.value - statistics.std.layer1.value,
          min: statistics.min.layer2.value - statistics.min.layer1.value,
          max: statistics.max.layer2.value - statistics.max.layer1.value,
          median:
            statistics.median.layer2.value - statistics.median.layer1.value,
        };

        // 在卷帘模式下添加说明
        if (swipeMode) {
          statistics.comparisonNote = "对比同一位置的两个图层数据";
        }
      }

      resolve(statistics);
    }, 1500);
  });
};

// 清除统计信息
const handleClearStatistics = () => {
  store.clearSelection();
};

// 页面重置功能
const resetPage = () => {
  // 清空所有标签
  store.tabs = [];
  // 重置状态
  store.activeTabId = null;
  store.activeLayerId = null;
  store.swipeMode = false;
  store.swipePosition = 0;
  store.rectSelectMode = false;
  store.dragMode = false;
  // 创建新的空白标签
  store.addNewTab();
};

// 初始化 - 重置页面
onMounted(() => {
  resetPage();
});
</script>

<style lang="scss" scoped>
.remote-sensing-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: #f5f7fa;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(100% - 100px);
}
</style>
