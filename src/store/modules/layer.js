// src/stores/layers.js
// ---------------------------
// 图层管理 Pinia Store（纯 Pinia 写法）
// ---------------------------
// 功能：添加 / 删除 / 复制 / 更新 / 撤销预处理 / 缩放 / 卷帘对比控制
// 使用场景：Electron + Vue 3 + Element Plus 项目
// ---------------------------

import { defineStore } from "pinia";
import { copyImageData } from "@/utils/imageProcessing";

export const useLayerStore = defineStore("layers", {
  // --------------------------------
  // 🔹 state：定义所有状态
  // --------------------------------
  state: () => ({
    layers: [], // 图层列表
    activeLayerId: null, // 当前激活图层
    containerScale: 1, // 当前缩放比例
    containerOffset: { x: 0, y: 0 }, // 拖动偏移量
    compareSplit: 0.5, // 卷帘对比比例
  }),

  // --------------------------------
  // 🔹 getters：派生数据（可选）
  // --------------------------------
  getters: {
    activeLayer(state) {
      return state.layers.find((l) => l.id === state.activeLayerId);
    },
    layerCount(state) {
      return state.layers.length;
    },
  },

  // --------------------------------
  // 🔹 actions：操作逻辑
  // --------------------------------
  actions: {
    // 添加图层
    addLayer(layer) {
      this.layers.push(layer);
      this.activeLayerId = layer.id;
    },

    // 删除图层
    removeLayer(id) {
      this.layers = this.layers.filter((l) => l.id !== id);
      if (this.activeLayerId === id) {
        this.activeLayerId = this.layers.length ? this.layers[0].id : null;
      }
    },

    // 设置激活图层
    setActiveLayer(id) {
      this.activeLayerId = id;
    },

    // 更新图层属性（部分更新）
    updateLayer(id, patch) {
      const layer = this.layers.find((l) => l.id === id);
      if (layer) Object.assign(layer, patch);
    },

    // 复制图层（安全版）
    duplicateLayer(id) {
      const src = this.layers.find((l) => l.id === id);
      if (!src) return;

      const newImg = new Image();
      newImg.src = src.image?.src ?? "";

      const newLayer = {
        id: Date.now().toString(),
        name: (src.name ?? "layer") + "_copy",
        image: newImg,
        visible: src.visible ?? true,
        opacity: src.opacity ?? 1,
        width: src.width ?? src.image?.width ?? 0,
        height: src.height ?? src.image?.height ?? 0,
        transform: src.transform
          ? { ...src.transform }
          : { scale: 1, offsetX: 0, offsetY: 0 },
        history: [],
        meta: src.meta ? JSON.parse(JSON.stringify(src.meta)) : {},
      };

      if (Array.isArray(src.history)) {
        newLayer.history = src.history
          .map((item) => {
            try {
              if (item && item.data && item.width && item.height) {
                return copyImageData(item);
              }
              return JSON.parse(JSON.stringify(item));
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      }

      this.layers.push(newLayer);
      this.activeLayerId = newLayer.id;
    },

    // 撤销上一步预处理
    undoLastOperation(id) {
      const layer = this.layers.find((l) => l.id === id);
      if (!layer || layer.history.length === 0) return;
      const prev = layer.history.pop();

      const canvas = document.createElement("canvas");
      canvas.width = prev.width;
      canvas.height = prev.height;
      const ctx = canvas.getContext("2d");
      ctx.putImageData(prev, 0, 0);
      layer.image.src = canvas.toDataURL();
    },

    // 缩放控制
    setScale(scale) {
      this.containerScale = scale;
    },

    // 拖动偏移
    setOffset(x, y) {
      this.containerOffset = { x, y };
    },

    // 卷帘对比位置
    setCompareSplit(value) {
      this.compareSplit = Math.min(1, Math.max(0, value));
    },
  },
});
