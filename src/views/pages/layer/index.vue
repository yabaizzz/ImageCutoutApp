<template>
  <div class="remote-sensing-app">
    <Toolbar
      :tabs="tabs"
      :active-tab-id="activeTabId"
      :swipe-mode="swipeMode"
      :current-zoom="currentZoom"
      @add-tab="handleAddTab"
      @remove-tab="handleRemoveTab"
      @switch-tab="handleSwitchTab"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @set-zoom="handleSetZoom"
      @reset-view="handleResetView"
      @toggle-swipe="handleToggleSwipe"
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
        @update-pan="handleUpdatePan"
        @set-swipe-position="handleSetSwipePosition"
        @apply-preprocessing="handleApplyPreprocessing"
        @undo-preprocessing="handleUndoPreprocessing"
        @toggle-swipe="handleToggleSwipe"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
      />

      <InfoPanel
        :current-layer="currentLayer"
        @apply-preprocessing="handleApplyPreprocessing"
        @undo-preprocessing="handleUndoPreprocessing"
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

const store = useLayerStore();
const store2 = useCommonStore();

const dialogVisible = ref(false);
const defaultParams = ref({ ...store2?.defaultParams });
const algorithms = ref([...store2?.algorithms]);
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
};

const handleToggleSwipe = () => {
  store.toggleSwipeMode();
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

// 移除拖动相关的处理
const handleUpdatePan = () => {
  // 不再支持拖动
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
  // console.log("打开图层设置:", layerId);
  console.log("layerIdlayerIdlayerId", typeof layerId);
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

// 页面重置功能
const resetPage = () => {
  // 清空所有标签
  store.tabs = [];
  // 重置状态
  store.activeTabId = null;
  store.activeLayerId = null;
  store.swipeMode = false;
  store.swipePosition = 0;
  // 创建新的空白标签
  store.addNewTab();
};

// 初始化 - 重置页面
onMounted(() => {
  resetPage();
  // dialogVisible.value = true;
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
