<template>
  <div class="image-cutout-container">
    <!-- 图片标签栏 -->
    <div class="image-tabs" v-if="images.length > 0">
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="image-tab"
        :class="{ active: idx === currentIndex }"
        @click="switchImage(idx)"
      >
        <span class="tab-name">{{
          getShortName(img.name || `图片${idx + 1}`)
        }}</span>
        <span class="tab-visibility" @click.stop="toggleImageVisibility(idx)">
          {{ img.visible ? "👁️" : "👁️‍🗨️" }}
        </span>
        <span class="tab-delete" @click.stop="deleteImage(idx)">🗑️</span>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="controls">
      <input type="file" accept="image/*" multiple @change="onFilesChange" />
      <button @click="startDrawing" :disabled="currentIndex === -1">
        开始绘制切块
      </button>
      <button @click="finishDrawing" :disabled="!isDrawing">完成切块</button>
      <button @click="cancelDrawing" :disabled="!isDrawing">取消绘制</button>
      <button @click="exportPixels" :disabled="!cutouts.length">
        导出像素
      </button>
      <button @click="clearCanvas" :disabled="!images.length">清空画布</button>
      <label class="keep-original-switch">
        <input type="checkbox" v-model="keepOriginalArea" /> 拖动后原区域留白
      </label>
    </div>

    <!-- canvas-grid -->
    <div class="canvas-grid">
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="canvas-wrap"
        :class="{ active: idx === currentIndex }"
        v-show="img.visible"
      >
        <canvas ref="mainCanvases" class="main-canvas"></canvas>
        <canvas
          ref="overlayCanvases"
          class="overlay-canvas"
          @mousedown="onPointerDown($event, idx)"
          @mousemove="onPointerMove($event, idx)"
          @mouseup="onPointerUp"
          @mouseleave="onPointerUp"
          @touchstart.prevent="onPointerDown($event, idx)"
          @touchmove.prevent="onPointerMove($event, idx)"
          @touchend.prevent="onPointerUp"
        ></canvas>
      </div>
    </div>

    <!-- 切块信息 -->
    <div class="info" v-if="cutouts.length">
      <p>切块数量: {{ cutouts.length }}</p>
      <ul>
        <li v-for="(c, idx) in cutouts" :key="c.id">
          #{{ idx }} | 图索引: {{ c.imageIndex }} | 顶点:
          {{ c.points.length }} | 面积: {{ calcArea(c) }}px² | 像素数:
          {{ calcPixels(c) }}
          <button @click="removeCutout(idx)">删除</button>
          <button @click="selectCutout(idx)">选中</button>
        </li>
      </ul>
    </div>
    <div style="padding-bottom: 100px"></div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from "vue";

/* ---------- 辅助函数 ---------- */
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      yi = poly[i][1];
    const xj = poly[j][0],
      yj = poly[j][1];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ---------- Canvas refs ---------- */
const mainCanvases = ref([]);
const overlayCanvases = ref([]);
const ctxMains = ref([]);
const ctxOverlays = ref([]);

/* ---------- 图片与状态 ---------- */
const images = reactive([]);
const currentIndex = ref(-1);
const keepOriginalArea = ref(false);

/* ---------- 绘制状态 ---------- */
const isDrawing = ref(false);
const currentPoints = ref([]);
const cutouts = reactive([]);
let cutoutIdCounter = 1;
const selectedCutout = ref(-1);

/* ---------- 拖拽状态 ---------- */
let dragging = false;
let dragStart = null;
let dragType = null;
let dragVertexIndex = -1;

/* ---------- 初始化 Canvas ---------- */
async function initCanvas(idx) {
  await nextTick();
  const main = mainCanvases.value[idx];
  const overlay = overlayCanvases.value[idx];
  if (!main || !overlay) return;

  const ctxMain = main.getContext("2d");
  const ctxOverlay = overlay.getContext("2d");
  ctxMains.value[idx] = ctxMain;
  ctxOverlays.value[idx] = ctxOverlay;

  main.width = overlay.width = 525;
  main.height = overlay.height = 525;

  redrawAll(idx);
}

/* ---------- 重绘指定图片 ---------- */
function redrawAll(idx) {
  const img = images[idx];
  const m = ctxMains.value[idx];
  const o = ctxOverlays.value[idx];
  if (!img || !m || !o || !img.visible) return;

  m.clearRect(0, 0, 525, 525);
  m.drawImage(img.img, 0, 0, 525, 525);

  if (keepOriginalArea.value) {
    cutouts
      .filter((c) => c.imageIndex === idx)
      .forEach((c) => {
        if (c.offset[0] !== 0 || c.offset[1] !== 0) {
          m.save();
          m.fillStyle = "white";
          m.beginPath();
          c.points.forEach(([x, y], i) =>
            i === 0 ? m.moveTo(x, y) : m.lineTo(x, y)
          );
          m.closePath();
          m.fill();
          m.restore();
        }
      });
  }

  cutouts
    .filter((c) => c.imageIndex === idx)
    .forEach((c) => {
      const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);
      m.save();
      m.globalCompositeOperation = "destination-out";
      m.beginPath();
      m.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) m.lineTo(pts[i][0], pts[i][1]);
      m.closePath();
      m.fill();
      m.restore();
    });

  cutouts
    .filter((c) => c.imageIndex === idx)
    .forEach((c) => {
      m.drawImage(c.canvas, c.offset[0], c.offset[1], 525, 525);
    });

  o.clearRect(0, 0, 525, 525);
  cutouts
    .filter((c) => c.imageIndex === idx)
    .forEach((c, ci) => {
      const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);
      o.beginPath();
      o.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) o.lineTo(pts[i][0], pts[i][1]);
      o.closePath();
      o.lineWidth = selectedCutout.value === ci ? 3 : 1.5;
      o.strokeStyle = selectedCutout.value === ci ? "cyan" : "yellow";
      o.stroke();
    });

  if (isDrawing.value && currentPoints.value.length) {
    o.beginPath();
    o.moveTo(currentPoints.value[0][0], currentPoints.value[0][1]);
    for (let i = 1; i < currentPoints.value.length; i++)
      o.lineTo(currentPoints.value[i][0], currentPoints.value[i][1]);
    o.strokeStyle = "red";
    o.lineWidth = 2;
    o.stroke();
  }
}

/* ---------- 上传图片 ---------- */
function onFilesChange(e) {
  const files = e.target.files;
  if (!files.length) return;

  Array.from(files).forEach((f) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      images.push({ url, img, name: f.name, visible: true });
      nextTick(() => initCanvas(images.length - 1));
      if (currentIndex.value === -1)
        currentIndex.value = images.findIndex((i) => i.visible);
    };
    img.src = url;
  });

  e.target.value = "";
}

/* ---------- 图片标签操作 ---------- */
function switchImage(idx) {
  currentIndex.value = idx;
}
function toggleImageVisibility(idx) {
  images[idx].visible = !images[idx].visible;
}
function deleteImage(idx) {
  cutouts
    .filter((c) => c.imageIndex === idx)
    .forEach((c) => cutouts.splice(cutouts.indexOf(c), 1));
  images.splice(idx, 1);
  mainCanvases.value.splice(idx, 1);
  overlayCanvases.value.splice(idx, 1);
  ctxMains.value.splice(idx, 1);
  ctxOverlays.value.splice(idx, 1);
  currentIndex.value = images.findIndex((i) => i.visible);
}

/* ---------- 绘制控制 ---------- */
function startDrawing() {
  isDrawing.value = true;
  currentPoints.value = [];
  selectedCutout.value = -1;
}
function finishDrawing() {
  if (!isDrawing.value || currentPoints.value.length < 3) {
    isDrawing.value = false;
    return;
  }
  const normalized = currentPoints.value.map((p) => [p[0], p[1]]);
  const cutoutCanvas = document.createElement("canvas");
  cutoutCanvas.width = 525;
  cutoutCanvas.height = 525;
  const ctx = cutoutCanvas.getContext("2d");
  ctx.save();
  ctx.beginPath();
  normalized.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  );
  ctx.closePath();
  ctx.clip();
  const img = images[currentIndex.value];
  ctx.drawImage(img.img, 0, 0, 525, 525);
  ctx.restore();
  cutouts.push({
    id: cutoutIdCounter++,
    points: normalized,
    offset: [0, 0],
    canvas: cutoutCanvas,
    imageIndex: currentIndex.value,
  });
  isDrawing.value = false;
  currentPoints.value = [];
  redrawAll(currentIndex.value);
}
function cancelDrawing() {
  isDrawing.value = false;
  currentPoints.value = [];
  redrawAll(currentIndex.value);
}
function clearCanvas() {
  cutouts
    .filter((c) => c.imageIndex === currentIndex.value)
    .forEach((c) => cutouts.splice(cutouts.indexOf(c), 1));
  currentPoints.value = [];
  selectedCutout.value = -1;
  redrawAll(currentIndex.value);
}
function removeCutout(idx) {
  cutouts.splice(idx, 1);
  selectedCutout.value = -1;
  redrawAll(currentIndex.value);
}
function selectCutout(idx) {
  selectedCutout.value = idx;
  redrawAll(currentIndex.value);
}

/* ---------- 拖拽 ---------- */
function getEventPos(e, idx) {
  const canvas = overlayCanvases.value[idx];
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return [
    ((clientX - rect.left) / rect.width) * 525,
    ((clientY - rect.top) / rect.height) * 525,
  ];
}
function onPointerDown(e, idx) {
  const [x, y] = getEventPos(e, idx);
  if (isDrawing.value) {
    currentPoints.value.push([x, y]);
    redrawAll(idx);
    return;
  }

  for (let i = 0; i < cutouts.length; i++) {
    const c = cutouts[i];
    if (c.imageIndex !== idx) continue;
    const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);
    for (let vi = 0; vi < pts.length; vi++) {
      const [vx, vy] = pts[vi];
      if ((vx - x) ** 2 + (vy - y) ** 2 < 64) {
        dragging = true;
        dragType = "vertex";
        dragVertexIndex = vi;
        dragStart = { x, y, idx: i };
        selectedCutout.value = i;
        redrawAll(idx);
        return;
      }
    }
  }

  for (let i = cutouts.length - 1; i >= 0; i--) {
    const c = cutouts[i];
    if (c.imageIndex !== idx) continue;
    const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);
    if (pointInPolygon(x, y, pts)) {
      dragging = true;
      dragType = "move";
      dragStart = { x, y, idx: i };
      selectedCutout.value = i;
      redrawAll(idx);
      return;
    }
  }

  selectedCutout.value = -1;
  redrawAll(idx);
}
function onPointerMove(e, idx) {
  if (!dragging) return;
  const [x, y] = getEventPos(e, idx);
  const dsx = x - dragStart.x,
    dsy = y - dragStart.y;
  const c = cutouts[dragStart.idx];
  if (dragType === "move") {
    c.offset[0] += dsx;
    c.offset[1] += dsy;
    dragStart.x = x;
    dragStart.y = y;
  } else if (dragType === "vertex") {
    c.points[dragVertexIndex][0] += dsx;
    c.points[dragVertexIndex][1] += dsy;
    dragStart.x = x;
    dragStart.y = y;
    const canvas = document.createElement("canvas");
    canvas.width = 525;
    canvas.height = 525;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.beginPath();
    c.points.forEach(([px, py], i) =>
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    );
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(images[c.imageIndex].img, 0, 0, 525, 525);
    ctx.restore();
    c.canvas = canvas;
  }
  redrawAll(c.imageIndex);
}
function onPointerUp() {
  dragging = false;
  dragType = null;
  dragVertexIndex = -1;
  dragStart = null;
}

/* ---------- 面积/像素 ---------- */
function calcArea(c) {
  let pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i++)
    area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(area / 2) | 0;
}
function calcPixels(c) {
  const xs = c.points.map((p) => p[0] + c.offset[0]);
  const ys = c.points.map((p) => p[1] + c.offset[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(524, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(524, Math.ceil(Math.max(...ys)));
  const w = maxX - minX + 1,
    h = maxY - minY + 1;
  const off = document.createElement("canvas");
  off.width = 525;
  off.height = 525;
  const ctx = off.getContext("2d");
  ctx.drawImage(images[c.imageIndex].img, 0, 0, 525, 525);
  ctx.save();
  ctx.beginPath();
  c.points.forEach(([x, y], i) =>
    i === 0
      ? ctx.moveTo(x + c.offset[0], y + c.offset[1])
      : ctx.lineTo(x + c.offset[0], y + c.offset[1])
  );
  ctx.closePath();
  ctx.clip();
  const id = ctx.getImageData(minX, minY, w, h);
  ctx.restore();
  let cnt = 0;
  for (let i = 0; i < id.data.length; i += 4) if (id.data[i + 3] > 0) cnt++;
  return cnt;
}

/* ---------- 导出 ---------- */
function exportPixels() {
  if (!cutouts.length) return;
  const result = cutouts.map((c) => ({
    id: c.id,
    imageIndex: c.imageIndex,
    points: c.points,
    offset: c.offset,
    pixels: calcPixels(c),
    area: calcArea(c),
  }));
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cutouts.json";
  a.click();
}

/* ---------- 工具 ---------- */
function getShortName(name) {
  if (!name) return "";
  const ext = name.lastIndexOf(".");
  const base = ext > -1 ? name.substring(0, ext) : name;
  return base.length > 6 ? base.substring(0, 6) + "..." : base;
}
</script>

<style scoped>
.image-cutout-container {
  font-family: "Segoe UI", Arial, sans-serif;
  padding: 15px;
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
  height: 100vh;
}
.image-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}
.image-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  background: #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}
.image-tab.active {
  background: #3498db;
  color: white;
  font-weight: 600;
}
.tab-name {
  font-size: 14px;
}
.tab-visibility,
.tab-delete {
  font-size: 16px;
  cursor: pointer;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
}
.keep-original-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
}
.canvas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(525px, 1fr));
  gap: 8px;
  height: calc(100% - 33px - 27px - 30px);
  overflow-y: auto;
}
.canvas-wrap {
  position: relative;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: #f9f9f9;
  overflow: hidden;
  width: 525px;
  height: 525px;
}
.canvas-wrap.active {
  border-color: #3498db;
  box-shadow: 0 0 8px rgba(52, 152, 219, 0.5);
}
.main-canvas,
.overlay-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
}
.info {
  margin-top: 15px;
  padding: 10px;
  background: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 6px;
  max-height: 200px;
  overflow: auto;
  font-size: 14px;
}
.info ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.info li {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
button {
  cursor: pointer;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  background: #3498db;
  color: white;
  transition: 0.2s;
}
button:hover {
  background: #217dbb;
}
</style>
