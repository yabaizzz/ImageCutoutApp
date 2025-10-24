<template>
  <div class="app-container">
    <!-- 文件上传区域 -->
    <div class="upload-section">
      <h2>图像标注可视化工具</h2>
      <div class="upload-controls">
        <div class="file-upload-group">
          <label for="imageUpload">选择PNG图像:</label>
          <input
            type="file"
            id="imageUpload"
            accept=".png,.jpg,.jpeg"
            @change="handleImageUpload"
          />
          <span v-if="imageFile" class="file-name">{{ imageFile.name }}</span>
        </div>
        <div class="file-upload-group">
          <label for="textUpload">选择TXT标注文件:</label>
          <input
            type="file"
            id="textUpload"
            accept=".txt"
            @change="handleTextUpload"
          />
          <span v-if="textFile" class="file-name">{{ textFile.name }}</span>
        </div>
        <button
          @click="processFiles"
          class="btn btn-process"
          :disabled="!hasFiles"
        >
          处理文件
        </button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content" :class="{ 'has-data': hasData }">
      <!-- 左侧图像显示区域 -->
      <div class="image-section">
        <div class="canvas-container" ref="canvasContainer">
          <canvas ref="originalCanvas" class="image-canvas"></canvas>
          <canvas
            ref="maskCanvas"
            class="mask-canvas"
            :style="{ opacity: maskOpacity }"
          ></canvas>
          <canvas
            ref="scanCanvas"
            class="scan-canvas"
            v-show="showScanEffect"
          ></canvas>

          <!-- 水平扫描线 - 延伸到容器外 -->
          <div
            class="scan-line horizontal-scan-line"
            :style="horizontalScanLineStyle"
            v-show="showScanEffect && scanDirection === 'horizontal'"
            @mousedown="startDrag"
          ></div>

          <!-- 垂直扫描线 - 延伸到容器外 -->
          <div
            class="scan-line vertical-scan-line"
            :style="verticalScanLineStyle"
            v-show="showScanEffect && scanDirection === 'vertical'"
            @mousedown="startDrag"
          ></div>
        </div>

        <!-- 控制面板 -->
        <div class="control-panel" v-if="hasData">
          <div class="control-group">
            <label>掩码透明度:</label>
            <input
              type="range"
              v-model="maskOpacity"
              min="0.1"
              max="1"
              step="0.1"
              @input="renderMask"
            />
            <span>{{ (maskOpacity * 100).toFixed(0) }}%</span>
          </div>

          <!-- 扫描效果开关 -->
          <div class="control-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="showScanEffect"
                @change="handleScanEffectToggle"
              />
              显示扫描效果
            </label>
          </div>

          <!-- 扫描方向选择 -->
          <div class="control-group" v-if="showScanEffect">
            <label>扫描方向:</label>
            <select v-model="scanDirection" @change="handleScanDirectionChange">
              <option value="horizontal">水平扫描</option>
              <option value="vertical">垂直扫描</option>
            </select>
          </div>

          <!-- 扫描位置控制 -->
          <div class="control-group" v-if="showScanEffect">
            <label
              >{{
                scanDirection === "horizontal" ? "水平位置" : "垂直位置"
              }}:</label
            >
            <input
              type="range"
              v-model="scanPosition"
              min="0"
              max="100"
              step="1"
              class="scan-slider"
              @input="updateScanLine"
            />
            <span>{{ scanPosition }}%</span>
          </div>
        </div>
      </div>

      <!-- 右侧信息面板 -->
      <div class="info-panel" v-if="hasData">
        <!-- 图像基本信息 -->
        <div class="panel-section">
          <h3>图像信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>名称:</label>
              <span>{{ imageInfo.name || "未选择" }}</span>
            </div>
            <div class="info-item">
              <label>尺寸:</label>
              <span>{{
                imageInfo.width
                  ? `${imageInfo.width} × ${imageInfo.height}`
                  : "未知"
              }}</span>
            </div>
            <div class="info-item">
              <label>文件大小:</label>
              <span>{{ imageInfo.size || "未知" }}</span>
            </div>
          </div>
        </div>

        <!-- 类别统计 -->
        <div class="panel-section">
          <h3>分类统计</h3>
          <div class="stats-container">
            <div
              v-for="stat in statistics"
              :key="stat.classId"
              class="stat-item"
              @mouseenter="highlightCategory(stat.classId)"
              @mouseleave="resetHighlight"
            >
              <div
                class="color-indicator"
                :style="getColorStyle(stat.classId)"
              ></div>
              <div class="stat-details">
                <div class="category-name">
                  {{ getCategoryName(stat.classId) }}
                </div>
                <div class="stat-values">
                  <span>数量: {{ stat.count }}</span>
                  <span>面积: {{ formatNumber(stat.area) }}px</span>
                  <span v-if="stat.perimeter"
                    >周长: {{ formatNumber(stat.perimeter) }}px</span
                  >
                </div>
              </div>
            </div>
            <div v-if="statistics.length === 0" class="no-data">
              暂无统计数据
            </div>
          </div>
        </div>

        <!-- 颜色图例 -->
        <div class="panel-section">
          <h3>颜色图例</h3>
          <div class="legend-container">
            <div
              v-for="(category, id) in colorMap"
              :key="id"
              class="legend-item"
            >
              <div
                class="legend-color"
                :style="{ backgroundColor: category.color }"
              ></div>
              <span class="legend-label">{{ category.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!hasData" class="empty-state">
        <div class="empty-icon">📷</div>
        <h3>请选择图像和标注文件</h3>
        <p>选择PNG图像文件和对应的TXT标注文件开始可视化</p>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>处理文件中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { fileUpload1 } from "@/api/api";

const colorMap = {
  0: { name: "城市土地", color: "rgba(0, 255, 255, 0.5)" },
  1: { name: "农业用地", color: "rgba(255, 255, 0, 0.5)" },
  2: { name: "牧场", color: "rgba(255, 0, 255, 0.5)" },
  3: { name: "森林", color: "rgba(0, 255, 0, 0.5)" },
  4: { name: "水系", color: "rgba(0, 0, 255, 0.5)" },
  5: { name: "荒地", color: "rgba(255, 255, 255, 0.5)" },
  6: { name: "未知土地", color: "rgba(0, 0, 0, 0.5)" },
};

// 响应式数据
const imageFile = ref(null);
const textFile = ref(null);
const originalImage = ref(null);
const maskData = ref([]);
const imageInfo = ref({ name: "", width: 0, height: 0, size: "" });
const statistics = ref([]);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const maskOpacity = ref(0.5);
const scanPosition = ref(0);
const isLoading = ref(false);
const errorMessage = ref("");
const originalMaskData = ref([]);
const showScanEffect = ref(false);
const scanDirection = ref("horizontal");
const isDragging = ref(false);

// Canvas 引用
const originalCanvas = ref(null);
const maskCanvas = ref(null);
const scanCanvas = ref(null);
const canvasContainer = ref(null);
const canvasInitialized = ref(false);

// 计算属性
const hasFiles = computed(() => imageFile.value && textFile.value);
const hasData = computed(
  () => originalImage.value && originalMaskData.value.length > 0
);
const horizontalScanLineStyle = computed(() => ({
  left: `${scanPosition.value}%`,
}));
const verticalScanLineStyle = computed(() => ({
  top: `${scanPosition.value}%`,
}));

// 初始化Canvas
watch([originalCanvas, maskCanvas, scanCanvas], () => {
  if (originalCanvas.value && maskCanvas.value && scanCanvas.value) {
    initializeCanvasContexts();
  }
});

onMounted(() => {
  setTimeout(() => {
    if (originalCanvas.value && maskCanvas.value && scanCanvas.value) {
      initializeCanvasContexts();
    }
  }, 300);

  // 添加全局鼠标事件监听
  document.addEventListener("mousemove", handleDrag);
  document.addEventListener("mouseup", stopDrag);
});

const initializeCanvasContexts = () => {
  try {
    originalCanvas.value.getContext("2d");
    maskCanvas.value.getContext("2d");
    scanCanvas.value.getContext("2d");
    canvasInitialized.value = true;
  } catch (error) {
    errorMessage.value = "Canvas初始化失败: " + error.message;
  }
};

const getSafeCanvasContext = (canvasElement, contextName = "canvas") => {
  if (!canvasElement)
    throw new Error(`${contextName} element is not available`);
  const context = canvasElement.getContext("2d");
  if (!context) throw new Error(`${contextName} context is not available`);
  return context;
};

// 文件选择逻辑
const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.match("image.*")) {
    errorMessage.value = "请选择图像文件 (PNG, JPG, JPEG)";
    return;
  }
  imageFile.value = file;
  errorMessage.value = "";
};

const handleTextUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.name.endsWith(".txt")) {
    errorMessage.value = "请选择TXT文件";
    return;
  }
  textFile.value = file;
  errorMessage.value = "";
};

// 扫描效果切换
const handleScanEffectToggle = () => {
  if (showScanEffect.value) {
    scanPosition.value = 0;
    // 切换到扫描模式时，重新渲染掩码以清除基础掩码
    renderMask();
  } else {
    // 关闭扫描效果时，清除扫描画布并恢复基础掩码
    clearScanMask();
    scanPosition.value = 0;
    scanDirection.value = "horizontal";
    isDragging.value = false;
    // 重新渲染基础掩码
    renderMask();
  }
};

// 扫描方向改变
const handleScanDirectionChange = () => {
  scanPosition.value = 0;
  updateScanLine();
};

// 开始拖拽扫描线
const startDrag = (event) => {
  isDragging.value = true;
  event.preventDefault();
  updateScanPositionFromEvent(event);
};

// 处理拖拽
const handleDrag = (event) => {
  if (!isDragging.value) return;
  updateScanPositionFromEvent(event);
};

// 根据鼠标事件更新扫描位置
const updateScanPositionFromEvent = (event) => {
  if (!canvasContainer.value) return;

  const containerRect = canvasContainer.value.getBoundingClientRect();
  let newPosition;

  if (scanDirection.value === "horizontal") {
    const relativeX = event.clientX - containerRect.left;
    newPosition = (relativeX / containerRect.width) * 100;
  } else {
    const relativeY = event.clientY - containerRect.top;
    newPosition = (relativeY / containerRect.height) * 100;
  }

  // 限制在0-100范围内
  scanPosition.value = Math.max(0, Math.min(100, newPosition));
  updateScanLine();
};

// 停止拖拽
const stopDrag = () => {
  isDragging.value = false;
};

// 处理文件核心逻辑
const processFiles = async () => {
  if (!hasFiles.value) {
    errorMessage.value = "请选择图像文件和标注文件";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const res = await fileUpload1(imageFile.value, textFile.value);

    // 赋值数据
    maskData.value = res.data.maskData;
    originalMaskData.value = [...res.data.maskData];
    statistics.value = res.data.statistics;
    imageInfo.value.width = res.data.imageInfo.width;
    imageInfo.value.height = res.data.imageInfo.height;
    imageInfo.value.name = res.data.imageInfo.name;
    imageInfo.value.size = res.data.imageInfo.size;

    // 加载图片
    await loadImage();

    // 渲染
    if (showScanEffect.value) {
      updateScanLine();
    } else {
      renderMask();
    }
  } catch (error) {
    errorMessage.value = `处理失败: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
};

// 加载图片
const loadImage = () => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      originalImage.value = img;
      canvasWidth.value = img.width;
      canvasHeight.value = img.height;
      setupCanvases();

      const ctx = getSafeCanvasContext(originalCanvas.value, "Original");
      ctx.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value);
      resolve();
    };
    img.onerror = () => reject(new Error("图像加载失败"));
    img.src = URL.createObjectURL(imageFile.value);
  });
};

// Canvas设置
const setupCanvases = () => {
  const canvases = [originalCanvas.value, maskCanvas.value, scanCanvas.value];
  canvases.forEach((canvas) => {
    if (canvas) {
      canvas.width = canvasWidth.value;
      canvas.height = canvasHeight.value;
    }
  });

  if (canvasContainer.value) {
    canvasContainer.value.style.width = `${Math.min(canvasWidth.value, 800)}px`;
    canvasContainer.value.style.height = `${Math.min(
      canvasHeight.value,
      600
    )}px`;
  }

  if (originalCanvas.value) originalCanvas.value.style.zIndex = "1";
  if (maskCanvas.value) maskCanvas.value.style.zIndex = "2";
  if (scanCanvas.value) scanCanvas.value.style.zIndex = "3";
};

// 渲染掩码
const renderMask = () => {
  try {
    const ctx = getSafeCanvasContext(maskCanvas.value, "Mask");
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

    if (!showScanEffect.value) {
      // 正常模式：在 maskCanvas 上绘制完整掩码
      maskData.value.forEach((mask) => {
        const color = getCategoryColor(mask.classId);
        if (mask.type === "polygon") {
          drawPolygonMask(ctx, mask.points, color);
          drawBoundingBox(
            ctx,
            mask.boundingBox,
            color,
            mask.classId,
            mask.type
          );
        } else if (mask.type === "boundingBox") {
          drawBoundingBoxMask(ctx, mask.boundingBox, color);
          drawBoundingBox(
            ctx,
            mask.boundingBox,
            color,
            mask.classId,
            mask.type
          );
        }
      });
      maskCanvas.value.style.opacity = maskOpacity.value;
    } else {
      // 扫描模式：完全清除基础掩码，只在 scanCanvas 上绘制扫描区域
      ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
      maskCanvas.value.style.opacity = 0; // 确保基础掩码完全透明

      // 立即更新扫描效果
      updateScanLine();
    }
  } catch (error) {
    console.error("渲染掩码失败:", error);
    errorMessage.value = `渲染掩码失败: ${error.message}`;
  }
};

// 绘制多边形掩码
const drawPolygonMask = (ctx, points, color) => {
  if (!points || points.length < 3) return;

  ctx.fillStyle = color;
  ctx.globalAlpha = maskOpacity.value;
  ctx.beginPath();

  const startX = points[0].x * canvasWidth.value;
  const startY = points[0].y * canvasHeight.value;
  ctx.moveTo(startX, startY);

  for (let i = 1; i < points.length; i++) {
    const x = points[i].x * canvasWidth.value;
    const y = points[i].y * canvasHeight.value;
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
};

// 绘制边界框掩码
const drawBoundingBoxMask = (ctx, bbox, color) => {
  ctx.fillStyle = color;
  ctx.globalAlpha = maskOpacity.value;

  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  ctx.fillRect(x, y, width, height);
};

// 绘制边界框
const drawBoundingBox = (ctx, bbox, color, classId, maskType) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1.0;

  // 计算像素级边界框坐标（原有逻辑不变）
  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  // 绘制边界框线条（两种类型都保留）
  ctx.strokeRect(x, y, width, height);

  // 仅 polygon 类型显示 ID 标签，boundingBox 类型不显示
  if (maskType === "polygon") {
    drawClassIdLabel(ctx, x, y, width, height, classId, color);
  }

  ctx.globalAlpha = maskOpacity.value;
};

// 绘制扫描边界框（不显示标签）
const drawScanBoundingBox = (ctx, bbox, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1.0;

  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  // 只绘制边界框，不显示标签
  ctx.strokeRect(x, y, width, height);
  ctx.globalAlpha = maskOpacity.value;
};

// 绘制类别标签
const drawClassIdLabel = (ctx, x, y, width, height, classId, color) => {
  const label = classId.toString();
  const padding = 5;
  const minDimension = Math.min(width, height);
  const fontSize = Math.max(12, Math.min(24, minDimension * 0.15));

  ctx.font = `bold ${fontSize}px Arial`;
  const textWidth = ctx.measureText(label).width;
  const labelWidth = textWidth + padding * 2;
  const labelHeight = fontSize + padding * 2;

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(x, y, labelWidth, labelHeight);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, labelWidth, labelHeight);
  ctx.fillStyle = "#333";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + padding, y + padding);
};

// 更新扫描线
const updateScanLine = () => {
  updateScanMask();
};

// 更新扫描掩码 - 重新设计支持水平和垂直扫描
const updateScanMask = () => {
  try {
    const ctx = getSafeCanvasContext(scanCanvas.value, "Scan");
    // 完全清除扫描画布
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

    if (showScanEffect.value) {
      ctx.save();

      // 根据扫描方向设置剪辑区域
      if (scanDirection.value === "horizontal") {
        // 水平扫描：扫描线左侧区域
        const scanX = (scanPosition.value / 100) * canvasWidth.value;
        ctx.beginPath();
        ctx.rect(0, 0, scanX, canvasHeight.value);
        ctx.clip();
      } else {
        // 垂直扫描：扫描线上方区域
        const scanY = (scanPosition.value / 100) * canvasHeight.value;
        ctx.beginPath();
        ctx.rect(0, 0, canvasWidth.value, scanY);
        ctx.clip();
      }

      // 在已扫描区域绘制掩码和边界框
      maskData.value.forEach((mask) => {
        const color = getCategoryColor(mask.classId);

        if (mask.type === "polygon") {
          drawPolygonScanMask(ctx, mask.points, color);
          // 扫描时显示多边形边界框
          drawScanBoundingBox(ctx, mask.boundingBox, color);
        } else if (mask.type === "boundingBox") {
          drawBoundingBoxScanMask(ctx, mask.boundingBox, color);
          // 扫描时显示边界框类型的边界框
          drawScanBoundingBox(ctx, mask.boundingBox, color);
        }
      });

      ctx.restore();

      // 确保基础掩码完全隐藏
      maskCanvas.value.style.opacity = 0;
    }
  } catch (error) {
    console.error("更新扫描遮罩失败:", error);
  }
};

// 绘制多边形扫描掩码
const drawPolygonScanMask = (ctx, points, color) => {
  if (!points || points.length < 3) return;

  ctx.fillStyle = color;
  ctx.globalAlpha = maskOpacity.value;
  ctx.beginPath();

  const startX = points[0].x * canvasWidth.value;
  const startY = points[0].y * canvasHeight.value;
  ctx.moveTo(startX, startY);

  for (let i = 1; i < points.length; i++) {
    const x = points[i].x * canvasWidth.value;
    const y = points[i].y * canvasHeight.value;
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
};

// 绘制边界框扫描掩码
const drawBoundingBoxScanMask = (ctx, bbox, color) => {
  ctx.fillStyle = color;
  ctx.globalAlpha = maskOpacity.value;

  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  ctx.fillRect(x, y, width, height);
};

// 清除扫描掩码
const clearScanMask = () => {
  try {
    const ctx = getSafeCanvasContext(scanCanvas.value, "Scan");
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
    // 恢复基础掩码显示
    maskCanvas.value.style.opacity = maskOpacity.value;
  } catch (error) {
    console.error("清除扫描遮罩失败:", error);
  }
};

// 高亮类别
const highlightCategory = (classId) => {
  if (originalMaskData.value.length === 0) {
    originalMaskData.value = [...maskData.value];
  }

  const filteredData = originalMaskData.value.filter(
    (mask) => mask.classId === classId
  );

  if (filteredData.length > 0) {
    maskData.value = filteredData;
    renderMask();
  }
};

// 重置高亮
const resetHighlight = () => {
  if (originalMaskData.value.length > 0) {
    maskData.value = [...originalMaskData.value];
    renderMask();
  }
};

// 获取类别颜色
const getCategoryColor = (classId) => {
  return colorMap[classId]?.color || "rgba(128, 128, 128, 0.5)";
};

// 获取类别名称
const getCategoryName = (classId) => {
  return colorMap[classId]?.name || `类别 ${classId}`;
};

// 获取颜色样式
const getColorStyle = (classId) => {
  return {
    backgroundColor: getCategoryColor(classId),
  };
};

// 格式化数字
const formatNumber = (num) => {
  return num ? num.toLocaleString() : "0";
};

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
</script>

<style lang="scss" scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f5f5f5;

  .upload-section {
    padding: 20px;
    background: white;
    border-bottom: 1px solid #eee;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    h2 {
      margin-bottom: 15px;
      color: #2c3e50;
    }

    .upload-controls {
      display: flex;
      gap: 20px;
      align-items: flex-end;
      flex-wrap: wrap;

      .file-upload-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 200px;

        label {
          font-weight: 500;
          color: #555;
        }

        input[type="file"] {
          padding: 5px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .file-name {
          font-size: 0.9rem;
          color: #666;
          font-style: italic;
        }
      }

      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;

        &-process {
          background-color: #27ae60;
          color: white;
          height: fit-content;

          &:hover:not(:disabled) {
            background-color: #219653;
          }

          &:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
          }
        }
      }
    }
  }

  .main-content {
    display: flex;
    flex: 1;
    padding: 20px;
    gap: 20px;
    overflow: hidden;

    &.has-data {
    }

    .image-section {
      flex: 3;
      display: flex;
      flex-direction: column;
      gap: 15px;

      .canvas-container {
        position: relative;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f0f0f0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: visible; /* 改为visible以显示延伸的扫描线 */
        max-width: 800px;
        max-height: 600px;
        min-height: 400px;

        .image-canvas,
        .mask-canvas,
        .scan-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .scan-line {
          position: absolute;
          z-index: 10;
          box-shadow: 0 0 5px rgba(255, 0, 0, 0.7);
          cursor: pointer;

          &.horizontal-scan-line {
            top: -10px; /* 延伸到容器上方 */
            width: 4px;
            height: calc(100% + 20px); /* 延伸到容器上下 */
            background: red;
            cursor: ew-resize; /* 水平拖拽光标 */
          }

          &.vertical-scan-line {
            left: -10px; /* 延伸到容器左侧 */
            width: calc(100% + 20px); /* 延伸到容器左右 */
            height: 4px;
            background: red;
            cursor: ns-resize; /* 垂直拖拽光标 */
          }
        }
      }

      .control-panel {
        display: flex;
        gap: 20px;
        padding: 15px;
        background: white;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        flex-wrap: wrap;

        .control-group {
          display: flex;
          align-items: center;
          gap: 10px;

          label {
            font-weight: 500;
            min-width: 80px;
          }

          select {
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }

          &.checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            min-width: auto;

            input[type="checkbox"] {
              margin: 0;
              width: 16px;
              height: 16px;
            }
          }

          .scan-slider {
            width: 150px;
          }
        }
      }
    }

    .info-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 400px;
      overflow-y: auto;

      .panel-section {
        background: white;
        border-radius: 6px;
        padding: 15px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

        h3 {
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
          color: #2c3e50;
          font-size: 1.1rem;
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;

          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #f5f5f5;

            label {
              font-weight: 500;
              color: #555;
            }
          }
        }

        .stats-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 300px;
          overflow-y: auto;

          .stat-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #eee;
            cursor: pointer;
            transition: background-color 0.2s;

            &:hover {
              background-color: #f9f9f9;
            }

            .color-indicator {
              width: 20px;
              height: 20px;
              border-radius: 4px;
              flex-shrink: 0;
              border: 1px solid #ddd;
            }

            .stat-details {
              flex: 1;

              .category-name {
                font-weight: 500;
                margin-bottom: 5px;
                color: #2c3e50;
              }

              .stat-values {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                font-size: 0.85rem;
                color: #666;

                span {
                  background: #f0f0f0;
                  padding: 2px 6px;
                  border-radius: 3px;
                }
              }
            }
          }

          .no-data {
            text-align: center;
            color: #999;
            padding: 20px;
            font-style: italic;
          }
        }

        .legend-container {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 5px 0;

            .legend-color {
              width: 16px;
              height: 16px;
              border-radius: 3px;
              border: 1px solid #ddd;
            }

            .legend-label {
              font-size: 0.9rem;
              color: #555;
            }
          }
        }
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      color: #666;

      .empty-icon {
        font-size: 4rem;
        margin-bottom: 20px;
        opacity: 0.5;
      }

      h3 {
        margin-bottom: 10px;
        color: #2c3e50;
      }

      p {
        max-width: 400px;
        line-height: 1.5;
      }
    }
  }

  .error-message {
    background-color: #e74c3c;
    color: white;
    padding: 10px 15px;
    margin: 10px 20px;
    border-radius: 4px;
    text-align: center;
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    color: white;

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
      margin-bottom: 15px;
    }

    p {
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1024px) {
  .app-container {
    .main-content {
      flex-direction: column;

      .info-panel {
        max-width: 100%;
      }

      .image-section {
        .canvas-container {
          max-height: 400px;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .app-container {
    .upload-section {
      .upload-controls {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    .main-content {
      .image-section {
        .control-panel {
          flex-direction: column;
          align-items: flex-start;

          .control-group {
            width: 100%;
            justify-content: space-between;

            .scan-slider {
              width: 100%;
            }
          }
        }
      }
    }
  }
}
</style>
