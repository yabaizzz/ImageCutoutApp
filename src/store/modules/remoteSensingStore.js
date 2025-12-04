import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";

export const useLayerStore = defineStore("remoteSensing", {
  state: () => ({
    tabs: [],
    activeTabId: null,
    activeLayerId: null,
    swipeMode: false,
    swipePosition: 50,
    // 更新为矩形选择相关状态
    rectSelectMode: false,
    selectedRect: null,
    statisticsData: null,
    // 新增：记录当前卷帘分割线位置对应的图层
    swipeLayers: [], // [左侧图层, 右侧图层]
    // 新增拖动相关状态
    dragMode: false,
    isDragging: false,
  }),

  getters: {
    currentTab(state) {
      return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
    },

    currentLayer(state) {
      if (!this.currentTab || !state.activeLayerId) return null;
      return (
        this.currentTab.layers.find(
          (layer) => layer.id === state.activeLayerId
        ) || null
      );
    },

    currentStatistics(state) {
      return state.statisticsData;
    },
  },

  actions: {
    // 更新指定 tab 和 layer 的 src
    updateLayerSrc(tabId, layerId, newSrc) {
      console.log("newSrc", newSrc);
      const tab = this.tabs.find((t) => t.id === tabId);
      if (tab) {
        const layer = tab.layers.find((l) => l.id === layerId);
        if (layer) {
          layer.src = newSrc;
        }
      }
    },

    // 标签管理
    addNewTab() {
      const newTab = {
        id: uuidv4(),
        name: `会话 ${this.tabs.length + 1}`,
        layers: [],
        zoom: 1,
        pan: { x: 0, y: 0 },
        imageWidth: 0,
        imageHeight: 0,
      };

      this.tabs.push(newTab);
      this.activeTabId = newTab.id;
      return newTab;
    },

    removeTab(tabId) {
      const tabIndex = this.tabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) return;

      this.tabs.splice(tabIndex, 1);

      if (this.activeTabId === tabId) {
        if (this.tabs.length > 0) {
          this.activeTabId = this.tabs[0].id;
        } else {
          this.addNewTab();
        }
      }
    },

    switchTab(tabId) {
      this.activeTabId = tabId;
    },

    // 图层管理
    addLayer(imageData) {
      if (!this.currentTab) {
        this.addNewTab();
      }

      const newLayer = {
        id: uuidv4(),
        name: imageData.name || `图层 ${this.currentTab.layers.length + 1}`,
        src: imageData.src,
        width: imageData.width,
        height: imageData.height,
        imageId: imageData.imageId,
        visible: true,
        processed: false,
        originalData: null,
        processedData: null,
      };

      this.currentTab.layers.push(newLayer);
      this.activeLayerId = newLayer.id;

      // 更新标签的图像尺寸
      this.currentTab.imageWidth = imageData.width;
      this.currentTab.imageHeight = imageData.height;

      return newLayer;
    },

    duplicateLayer(layerId) {
      if (!this.currentTab) return null;

      const originalLayer = this.currentTab.layers.find(
        (l) => l.id === layerId
      );
      if (!originalLayer) return null;

      const newLayer = {
        ...JSON.parse(JSON.stringify(originalLayer)),
        id: uuidv4(),
        name: `${originalLayer.name} (副本)`,
        originalData: null,
        processedData: null,
      };

      this.currentTab.layers.push(newLayer);
      this.activeLayerId = newLayer.id;
      return newLayer;
    },

    removeLayer(layerId) {
      if (!this.currentTab) return;

      const layerIndex = this.currentTab.layers.findIndex(
        (l) => l.id === layerId
      );
      if (layerIndex === -1) return;

      this.currentTab.layers.splice(layerIndex, 1);

      if (this.activeLayerId === layerId) {
        this.activeLayerId =
          this.currentTab.layers.length > 0
            ? this.currentTab.layers[0].id
            : null;
      }
    },

    setLayerVisibility(layerId, visible) {
      if (!this.currentTab) return;

      const layer = this.currentTab.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.visible = visible;
      }
    },

    setActiveLayer(layerId) {
      this.activeLayerId = layerId;
    },

    updateLayerOrder(newLayersOrder) {
      if (!this.currentTab) return;
      this.currentTab.layers = newLayersOrder;
    },

    // 视图控制
    zoomIn() {
      if (!this.currentTab) return;
      this.currentTab.zoom = Math.min(this.currentTab.zoom * 1.2, 5);
    },

    zoomOut() {
      if (!this.currentTab) return;
      this.currentTab.zoom = Math.max(this.currentTab.zoom / 1.2, 0.1);
    },

    setZoom(zoomValue) {
      if (!this.currentTab) return;
      // 直接使用传入的zoom值，已经在Toolbar中解析过了
      const zoom = Math.max(0.1, Math.min(5, zoomValue));
      this.currentTab.zoom = zoom;
      return zoom;
    },

    resetView() {
      if (!this.currentTab) return;
      this.currentTab.zoom = 1;
      this.currentTab.pan = { x: 0, y: 0 };
      this.swipePosition = 50;
    },

    // 卷帘功能
    toggleSwipeMode() {
      this.swipeMode = !this.swipeMode;
      if (this.swipeMode) {
        // 启用卷帘时重置卷帘位置
        this.swipePosition = 50;
      }
      return this.swipeMode;
    },

    setSwipePosition(position) {
      this.swipePosition = position;
    },

    // 设置卷帘图层
    setSwipeLayers(layers) {
      this.swipeLayers = layers;
    },

    // 图层处理
    applyPreprocessing(layerId, processedData) {
      if (!this.currentTab) return;

      const layer = this.currentTab.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.processed = true;
        layer.processedData = processedData;
      }
    },

    // 修改图层信息-状态为false(即文字为:原图)
    undoPreprocessing(layerId) {
      if (!this.currentTab) return;

      const layer = this.currentTab.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.processed = false;
      }
    },

    // 修改矩形选择功能，确保与拖动模式互斥
    toggleRectSelectMode() {
      // 如果当前已经是矩形选择模式，则关闭它
      if (this.rectSelectMode) {
        this.rectSelectMode = false;
        this.selectedRect = null;
      } else {
        // 否则，先关闭拖动模式，再开启矩形选择模式
        this.dragMode = false;
        this.isDragging = false;
        this.rectSelectMode = true;
      }
      return this.rectSelectMode;
    },

    setSelectedRect(rectData) {
      this.selectedRect = rectData;
    },

    setStatisticsData(statistics) {
      this.statisticsData = statistics;
    },

    clearSelection() {
      this.selectedRect = null;
      this.statisticsData = null;
    },
    // 拖动功能
    toggleDragMode() {
      // 如果当前已经是拖动模式，则关闭它
      if (this.dragMode) {
        this.dragMode = false;
        this.isDragging = false;
      } else {
        // 否则，先关闭矩形选择模式，再开启拖动模式
        this.rectSelectMode = false;
        this.selectedRect = null;
        this.dragMode = true;
      }
      return this.dragMode;
    },

    setRectSelectMode(enabled) {
      if (enabled) {
        // 开启矩形选择模式时，关闭拖动模式
        this.dragMode = false;
        this.isDragging = false;
        this.rectSelectMode = true;
      } else {
        this.rectSelectMode = false;
        this.selectedRect = null;
      }
    },

    // 设置拖动模式（用于外部控制）
    setDragMode(enabled) {
      if (enabled) {
        // 开启拖动模式时，关闭矩形选择模式
        this.rectSelectMode = false;
        this.selectedRect = null;
        this.dragMode = true;
      } else {
        this.dragMode = false;
        this.isDragging = false;
      }
    },

    setDragState(dragging) {
      this.isDragging = dragging;
    },

    // 更新平移位置
    updatePan(tabId, panX, panY) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (tab) {
        tab.pan = { x: panX, y: panY };
      }
    },

    // 重置平移位置
    resetPan(tabId) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (tab) {
        tab.pan = { x: 0, y: 0 };
      }
    },
  },
});
