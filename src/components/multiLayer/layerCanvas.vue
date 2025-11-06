<template>
  <div class="layer-canvas-container" ref="container" @wheel="handleWheel">
    <canvas ref="canvas" :width="width" :height="height"></canvas>
    <!-- 多边形选区 overlay -->
    <canvas
      ref="overlayCanvas"
      :width="width"
      :height="height"
      class="overlay"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useLayerStore } from "@/store/index.js";

const container = ref(null);
const canvas = ref(null);
const overlayCanvas = ref(null);
const width = 800;
const height = 600;

const layerStore = useLayerStore();

function drawLayers() {
  const ctx = canvas.value.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  const splitX = layerStore.compareSplit * width;

  layerStore.layers.forEach((layer) => {
    if (!layer.visible) return;
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layerStore.layers.indexOf(layer) === 1) {
      // 卷帘对比
      ctx.beginPath();
      ctx.rect(0, 0, splitX, height);
      ctx.clip();
    }
    ctx.drawImage(layer.image, 0, 0, width, height);
    ctx.restore();
  });
}

onMounted(() => {
  drawLayers();
});

watch(() => layerStore.layers, drawLayers, { deep: true });
watch(() => layerStore.compareSplit, drawLayers);

function handleWheel(e) {
  e.preventDefault();
  const scale = layerStore.containerScale;
  layerStore.containerScale += e.deltaY > 0 ? -0.1 : 0.1;
  if (layerStore.containerScale < 0.1) layerStore.containerScale = 0.1;
  if (layerStore.containerScale > 5) layerStore.containerScale = 5;
  canvas.value.style.transform = `scale(${layerStore.containerScale})`;
  overlayCanvas.value.style.transform = `scale(${layerStore.containerScale})`;
}
</script>

<style scoped>
.layer-canvas-container {
  position: relative;
  overflow: auto;
  border: 1px solid #ccc;
}
canvas.overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
