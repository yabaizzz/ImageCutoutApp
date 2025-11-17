import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";

export const useLayerStore = defineStore("remoteSensing", {
  state: () => ({
    tabs: [],
    activeTabId: null,
    activeLayerId: null,
    swipeMode: false,
    swipePosition: 50,
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
  },

  actions: {
    // 更新指定 tab 和 layer 的 src
    updateLayerSrc(tabId, layerId, newSrc) {
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

    // 图层处理
    applyPreprocessing(layerId, processedData) {
      if (!this.currentTab) return;

      const layer = this.currentTab.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.processed = true;
        layer.processedData = processedData;
      }
    },

    undoPreprocessing(layerId) {
      if (!this.currentTab) return;

      const layer = this.currentTab.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.processed = false;
      }
    },
  },
});
