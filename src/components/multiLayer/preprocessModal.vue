<template>
  <el-dialog v-model="visible" title="图层预处理">
    <el-button @click="applyGray">灰度</el-button>
    <el-button @click="applyThreshold">二值化</el-button>
    <el-button @click="undo">撤销</el-button>
  </el-dialog>
</template>

<script setup>
import { ref } from "vue";
import { useLayerStore } from "@/store";
import { toGrayScale, threshold, copyImageData } from "@/utils/imageProcessing";

const visible = ref(false);
const layerStore = useLayerStore();

function open() {
  visible.value = true;
}
function close() {
  visible.value = false;
}

function applyGray() {
  const layer = layerStore.layers.find(
    (l) => l.id === layerStore.activeLayerId
  );
  if (!layer) return;
  const canvas = document.createElement("canvas");
  canvas.width = layer.image.width;
  canvas.height = layer.image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(layer.image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  layer.history.push(copyImageData(data));
  ctx.putImageData(toGrayScale(data), 0, 0);
  layer.image.src = canvas.toDataURL();
}

function applyThreshold() {
  const layer = layerStore.layers.find(
    (l) => l.id === layerStore.activeLayerId
  );
  if (!layer) return;
  const canvas = document.createElement("canvas");
  canvas.width = layer.image.width;
  canvas.height = layer.image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(layer.image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  layer.history.push(copyImageData(data));
  ctx.putImageData(threshold(data), 0, 0);
  layer.image.src = canvas.toDataURL();
}

function undo() {
  const layer = layerStore.layers.find(
    (l) => l.id === layerStore.activeLayerId
  );
  if (!layer || layer.history.length === 0) return;
  const prev = layer.history.pop();
  const canvas = document.createElement("canvas");
  canvas.width = prev.width;
  canvas.height = prev.height;
  const ctx = canvas.getContext("2d");
  ctx.putImageData(prev, 0, 0);
  layer.image.src = canvas.toDataURL();
}

defineExpose({ open }); // 👈 暴露 open 方法给父组件调用
</script>
