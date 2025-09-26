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
                {{ calcArea(c) }}px² | 像素数: {{ calcPixels(c) }}</span
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
import { ref, reactive, nextTick, computed, onMounted } from "vue";

/* ---------- 辅助函数 ---------- */
/**
 * 判断点是否在多边形内部（射线法）
 * @param {number} x - 点的X坐标
 * @param {number} y - 点的Y坐标
 * @param {Array} poly - 多边形顶点数组，每个顶点为[x, y]
 * @returns {boolean} 点是否在多边形内
 */
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      yi = poly[i][1];
    const xj = poly[j][0],
      yj = poly[j][1];
    // 判断射线与边是否相交
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ---------- Canvas refs ---------- */
// 主画布引用（用于显示图片和切块结果）
const mainCanvases = ref([]);
// 覆盖层画布引用（用于绘制轮廓和临时图形）
const overlayCanvases = ref([]);
// 主画布上下文（用于绘制图片和切块）
const ctxMains = ref([]);
// 覆盖层画布上下文（用于绘制轮廓）
const ctxOverlays = ref([]);

/* ---------- 图片与状态 ---------- */
// 存储所有上传的图片信息
const images = reactive([]);
// 当前选中的图片索引
const currentIndex = ref(-1);
// 是否在拖动切块后保持原区域留白
const keepOriginalArea = ref(false);

/* ---------- 绘制状态 ---------- */
// 是否正在绘制切块
const isDrawing = ref(false);
// 当前绘制的多边形顶点
const currentPoints = ref([]);
// 所有已完成的切块
const cutouts = reactive([]);
// 切块ID计数器，用于生成唯一ID
let cutoutIdCounter = 1;
// 当前选中的切块索引
const selectedCutout = ref(-1);

/* ---------- 拖拽状态 ---------- */
// 是否正在拖拽
let dragging = false;
// 拖拽起始点坐标
let dragStart = null;
// 拖拽类型：'vertex'（顶点）或 'cutout'（整个切块）
let dragType = null;
// 被拖拽的顶点索引
let dragVertexIndex = -1;

// 跟踪鼠标是否在画布内
const mouseInCanvas = ref(false);

/* ---------- 自动闭合半径 ---------- */
// 当鼠标距离起始点小于此值时，自动闭合多边形
const closeThreshold = 10;

/* ---------- 可见图片数量 ---------- */
// 计算当前可见的图片数量（用于布局调整）
const visibleCount = computed(() => images.filter((img) => img.visible).length);

/* ---------- 获取图片对应的切块 ---------- */
/**
 * 获取指定图片的所有切块
 * @param {number} imageIndex - 图片索引
 * @returns {Array} 该图片的所有切块
 */
function getImageCutouts(imageIndex) {
  return cutouts.filter((c) => c.imageIndex === imageIndex);
}

/* ---------- 获取切块的全局索引 ---------- */
/**
 * 获取切块在全局数组中的索引
 * @param {Object} cutout - 切块对象
 * @returns {number} 全局索引
 */
function getGlobalIndex(cutout) {
  return cutouts.indexOf(cutout);
}

/* ---------- 初始化 Canvas ---------- */
/**
 * 初始化指定索引的画布
 * @param {number} idx - 图片索引
 */
async function initCanvas(idx) {
  await nextTick();
  const main = mainCanvases.value[idx];
  const overlay = overlayCanvases.value[idx];
  if (!main || !overlay) return;

  // 获取画布上下文
  const ctxMain = main.getContext("2d");
  const ctxOverlay = overlay.getContext("2d");
  ctxMains.value[idx] = ctxMain;
  ctxOverlays.value[idx] = ctxOverlay;

  // 根据可见图片数量设置画布尺寸：单张800x800，多张525x525
  const canvasSize = visibleCount.value === 1 ? 800 : 525;
  main.width = overlay.width = canvasSize;
  main.height = overlay.height = canvasSize;

  // 重绘画布内容
  redrawAll(idx);
}

/* ---------- 重绘指定图片 ---------- */
/**
 * 重绘指定索引的图片及其所有切块
 * @param {number} idx - 图片索引
 */
function redrawAll(idx) {
  const img = images[idx];
  const m = ctxMains.value[idx];
  const o = ctxOverlays.value[idx];
  if (!img || !m || !o) return;

  // 根据可见图片数量确定画布尺寸
  const canvasSize = visibleCount.value === 1 ? 800 : 525;

  // 清空画布
  m.clearRect(0, 0, canvasSize, canvasSize);
  o.clearRect(0, 0, canvasSize, canvasSize);

  if (img.visible) {
    // 绘制原始图片
    m.drawImage(img.img, 0, 0, canvasSize, canvasSize);

    // 如果需要保持原区域留白，在拖动后填充白色
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

    // 绘制切块的透明区域（原始图片中被剪切的部分）
    cutouts
      .filter((c) => c.imageIndex === idx)
      .forEach((c) => {
        const pts = c.points.map((p) => [
          p[0] + c.offset[0],
          p[1] + c.offset[1],
        ]);
        m.save();
        m.globalCompositeOperation = "destination-out"; // 目标区域外显示
        m.beginPath();
        m.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) m.lineTo(pts[i][0], pts[i][1]);
        m.closePath();
        m.fill();
        m.restore();
      });

    // 绘制切块内容
    cutouts
      .filter((c) => c.imageIndex === idx)
      .forEach((c) => {
        m.drawImage(c.canvas, c.offset[0], c.offset[1], canvasSize, canvasSize);
      });

    // 绘制切块轮廓
    cutouts
      .filter((c) => c.imageIndex === idx)
      .forEach((c) => {
        const globalIndex = getGlobalIndex(c);
        const pts = c.points.map((p) => [
          p[0] + c.offset[0],
          p[1] + c.offset[1],
        ]);
        o.beginPath();
        o.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) o.lineTo(pts[i][0], pts[i][1]);
        o.closePath();
        // 选中的切块使用不同的线宽和颜色
        o.lineWidth = selectedCutout.value === globalIndex ? 3 : 1.5;
        o.strokeStyle =
          selectedCutout.value === globalIndex ? "cyan" : "yellow";
        o.stroke();
      });

    // 绘制正在绘制的临时多边形
    if (isDrawing.value && currentPoints.value.length && mouseInCanvas.value) {
      o.beginPath();
      o.moveTo(currentPoints.value[0][0], currentPoints.value[0][1]);
      for (let i = 1; i < currentPoints.value.length; i++)
        o.lineTo(currentPoints.value[i][0], currentPoints.value[i][1]);
      o.strokeStyle = "red";
      o.lineWidth = 2;
      o.stroke();
    }
  }
}

/* ---------- 上传图片 ---------- */
/**
 * 处理文件上传事件
 * @param {Event} e - 文件上传事件
 */
function onFilesChange(e) {
  const files = e.target.files;
  if (!files.length) return;

  Array.from(files).forEach((f) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const newIndex = images.length;
      // 添加图片信息到数组
      images.push({ url, img, name: f.name, visible: images.length === 0 });
      nextTick(() => {
        // 初始化新添加的图片画布
        initCanvas(newIndex);
        // 如果是第一张图片，自动选中
        if (currentIndex.value === -1)
          currentIndex.value = images.findIndex((i) => i.visible);
      });
    };
    img.src = url;
  });

  // 清空文件输入，允许重复选择同一文件
  e.target.value = "";
}

/* ---------- 图片标签操作 ---------- */
/**
 * 获取短文件名（超过15字符时截断）
 * @param {string} name - 原始文件名
 * @returns {string} 处理后的短文件名
 */
function getShortName(name) {
  return name.length > 15 ? name.substring(0, 15) + "..." : name;
}

/**
 * 切换选中的图片
 * @param {number} idx - 图片索引
 */
function switchImage(idx) {
  currentIndex.value = idx;
}

/**
 * 切换图片的可见性
 * @param {number} idx - 图片索引
 */
function toggleImageVisibility(idx) {
  images[idx].visible = !images[idx].visible;
  nextTick(() => {
    // 重新初始化所有画布以适应尺寸变化
    images.forEach((_, i) => initCanvas(i));
  });
  // 确保至少有一张图片可见
  if (!images.some((img) => img.visible)) {
    images[0].visible = true;
    nextTick(() => {
      images.forEach((_, i) => initCanvas(i));
    });
  }
}

/**
 * 删除指定图片及其所有切块
 * @param {number} idx - 图片索引
 */
function deleteImage(idx) {
  // 删除该图片的所有切块
  cutouts
    .filter((c) => c.imageIndex === idx)
    .forEach((c) => {
      cutouts.splice(cutouts.indexOf(c), 1);
    });
  // 从数组中删除图片
  images.splice(idx, 1);
  mainCanvases.value.splice(idx, 1);
  overlayCanvases.value.splice(idx, 1);
  ctxMains.value.splice(idx, 1);
  ctxOverlays.value.splice(idx, 1);
  // 更新当前选中索引
  currentIndex.value = images.length
    ? Math.max(0, Math.min(currentIndex.value, images.length - 1))
    : -1;

  // 重新初始化所有画布
  nextTick(() => {
    images.forEach((_, i) => initCanvas(i));
  });
}

/* ---------- 绘制控制 ---------- */
/**
 * 开始绘制新的切块
 */
function startDrawing() {
  if (currentIndex.value === -1) return;
  isDrawing.value = true;
  currentPoints.value = [];
  mouseInCanvas.value = true;
}

/**
 * 完成当前切块的绘制
 */
function finishDrawing() {
  // 验证绘制状态和顶点数量（至少需要3个顶点形成多边形）
  if (
    currentIndex.value === -1 ||
    !isDrawing.value ||
    currentPoints.value.length < 3
  )
    return;

  // 根据可见图片数量确定画布尺寸
  const canvasSize = visibleCount.value === 1 ? 800 : 525;
  // 创建新切块对象
  const cutout = {
    id: cutoutIdCounter++,
    imageIndex: currentIndex.value,
    points: [...currentPoints.value],
    offset: [0, 0],
    canvas: document.createElement("canvas"),
  };

  // 初始化切块的画布
  cutout.canvas.width = canvasSize;
  cutout.canvas.height = canvasSize;
  const ctx = cutout.canvas.getContext("2d");
  const img = images[currentIndex.value];
  // 绘制图片到切块画布
  ctx.drawImage(img.img, 0, 0, canvasSize, canvasSize);
  // 使用遮罩保留多边形内的图像
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.moveTo(cutout.points[0][0], cutout.points[0][1]);
  for (let i = 1; i < cutout.points.length; i++)
    ctx.lineTo(cutout.points[i][0], cutout.points[i][1]);
  ctx.closePath();
  ctx.fill();

  // 添加切块到数组并重置绘制状态
  cutouts.push(cutout);
  isDrawing.value = false;
  currentPoints.value = [];
  mouseInCanvas.value = false;
  // 重绘所有图片
  images.forEach((_, idx) => redrawAll(idx));
}

/**
 * 取消当前的绘制
 */
function cancelDrawing() {
  isDrawing.value = false;
  currentPoints.value = [];
  mouseInCanvas.value = false;
  redrawAll(currentIndex.value);
}

/**
 * 导出所有切块的像素数据为JSON文件
 */
function exportPixels() {
  const data = cutouts.map((c) => ({
    imageIndex: c.imageIndex,
    points: c.points,
    area: calcArea(c),
    pixels: calcPixels(c),
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
}

/**
 * 清空所有画布和切块
 */
function clearCanvas() {
  cutouts.length = 0;
  selectedCutout.value = -1;
  images.forEach((_, idx) => redrawAll(idx));
}

/**
 * 删除指定的切块
 * @param {number} idx - 切块的全局索引
 */
function removeCutout(idx) {
  if (idx >= 0 && idx < cutouts.length) {
    const imageIndex = cutouts[idx].imageIndex;
    cutouts.splice(idx, 1);
    if (selectedCutout.value === idx) selectedCutout.value = -1;
    redrawAll(imageIndex);
  }
}

/**
 * 选中指定的切块
 * @param {number} idx - 切块的全局索引
 */
function selectCutout(idx) {
  selectedCutout.value = idx;
  // 重绘所有图片，确保边框颜色正确更新
  images.forEach((_, imgIdx) => redrawAll(imgIdx));
}

/**
 * 计算多边形的面积（使用 shoelace 公式）
 * @param {Object} c - 切块对象
 * @returns {number} 多边形面积
 */
function calcArea(c) {
  let area = 0;
  const n = c.points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += c.points[i][0] * c.points[j][1];
    area -= c.points[j][0] * c.points[i][1];
  }
  return Math.abs(area / 2);
}

/**
 * 估算切块的像素数量（通过面积近似）
 * @param {Object} c - 切块对象
 * @returns {number} 估算的像素数量
 */
function calcPixels(c) {
  return Math.round(calcArea(c));
}

/* ---------- 鼠标/触摸事件处理 ---------- */
/**
 * 将事件坐标转换为画布坐标
 * @param {Event} event - 鼠标或触摸事件
 * @param {HTMLCanvasElement} canvas - 目标画布
 * @returns {Array} 转换后的[x, y]坐标
 */
function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  let x, y;
  // 处理触摸事件
  if (event.type.includes("touch")) {
    x = event.touches[0].clientX - rect.left;
    y = event.touches[0].clientY - rect.top;
  } else {
    // 处理鼠标事件
    x = event.clientX - rect.left;
    y = event.clientY - rect.top;
  }
  // 根据画布的实际尺寸与显示尺寸的比例进行校正
  return [(x * canvas.width) / rect.width, (y * canvas.height) / rect.height];
}

/**
 * 处理鼠标/触摸按下事件
 * @param {Event} event - 鼠标或触摸事件
 * @param {number} imageIndex - 图片索引
 */
function onPointerDown(event, imageIndex) {
  if (currentIndex.value !== imageIndex) return;
  const canvas = overlayCanvases.value[imageIndex];
  if (!canvas) return;
  const [x, y] = getCanvasCoordinates(event, canvas);
  mouseInCanvas.value = true;

  // 如果正在绘制模式
  if (isDrawing.value) {
    // 检查是否靠近起点（用于自动闭合多边形）
    if (currentPoints.value.length >= 3) {
      const [startX, startY] = currentPoints.value[0];
      const dx = x - startX;
      const dy = y - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= closeThreshold) {
        // 自动闭合多边形并完成绘制
        currentPoints.value.push([startX, startY]);
        finishDrawing();
        return;
      }
    }

    // 添加新的顶点
    currentPoints.value.push([x, y]);
    redrawAll(imageIndex);
    return;
  }

  // 非绘制模式下，检查是否点击了切块或顶点
  for (let i = 0; i < cutouts.length; i++) {
    const c = cutouts[i];
    if (c.imageIndex !== imageIndex) continue;
    const pts = c.points.map((p) => [p[0] + c.offset[0], p[1] + c.offset[1]]);

    // 检查是否点击了顶点
    for (let j = 0; j < pts.length; j++) {
      const [vx, vy] = pts[j];
      if (Math.abs(x - vx) < 10 && Math.abs(y - vy) < 10) {
        dragging = true;
        dragType = "vertex";
        dragVertexIndex = j;
        selectedCutout.value = i;
        dragStart = [x, y];
        redrawAll(imageIndex);
        return;
      }
    }

    // 检查是否点击了切块内部
    if (pointInPolygon(x, y, pts)) {
      dragging = true;
      dragType = "cutout";
      selectedCutout.value = i;
      dragStart = [x, y];
      redrawAll(imageIndex);
      return;
    }
  }
}

/**
 * 处理鼠标/触摸移动事件
 * @param {Event} event - 鼠标或触摸事件
 * @param {number} imageIndex - 图片索引
 */
function onPointerMove(event, imageIndex) {
  if (currentIndex.value !== imageIndex) return;
  const canvas = overlayCanvases.value[imageIndex];
  if (!canvas) return;
  const [x, y] = getCanvasCoordinates(event, canvas);
  mouseInCanvas.value = true;

  // 绘制模式下，实时显示当前线段
  if (isDrawing.value && currentPoints.value.length > 0) {
    const ctx = ctxOverlays.value[imageIndex];
    redrawAll(imageIndex);

    // 绘制从最后一个顶点到当前鼠标位置的临时线
    ctx.beginPath();
    ctx.moveTo(
      currentPoints.value[currentPoints.value.length - 1][0],
      currentPoints.value[currentPoints.value.length - 1][1]
    );
    ctx.lineTo(x, y);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // 拖拽模式下，移动顶点或整个切块
  else if (dragging && dragStart && selectedCutout.value >= 0) {
    const dx = x - dragStart[0];
    const dy = y - dragStart[1];
    const cutout = cutouts[selectedCutout.value];

    // 移动单个顶点
    if (dragType === "vertex") {
      cutout.points[dragVertexIndex][0] += dx;
      cutout.points[dragVertexIndex][1] += dy;
    }
    // 移动整个切块
    else if (dragType === "cutout") {
      cutout.offset[0] += dx;
      cutout.offset[1] += dy;
    }

    // 更新拖拽起点
    dragStart = [x, y];
    redrawAll(imageIndex);
  }
}

/**
 * 处理鼠标/触摸释放事件
 */
function onPointerUp() {
  dragging = false;
  dragStart = null;
  dragType = null;
  dragVertexIndex = -1;
}

/**
 * 处理鼠标离开画布事件
 */
function onPointerLeave() {
  mouseInCanvas.value = false;
  if (isDrawing.value) redrawAll(currentIndex.value);
}

// 组件挂载时的初始化
onMounted(() => {});
</script>

<style scoped lang="scss">
.image-cutout-container {
  font-family: "Segoe UI", Arial, sans-serif;
  padding: 15px;
  margin: 0 auto;
  box-sizing: border-box;
  max-width: 1800px; /* 增加最大宽度以适应800px的图片 */

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
    height: calc(100% - (40px - 15px) * 2);

    .image-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      max-width: 525px;

      &.full-width {
        max-width: 800px; /* 单张图片时最大宽度为800px */
      }
    }

    .canvas-wrap {
      // position: relative;
      // border: 2px solid #ddd;
      // border-radius: 6px;
      // background: #f9f9f9;
      // overflow: hidden;
      // width: 100%;
      // height: 0;
      // padding-bottom: 100%;
      // box-sizing: border-box;
      position: relative;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: #f9f9f9;
      overflow: hidden;
      width: 100%;
      aspect-ratio: 1 / 1; /* 保持正方形，不用 padding 技巧 */

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
    margin-top: 15px;
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

// 响应式设计
@media (max-width: 1100px) {
  .canvas-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 800px) {
  // 当屏幕小于800px时，单张图片自适应
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
    // justify-items: center;

    button {
      width: 100%;
    }
  }
}
</style>
