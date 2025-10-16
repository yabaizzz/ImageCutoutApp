<!-- 图像切块 -->
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

    <!-- 全局切块信息 -->
    <div class="global-info" v-if="cutouts.length">
      <p>总切块数量: {{ cutouts.length }}</p>
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
    <div
      class="canvas-grid"
      :style="{
        gridTemplateColumns: visibleCount <= 1 ? '1fr' : 'repeat(2, 1fr)',
      }"
    >
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="image-section"
        v-show="img.visible"
        :class="{ 'full-width': visibleCount === 1 }"
      >
        <div class="canvas-wrap" :class="{ active: idx === currentIndex }">
          <canvas ref="mainCanvases" class="main-canvas"></canvas>
          <canvas
            ref="overlayCanvases"
            class="overlay-canvas"
            @mousedown="onPointerDown($event, idx)"
            @mousemove="onPointerMove($event, idx)"
            @mouseup="onPointerUp"
            @mouseleave="onPointerLeave"
            @touchstart.prevent="onPointerDown($event, idx)"
            @touchmove.prevent="onPointerMove($event, idx)"
            @touchend.prevent="onPointerUp"
            @touchcancel.prevent="onPointerLeave"
          ></canvas>
        </div>

        <!-- 图片对应的切块信息 -->
        <div class="image-info" v-if="getImageCutouts(idx).length > 0">
          <h3>{{ img.name || `图片${idx + 1}` }} 的切块</h3>
          <ul>
            <li
              v-for="(c, cIdx) in getImageCutouts(idx)"
              :key="c.id"
              :class="{ selected: selectedCutout === getGlobalIndex(c) }"
            >
              <span
                >#{{ cIdx + 1 }} | 顶点: {{ c.points.length }} | 面积:
                {{ calcArea(c) }}px²</span
              >
              <button @click="removeCutout(getGlobalIndex(c))">删除</button>
              <button @click="selectCutout(getGlobalIndex(c))">选中</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div style="padding-bottom: 100px"></div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, computed, onMounted, watch } from "vue";

// 常量定义
const CLOSE_THRESHOLD = 10;
const CANVAS_SIZES = { single: 800, multiple: 525 };

// Refs
const mainCanvases = ref([]);
const overlayCanvases = ref([]);
const ctxMains = ref([]);
const ctxOverlays = ref([]);

const images = reactive([]);
const currentIndex = ref(-1);
const keepOriginalArea = ref(false);
const isDrawing = ref(false);
const currentPoints = ref([]);
const cutouts = reactive([]);
const selectedCutout = ref(-1);
const mouseInCanvas = ref(false);

let cutoutIdCounter = 1;
let dragging = false,
  dragStart = null,
  dragType = null,
  dragVertexIndex = -1;

// 计算属性
const visibleCount = computed(() => images.filter((img) => img.visible).length);
const canvasSize = computed(() =>
  visibleCount.value === 1 ? CANVAS_SIZES.single : CANVAS_SIZES.multiple
);

// 工具函数
const pointInPolygon = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const getShortName = (name) =>
  name.length > 15 ? name.substring(0, 15) + "..." : name;
const getImageCutouts = (imageIndex) =>
  cutouts.filter((c) => c.imageIndex === imageIndex);
const getGlobalIndex = (cutout) => cutouts.indexOf(cutout);
const calcArea = (c) => {
  let area = 0;
  for (let i = 0, n = c.points.length; i < n; i++) {
    const j = (i + 1) % n;
    area += c.points[i][0] * c.points[j][1] - c.points[j][0] * c.points[i][1];
  }
  return Math.abs(area / 2);
};

// 画布操作
const initCanvas = async (idx) => {
  await nextTick();
  const [main, overlay] = [mainCanvases.value[idx], overlayCanvases.value[idx]];
  if (!main || !overlay) return;

  const size = canvasSize.value;
  main.width = overlay.width = main.height = overlay.height = size;

  ctxMains.value[idx] = main.getContext("2d");
  ctxOverlays.value[idx] = overlay.getContext("2d");

  redrawAll(idx);
};

const redrawAll = (idx) => {
  const [img, m, o] = [
    images[idx],
    ctxMains.value[idx],
    ctxOverlays.value[idx],
  ];
  if (!img || !m || !o || !img.visible) return;

  const size = canvasSize.value;
  m.clearRect(0, 0, size, size);
  o.clearRect(0, 0, size, size);

  // 绘制原始图片
  m.drawImage(img.img, 0, 0, size, size);

  // 绘制留白区域
  if (keepOriginalArea.value) {
    getImageCutouts(idx).forEach((c) => {
      if (c.offset[0] || c.offset[1]) {
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

  // 绘制切块
  getImageCutouts(idx).forEach((c) => {
    // 更新切块画布尺寸
    if (c.canvas.width !== size || c.canvas.height !== size) {
      updateCutoutCanvas(c, img, size);
    }

    // 绘制透明区域
    const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);
    m.save();
    m.globalCompositeOperation = "destination-out";
    m.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? m.moveTo(x, y) : m.lineTo(x, y)));
    m.closePath();
    m.fill();
    m.restore();

    // 绘制切块内容
    m.drawImage(c.canvas, c.offset[0], c.offset[1]);

    // 绘制轮廓
    const globalIdx = getGlobalIndex(c);
    o.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? o.moveTo(x, y) : o.lineTo(x, y)));
    o.closePath();
    o.lineWidth = selectedCutout.value === globalIdx ? 3 : 1.5;
    o.strokeStyle = selectedCutout.value === globalIdx ? "cyan" : "yellow";
    o.stroke();
  });

  // 绘制临时多边形
  if (isDrawing.value && currentPoints.value.length && mouseInCanvas.value) {
    o.beginPath();
    currentPoints.value.forEach(([x, y], i) =>
      i === 0 ? o.moveTo(x, y) : o.lineTo(x, y)
    );
    o.strokeStyle = "red";
    o.lineWidth = 2;
    o.stroke();
  }
};

const updateCutoutCanvas = (cutout, img, size) => {
  cutout.canvas.width = cutout.canvas.height = size;
  const ctx = cutout.canvas.getContext("2d");
  ctx.drawImage(img.img, 0, 0, size, size);
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  cutout.points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  );
  ctx.closePath();
  ctx.fill();
};

// 文件操作
const onFilesChange = (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const newIndex = images.length;
        images.push({ img, name: file.name, visible: images.length === 0 });
        nextTick(() => {
          initCanvas(newIndex);
          if (currentIndex.value === -1)
            currentIndex.value = images.findIndex((i) => i.visible);
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  e.target.value = "";
};

// 图片操作
const switchImage = (idx) => (currentIndex.value = idx);

const toggleImageVisibility = (idx) => {
  images[idx].visible = !images[idx].visible;
  nextTick(() => images.forEach((_, i) => initCanvas(i)));

  if (!images.some((img) => img.visible)) {
    images[0].visible = true;
    nextTick(() => images.forEach((_, i) => initCanvas(i)));
  }
};

const deleteImage = (idx) => {
  cutouts
    .filter((c) => c.imageIndex === idx)
    .forEach((c) => cutouts.splice(cutouts.indexOf(c), 1));
  images.splice(idx, 1);
  [mainCanvases, overlayCanvases, ctxMains, ctxOverlays].forEach((arr) =>
    arr.value.splice(idx, 1)
  );

  currentIndex.value = images.length
    ? Math.max(0, Math.min(currentIndex.value, images.length - 1))
    : -1;
  nextTick(() => images.forEach((_, i) => initCanvas(i)));
};

// 切块操作
const startDrawing = () => {
  if (currentIndex.value === -1) return;
  isDrawing.value = true;
  currentPoints.value = [];
  mouseInCanvas.value = true;
};

const finishDrawing = () => {
  if (
    currentIndex.value === -1 ||
    !isDrawing.value ||
    currentPoints.value.length < 3
  )
    return;

  const cutout = {
    id: cutoutIdCounter++,
    imageIndex: currentIndex.value,
    points: [...currentPoints.value],
    offset: [0, 0],
    canvas: document.createElement("canvas"),
  };

  updateCutoutCanvas(cutout, images[currentIndex.value], canvasSize.value);
  cutouts.push(cutout);

  isDrawing.value = false;
  currentPoints.value = [];
  mouseInCanvas.value = false;
  images.forEach((_, idx) => redrawAll(idx));
};

const cancelDrawing = () => {
  isDrawing.value = false;
  currentPoints.value = [];
  mouseInCanvas.value = false;
  redrawAll(currentIndex.value);
};

const removeCutout = (idx) => {
  if (idx >= 0 && idx < cutouts.length) {
    const imageIndex = cutouts[idx].imageIndex;
    cutouts.splice(idx, 1);
    if (selectedCutout.value === idx) selectedCutout.value = -1;
    redrawAll(imageIndex);
  }
};

const selectCutout = (idx) => {
  selectedCutout.value = idx;
  images.forEach((_, imgIdx) => redrawAll(imgIdx));
};

const clearCanvas = () => {
  cutouts.length = 0;
  selectedCutout.value = -1;
  images.forEach((_, idx) => redrawAll(idx));
};

const exportPixels = () => {
  const data = cutouts.map((c) => ({
    imageIndex: c.imageIndex,
    points: c.points,
    area: calcArea(c),
    pixels: Math.round(calcArea(c)),
  }));

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cutouts-data.json";
  a.click();
  URL.revokeObjectURL(url);
};

// 事件处理
const getCanvasCoordinates = (event, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const isTouch = event.type.includes("touch");
  const clientX = isTouch ? event.touches[0].clientX : event.clientX;
  const clientY = isTouch ? event.touches[0].clientY : event.clientY;

  const x = ((clientX - rect.left) * canvas.width) / rect.width;
  const y = ((clientY - rect.top) * canvas.height) / rect.height;
  return [x, y];
};

const onPointerDown = (event, imageIndex) => {
  if (currentIndex.value !== imageIndex) return;

  const canvas = overlayCanvases.value[imageIndex];
  if (!canvas) return;

  const [x, y] = getCanvasCoordinates(event, canvas);
  mouseInCanvas.value = true;

  if (isDrawing.value) {
    // 自动闭合检查
    if (currentPoints.value.length >= 3) {
      const [startX, startY] = currentPoints.value[0];
      const dist = Math.hypot(x - startX, y - startY);
      if (dist <= CLOSE_THRESHOLD) {
        currentPoints.value.push([startX, startY]);
        finishDrawing();
        return;
      }
    }
    currentPoints.value.push([x, y]);
    redrawAll(imageIndex);
    return;
  }

  // 切块交互
  for (let i = 0; i < cutouts.length; i++) {
    const c = cutouts[i];
    if (c.imageIndex !== imageIndex) continue;

    const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);

    // 顶点拖拽
    for (let j = 0; j < pts.length; j++) {
      const [vx, vy] = pts[j];
      if (Math.abs(x - vx) < 10 && Math.abs(y - vy) < 10) {
        startDrag("vertex", i, j, [x, y]);
        return;
      }
    }

    // 切块拖拽
    if (pointInPolygon(x, y, pts)) {
      startDrag("cutout", i, -1, [x, y]);
      return;
    }
  }
};

const startDrag = (type, cutoutIdx, vertexIdx, startPos) => {
  dragging = true;
  dragType = type;
  selectedCutout.value = cutoutIdx;
  dragVertexIndex = vertexIdx;
  dragStart = startPos;
  redrawAll(cutouts[cutoutIdx].imageIndex);
};

const onPointerMove = (event, imageIndex) => {
  if (currentIndex.value !== imageIndex) return;

  const canvas = overlayCanvases.value[imageIndex];
  if (!canvas) return;

  const [x, y] = getCanvasCoordinates(event, canvas);
  mouseInCanvas.value = true;

  if (isDrawing.value && currentPoints.value.length > 0) {
    redrawAll(imageIndex);
    const ctx = ctxOverlays.value[imageIndex];
    const [lastX, lastY] = currentPoints.value[currentPoints.value.length - 1];
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (dragging && dragStart && selectedCutout.value >= 0) {
    const [dx, dy] = [x - dragStart[0], y - dragStart[1]];
    const cutout = cutouts[selectedCutout.value];

    if (dragType === "vertex") {
      cutout.points[dragVertexIndex][0] += dx;
      cutout.points[dragVertexIndex][1] += dy;
    } else if (dragType === "cutout") {
      cutout.offset[0] += dx;
      cutout.offset[1] += dy;
    }

    dragStart = [x, y];
    redrawAll(imageIndex);
  }
};

const onPointerUp = () => {
  dragging = false;
  dragStart = null;
  dragType = null;
  dragVertexIndex = -1;
};

const onPointerLeave = () => {
  mouseInCanvas.value = false;
  if (isDrawing.value) redrawAll(currentIndex.value);
};

// 监听器
watch(visibleCount, (newCount, oldCount) => {
  if (newCount !== oldCount) {
    nextTick(() => {
      const oldSize =
        oldCount === 1 ? CANVAS_SIZES.single : CANVAS_SIZES.multiple;
      const newSize =
        newCount === 1 ? CANVAS_SIZES.single : CANVAS_SIZES.multiple;

      images.forEach((_, i) => {
        initCanvas(i);
        if (oldSize !== newSize) {
          adjustCutoutsForCanvasSize(i, oldSize, newSize);
        }
      });
    });
  }
});

const adjustCutoutsForCanvasSize = (imageIndex, oldSize, newSize) => {
  const scale = newSize / oldSize;
  getImageCutouts(imageIndex).forEach((c) => {
    c.points = c.points.map((p) => [p[0] * scale, p[1] * scale]);
    c.offset = [c.offset[0] * scale, c.offset[1] * scale];
    updateCutoutCanvas(c, images[imageIndex], newSize);
  });
  redrawAll(imageIndex);
};

onMounted(() => {});
</script>

<style scoped lang="scss">
.image-cutout-container {
  font-family: "Segoe UI", Arial, sans-serif;
  padding: 15px;
  margin: 0 auto;
  box-sizing: border-box;
  max-width: 1800px;

  .image-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 15px;
    flex-wrap: wrap;
    height: 40px;

    .image-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 16px;
      background: #f0f0f0;
      cursor: pointer;
      transition: all 0.2s;
      color: #333;

      &.active {
        background: #3498db;
        color: white;
        font-weight: 600;
      }

      .tab-name {
        font-size: 14px;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tab-visibility,
      .tab-delete {
        font-size: 16px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }
      }
    }
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    height: 40px;

    input[type="file"] {
      padding: 6px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    button {
      cursor: pointer;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      background: #3498db;
      color: white;
      transition: 0.2s;
      font-size: 14px;

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
      font-size: 14px;

      input[type="checkbox"] {
        margin: 0;
      }
    }
  }

  .canvas-grid {
    display: grid;
    gap: 15px;
    justify-items: center;
    align-items: start;
    margin-bottom: 15px;
    width: 100%;
    height: calc(100% - 50px);

    .image-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      max-width: 525px;

      &.full-width {
        max-width: 800px;
      }
    }

    .canvas-wrap {
      position: relative;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: #f9f9f9;
      overflow: hidden;
      width: 100%;
      aspect-ratio: 1 / 1;

      &.active {
        border-color: #3498db;
        box-shadow: 0 0 8px rgba(52, 152, 219, 0.5);
      }

      .main-canvas {
        z-index: 1;
      }
      .overlay-canvas {
        z-index: 2;
        cursor: crosshair;
      }

      .main-canvas,
      .overlay-canvas {
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        width: 100% !important;
        height: 100% !important;
      }
    }

    .image-info {
      background: #f9f9f9;
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 10px;
      width: 100%;

      h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #2c3e50;
        border-bottom: 1px solid #ddd;
        padding-bottom: 5px;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 150px;
        overflow-y: auto;
      }

      li {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        padding: 5px;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s;

        &:last-child {
          border-bottom: none;
        }

        &.selected {
          background-color: #e3f2fd;
          border-left: 3px solid #3498db;
        }

        span {
          flex: 1;
          color: #333;
          font-size: 13px;
        }

        button {
          cursor: pointer;
          border: none;
          padding: 3px 6px;
          border-radius: 3px;
          background: #3498db;
          color: white;
          transition: 0.2s;
          font-size: 11px;

          &:hover {
            background: #217dbb;
          }
        }
      }
    }
  }

  .global-info {
    margin-bottom: 15px;
    padding: 10px;
    background: #f9f9f9;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 14px;

    p {
      margin: 0;
      font-weight: 600;
      color: #2c3e50;
    }
  }
}

@media (max-width: 1100px) {
  .canvas-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 800px) {
  .image-section.full-width {
    max-width: 100% !important;
  }
}

@media (max-width: 600px) {
  .image-cutout-container {
    padding: 10px;
  }
  .controls {
    flex-direction: column;
    align-items: stretch;

    button {
      width: 100%;
    }
  }
}
</style>
