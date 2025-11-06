<template>
  <div class="layer-canvas-container" ref="container" @wheel="handleWheel">
    <canvas ref="canvas"></canvas>
    <canvas ref="overlayCanvas" class="overlay"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useLayerStore } from "@/store/index.js";

const container = ref(null);
const canvas = ref(null);
const overlayCanvas = ref(null);
const layerStore = useLayerStore();

// 动态设置Canvas尺寸为容器大小
function setCanvasSize() {
  if (!container.value || !canvas.value) return;
  const { clientWidth, clientHeight } = container.value;

  // 设置Canvas实际像素尺寸（关键：与容器可视区域一致）
  canvas.value.width = clientWidth;
  canvas.value.height = clientHeight;
  overlayCanvas.value.width = clientWidth;
  overlayCanvas.value.height = clientHeight;

  // 重置缩放原点（左上角）
  canvas.value.style.transformOrigin = "0 0";
  overlayCanvas.value.style.transformOrigin = "0 0";

  // 重绘图层（基于新尺寸）
  drawLayers();
}

// 绘制图层逻辑（适配动态尺寸）
function drawLayers() {
  const ctx = canvas.value.getContext("2d");
  const { width, height } = canvas.value; // 使用动态尺寸
  ctx.clearRect(0, 0, width, height);

  const splitX = layerStore.compareSplit * width; // 基于容器宽度计算卷帘位置

  layerStore.layers.forEach((layer) => {
    if (!layer.visible) return;
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;

    // 卷帘对比区域适配容器高度
    if (layerStore.layers.indexOf(layer) === 1) {
      ctx.beginPath();
      ctx.rect(0, 0, splitX, height);
      ctx.clip();
    }

    // 等比例绘制图像（避免拉伸）
    if (layer.image) {
      ctx.drawImage(layer.image, 0, 0, width, height);
    }
    ctx.restore();
  });
}

// 监听缩放变化，自动更新Canvas样式（核心修改）
watch(
  () => layerStore.containerScale,
  (newScale) => {
    canvas.value.style.transform = `scale(${newScale})`;
    overlayCanvas.value.style.transform = `scale(${newScale})`;
  }
);

// 鼠标滚轮缩放逻辑（仅修改缩放值，样式由watch处理）
function handleWheel(e) {
  e.preventDefault();
  // 调整缩放值并限制范围
  layerStore.containerScale += e.deltaY > 0 ? -0.1 : 0.1;
  layerStore.containerScale = Math.min(
    Math.max(layerStore.containerScale, 0.1),
    5
  );
}

// 初始化与监听
onMounted(() => {
  // 初始化尺寸
  setCanvasSize();
  // 监听窗口大小变化（容器尺寸改变时触发）
  window.addEventListener("resize", setCanvasSize);
  // 监听图层变化重绘
  watch(() => layerStore.layers, drawLayers, { deep: true });
  watch(() => layerStore.compareSplit, drawLayers);
});

onUnmounted(() => {
  window.removeEventListener("resize", setCanvasSize);
});
</script>

<style scoped>
.layer-canvas-container {
  position: relative;
  overflow: hidden; /* 隐藏超出容器的内容，避免滚动条 */
  border: 1px solid #ccc;
  width: 100%; /* 占满父容器宽度 */
  height: 80vh; /* 可根据需求调整高度 */
}
canvas.overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
