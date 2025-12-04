<template>
  <div class="image-cutout-component">
    <!-- 控制按钮区 -->
    <div class="cutout-controls">
      <button @click="startDrawing" :disabled="!imageUrl || isDrawing">
        开始绘制切块
      </button>
      <button @click="finishDrawing" :disabled="!isDrawing">完成切块</button>
      <button @click="cancelDrawing" :disabled="!isDrawing">取消绘制</button>
      <button @click="exportPixels" :disabled="!cutouts.length">
        导出切块数据
      </button>
      <button @click="clearCutouts" :disabled="!cutouts.length">
        清除所有切块
      </button>
      <label class="keep-original-switch">
        <input
          type="checkbox"
          v-model="keepOriginalArea"
          @change="redrawCanvas"
        />
        原区域留白
      </label>
    </div>

    <!-- 画布区域 -->
    <div class="canvas-wrapper">
      <div
        class="canvas-container"
        :style="{ width: `${canvasSize}px`, height: `${canvasSize}px` }"
      >
        <canvas
          ref="mainCanvas"
          class="main-canvas"
          :width="canvasSize"
          :height="canvasSize"
        ></canvas>
        <canvas
          ref="overlayCanvas"
          class="overlay-canvas"
          :width="canvasSize"
          :height="canvasSize"
          @mousedown="onPointerDown"
          @mousemove="onPointerMove"
          @mouseup="onPointerUp"
          @mouseleave="onPointerLeave"
          @touchstart.prevent="onPointerDown"
          @touchmove.prevent="onPointerMove"
          @touchend.prevent="onPointerUp"
          @touchcancel.prevent="onPointerLeave"
        ></canvas>
      </div>
    </div>

    <!-- 切块列表 -->
    <div class="cutout-list" v-if="cutouts.length">
      <h4>切块列表</h4>
      <ul>
        <li
          v-for="(cutout, idx) in cutouts"
          :key="cutout.id"
          :class="{ selected: selectedCutout === idx }"
          @click="selectCutout(idx)"
        >
          <span>
            #{{ idx + 1 }} | 顶点: {{ cutout.points.length }} | 面积:
            {{ calcArea(cutout) }}px²
          </span>
          <button @click.stop="removeCutout(idx)">删除</button>
        </li>
      </ul>
    </div>

    <!-- 图层控制面板 -->
    <div class="layer-control" v-if="cutouts.length && showLayers">
      <h4>图层控制</h4>
      <div class="layer-list">
        <div
          class="layer-item"
          v-for="(cutout, idx) in cutouts"
          :key="cutout.id"
          :class="{ selected: selectedCutout === idx }"
        >
          <el-checkbox v-model="cutout.visible" @change="redrawCanvas">
            切块 {{ idx + 1 }}
          </el-checkbox>
          <el-slider
            v-model="cutout.opacity"
            min="0"
            max="100"
            @change="redrawCanvas"
            style="width: 60%"
          />
          <span>{{ cutout.opacity }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
} from "vue";
import { ElCheckbox, ElSlider } from "element-plus";

// 组件属性
const props = defineProps({
  // 待处理的图像URL
  imageUrl: {
    type: String,
    default: "",
  },
  // 画布最小尺寸（默认500px）
  minCanvasSize: {
    type: Number,
    default: 500,
  },
  // 画布最大尺寸
  maxCanvasSize: {
    type: Number,
    default: 1200,
  },
  // 是否显示图层控制面板
  showLayers: {
    type: Boolean,
    default: true,
  },
});

// 组件事件
  const emit = defineEmits([
    "cutoutChange", // 切块数据变化时触发
    "exportData", // 导出数据时触发
    "saveImage", // 保存含切块图像时触发
  ]);

// ====== 核心状态 ======
// 图像对象
const processedImage = ref(null);
// 画布相关
const mainCanvas = ref(null);
const overlayCanvas = ref(null);
const ctxMain = ref(null);
const ctxOverlay = ref(null);
const CLOSE_THRESHOLD = 10;

// 画布尺寸（响应式）
const canvasSize = computed(() => {
  if (!mainCanvas.value) return props.minCanvasSize;
  const availableWidth = window.innerWidth - 400; // 减去侧边栏宽度
  return Math.max(
    props.minCanvasSize,
    Math.min(availableWidth, props.maxCanvasSize)
  );
});

// 切块状态
const cutouts = reactive([]);
const isDrawing = ref(false);
const currentPoints = ref([]);
const selectedCutout = ref(-1);
const keepOriginalArea = ref(false);
const mouseInCanvas = ref(false);

// 临时变量
let cutoutIdCounter = 1;
let dragging = false,
  dragStart = null,
  dragType = null,
  dragVertexIndex = -1;

// ====== 生命周期 ======
onMounted(() => {
  window.addEventListener("resize", handleResize);
  nextTick(() => {
    initCanvasContext();
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

// 监听传入的图像URL变化
watch(
  () => props.imageUrl,
  (newUrl) => {
    if (newUrl) {
      loadImage(newUrl);
    } else {
      // 清空画布和切块
      cutouts.length = 0;
      selectedCutout.value = -1;
      if (ctxMain.value) {
        ctxMain.value.clearRect(0, 0, canvasSize.value, canvasSize.value);
      }
      if (ctxOverlay.value) {
        ctxOverlay.value.clearRect(0, 0, canvasSize.value, canvasSize.value);
      }
    }
  }
);

// 监听画布尺寸变化
watch(canvasSize, (newSize, oldSize) => {
  if (Math.abs(newSize - oldSize) > 10) {
    handleResize();
  }
});

// ====== 初始化方法 ======
// 初始化画布上下文
function initCanvasContext() {
  if (mainCanvas.value && overlayCanvas.value) {
    ctxMain.value = mainCanvas.value.getContext("2d");
    ctxOverlay.value = overlayCanvas.value.getContext("2d");
    // 初始化尺寸
    mainCanvas.value.width = canvasSize.value;
    mainCanvas.value.height = canvasSize.value;
    overlayCanvas.value.width = canvasSize.value;
    overlayCanvas.value.height = canvasSize.value;
  }
}

// 加载图像
function loadImage(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    processedImage.value = img;
    initCanvas();
    // 清空之前的切块
    cutouts.length = 0;
    selectedCutout.value = -1;
  };
  img.onerror = (err) => {
    console.error("图像加载失败:", err);
  };
  img.src = url;
}

// 初始化画布
function initCanvas() {
  if (!ctxMain.value || !ctxOverlay.value || !processedImage.value) return;

  // 设置画布尺寸
  mainCanvas.value.width = canvasSize.value;
  mainCanvas.value.height = canvasSize.value;
  overlayCanvas.value.width = canvasSize.value;
  overlayCanvas.value.height = canvasSize.value;

  redrawCanvas();
}

// ====== 画布绘制 ======
// 重绘画布
function redrawCanvas() {
  if (!ctxMain.value || !ctxOverlay.value || !processedImage.value) return;

  // 清空画布
  ctxMain.value.clearRect(0, 0, canvasSize.value, canvasSize.value);
  ctxOverlay.value.clearRect(0, 0, canvasSize.value, canvasSize.value);

  // 绘制图像（等比例居中）
  const drawInfo = drawScaledImage(ctxMain.value, processedImage.value);

  // 绘制切块
  cutouts.forEach((cutout, idx) => {
    if (!cutout.visible) return;

    // 更新切块画布
    if (cutout.canvas.width !== canvasSize.value) {
      updateCutoutCanvas(cutout, drawInfo);
    }

    // 绘制原区域留白
    if (keepOriginalArea.value && (cutout.offset[0] || cutout.offset[1])) {
      ctxMain.value.save();
      ctxMain.value.fillStyle = "white";
      ctxMain.value.beginPath();
      cutout.points.forEach(([x, y], i) =>
        i === 0 ? ctxMain.value.moveTo(x, y) : ctxMain.value.lineTo(x, y)
      );
      ctxMain.value.closePath();
      ctxMain.value.fill();
      ctxMain.value.restore();
    }

    // 绘制切块内容（应用透明度）
    ctxMain.value.save();
    ctxMain.value.globalAlpha = cutout.opacity / 100;
    ctxMain.value.drawImage(cutout.canvas, cutout.offset[0], cutout.offset[1]);
    ctxMain.value.restore();

    // 绘制轮廓
    const pts = cutout.points.map((p) => [
      p[0] + cutout.offset[0],
      p[1] + cutout.offset[1],
    ]);
    ctxOverlay.value.beginPath();
    pts.forEach(([x, y], i) =>
      i === 0 ? ctxOverlay.value.moveTo(x, y) : ctxOverlay.value.lineTo(x, y)
    );
    ctxOverlay.value.closePath();
    ctxOverlay.value.lineWidth = selectedCutout.value === idx ? 3 : 1.5;
    ctxOverlay.value.strokeStyle =
      selectedCutout.value === idx ? "cyan" : "yellow";
    ctxOverlay.value.stroke();
  });

  // 绘制临时多边形
  if (isDrawing.value && currentPoints.value.length && mouseInCanvas.value) {
    ctxOverlay.value.beginPath();
    currentPoints.value.forEach(([x, y], i) =>
      i === 0 ? ctxOverlay.value.moveTo(x, y) : ctxOverlay.value.lineTo(x, y)
    );
    ctxOverlay.value.strokeStyle = "red";
    ctxOverlay.value.lineWidth = 2;
    ctxOverlay.value.stroke();
  }

  // 触发数据变化事件
  emit("cutoutChange", [...cutouts]);
}

// 等比例绘制图像
function drawScaledImage(ctx, image) {
  const scale = Math.min(
    canvasSize.value / image.width,
    canvasSize.value / image.height
  );
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const x = (canvasSize.value - scaledWidth) / 2;
  const y = (canvasSize.value - scaledHeight) / 2;

  // 白色背景
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasSize.value, canvasSize.value);

  // 绘制图像
  ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

  return { x, y, scale };
}

// 更新切块画布
function updateCutoutCanvas(cutout, drawInfo) {
  cutout.canvas.width = canvasSize.value;
  cutout.canvas.height = canvasSize.value;
  const ctx = cutout.canvas.getContext("2d");
  const info = drawInfo || drawScaledImage(ctx, processedImage.value);

  // 裁剪出切块区域
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  cutout.points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  );
  ctx.closePath();
  ctx.fill();
}

// ====== 切块操作 ======
function startDrawing() {
  isDrawing.value = true;
  currentPoints.value = [];
  mouseInCanvas.value = true;
}

function finishDrawing() {
  if (!isDrawing.value || currentPoints.value.length < 3) return;

  const cutout = {
    id: cutoutIdCounter++,
    points: [...currentPoints.value],
    offset: [0, 0],
    canvas: document.createElement("canvas"),
    visible: true,
    opacity: 100,
  };

  updateCutoutCanvas(cutout);
  cutouts.push(cutout);

  isDrawing.value = false;
  currentPoints.value = [];
  redrawCanvas();
}

function cancelDrawing() {
  isDrawing.value = false;
  currentPoints.value = [];
  redrawCanvas();
}

function removeCutout(idx) {
  if (idx >= 0 && idx < cutouts.length) {
    cutouts.splice(idx, 1);
    if (selectedCutout.value === idx) selectedCutout.value = -1;
    redrawCanvas();
  }
}

function selectCutout(idx) {
  selectedCutout.value = idx;
  redrawCanvas();
}

function clearCutouts() {
  cutouts.length = 0;
  selectedCutout.value = -1;
  redrawCanvas();
}

function exportPixels() {
  const data = cutouts.map((cutout, idx) => ({
    id: cutout.id,
    points: cutout.points,
    offset: cutout.offset,
    area: calcArea(cutout),
    visible: cutout.visible,
    opacity: cutout.opacity,
  }));
  emit("exportData", data);
}

// 保存含切块的图像
function saveCutoutImage() {
  if (!processedImage.value) return;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvasSize.value;
  tempCanvas.height = canvasSize.value;
  const tempCtx = tempCanvas.getContext("2d");

  // 绘制处理后图像
  drawScaledImage(tempCtx, processedImage.value);

  // 绘制切块
  cutouts.forEach((cutout) => {
    if (!cutout.visible) return;
    if (keepOriginalArea.value && (cutout.offset[0] || cutout.offset[1])) {
      tempCtx.save();
      tempCtx.fillStyle = "white";
      tempCtx.beginPath();
      cutout.points.forEach(([x, y], i) =>
        i === 0 ? tempCtx.moveTo(x, y) : tempCtx.lineTo(x, y)
      );
      tempCtx.closePath();
      tempCtx.fill();
      tempCtx.restore();
    }
    tempCtx.save();
    tempCtx.globalAlpha = cutout.opacity / 100;
    tempCtx.drawImage(cutout.canvas, cutout.offset[0], cutout.offset[1]);
    tempCtx.restore();
  });

  tempCanvas.toBlob((blob) => {
    emit("saveImage", blob);
  });
}

// ====== 工具函数 ======
function calcArea(cutout) {
  let area = 0;
  for (let i = 0, n = cutout.points.length; i < n; i++) {
    const j = (i + 1) % n;
    area +=
      cutout.points[i][0] * cutout.points[j][1] -
      cutout.points[j][0] * cutout.points[i][1];
  }
  return Math.abs(area / 2).toFixed(1);
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getCanvasCoordinates(event) {
  if (!overlayCanvas.value) return [0, 0];
  const rect = overlayCanvas.value.getBoundingClientRect();
  const isTouch = event.type.includes("touch");
  const clientX = isTouch ? event.touches[0].clientX : event.clientX;
  const clientY = isTouch ? event.touches[0].clientY : event.clientY;

  const x = ((clientX - rect.left) * canvasSize.value) / rect.width;
  const y = ((clientY - rect.top) * canvasSize.value) / rect.height;
  return [x, y];
}

// 窗口大小调整（带防抖）
const handleResize = debounce(() => {
  if (!processedImage.value || !mainCanvas.value || !overlayCanvas.value)
    return;

  try {
    const newSize = canvasSize.value;
    mainCanvas.value.width = newSize;
    mainCanvas.value.height = newSize;
    overlayCanvas.value.width = newSize;
    overlayCanvas.value.height = newSize;

    cutouts.forEach((cutout) => {
      updateCutoutCanvas(cutout);
    });

    redrawCanvas();
  } catch (error) {
    console.error("窗口调整错误:", error);
  }
}, 100);

// 防抖函数
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// ====== 事件处理 ======
function onPointerDown(event) {
  if (!overlayCanvas.value || !processedImage.value) return;
  const [x, y] = getCanvasCoordinates(event);
  mouseInCanvas.value = true;

  if (isDrawing.value) {
    if (currentPoints.value.length >= 3) {
      const [startX, startY] = currentPoints.value[0];
      const dist = Math.hypot(x - startX, y - startY);
      if (dist <= CLOSE_THRESHOLD) {
        finishDrawing();
        return;
      }
    }
    currentPoints.value.push([x, y]);
    redrawCanvas();
    return;
  }

  for (let i = 0; i < cutouts.length; i++) {
    const cutout = cutouts[i];
    if (!cutout.visible) continue;

    const pts = cutout.points.map((p) => [
      p[0] + cutout.offset[0],
      p[1] + cutout.offset[1],
    ]);

    // 顶点拖拽检测
    for (let j = 0; j < pts.length; j++) {
      const [vx, vy] = pts[j];
      if (Math.abs(x - vx) < 10 && Math.abs(y - vy) < 10) {
        dragging = true;
        dragType = "vertex";
        selectedCutout.value = i;
        dragVertexIndex = j;
        dragStart = [x, y];
        return;
      }
    }

    // 切块拖拽检测
    if (pointInPolygon(x, y, pts)) {
      dragging = true;
      dragType = "cutout";
      selectedCutout.value = i;
      dragStart = [x, y];
      return;
    }
  }
}

function onPointerMove(event) {
  if (!overlayCanvas.value || !processedImage.value) return;
  const [x, y] = getCanvasCoordinates(event);
  mouseInCanvas.value = true;

  if (isDrawing.value && currentPoints.value.length > 0) {
    redrawCanvas();
    const [lastX, lastY] = currentPoints.value[currentPoints.value.length - 1];
    ctxOverlay.value.beginPath();
    ctxOverlay.value.moveTo(lastX, lastY);
    ctxOverlay.value.lineTo(x, y);
    ctxOverlay.value.strokeStyle = "red";
    ctxOverlay.value.lineWidth = 2;
    ctxOverlay.value.stroke();
  } else if (dragging && dragStart && selectedCutout.value >= 0) {
    const [dx, dy] = [x - dragStart[0], y - dragStart[1]];
    const cutout = cutouts[selectedCutout.value];

    if (dragType === "vertex") {
      cutout.points[dragVertexIndex][0] += dx;
      cutout.points[dragVertexIndex][1] += dy;
      updateCutoutCanvas(cutout);
    } else if (dragType === "cutout") {
      cutout.offset[0] += dx;
      cutout.offset[1] += dy;
    }

    dragStart = [x, y];
    redrawCanvas();
  }
}

function onPointerUp() {
  dragging = false;
  dragStart = null;
  dragType = null;
  dragVertexIndex = -1;
}

function onPointerLeave() {
  mouseInCanvas.value = false;
  if (isDrawing.value) redrawCanvas();
}

// 暴露方法给父组件
defineExpose({
  saveCutoutImage,
});
</script>

<style lang="scss" scoped>
.image-cutout-component {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: scroll;

  .cutout-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 5px 0;

    button {
      cursor: pointer;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      background: #3498db;
      color: white;
      font-size: 13px;
      transition: 0.2s;

      &:hover:not(:disabled) {
        background: #217dbb;
      }
      &:disabled {
        background: #bdc3c7;
        cursor: not-allowed;
      }
    }

    .keep-original-switch {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      margin-left: auto;
    }
  }

  .canvas-wrapper {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    overflow: auto;

    .canvas-container {
      position: relative;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: #f9f9f9;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .main-canvas,
    .overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
    }

    .main-canvas {
      z-index: 1;
    }

    .overlay-canvas {
      z-index: 2;
      cursor: crosshair;
    }
  }

  .cutout-list {
    padding: 10px;
    border-top: 1px solid #eee;
    max-height: 150px;
    overflow-y: auto;

    h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #555;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 4px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        font-size: 13px;

        &:last-child {
          border-bottom: none;
        }

        &.selected {
          background: #e6f7ff;
          border-radius: 4px;
        }

        button {
          background: #f56c6c;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 12px;

          &:hover {
            background: #e45151;
          }
        }
      }
    }
  }

  .layer-control {
    padding: 10px;
    border-top: 1px solid #eee;

    h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #555;
    }

    .layer-list {
      .layer-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid #eee;

        &:last-child {
          border-bottom: none;
        }

        &.selected {
          background: #f0f7ff;
          padding-left: 4px;
          border-radius: 4px;
        }

        span {
          font-size: 12px;
          width: 40px;
        }
      }
    }
  }
}
</style>
