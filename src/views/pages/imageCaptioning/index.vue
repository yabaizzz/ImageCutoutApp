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
        <!-- 已移除加载演示数据按钮 -->
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
          <div
            class="scan-line"
            :style="scanLineStyle"
            v-show="showScanEffect"
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

          <!-- 扫描位置控制（仅在显示扫描效果时显示） -->
          <div class="control-group" v-if="showScanEffect">
            <label>扫描位置:</label>
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
            <!-- 已移除开始扫描按钮 -->
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
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";

// 响应式数据
const imageFile = ref(null);
const textFile = ref(null);
const originalImage = ref(null);
const maskData = ref([]);
const imageInfo = ref({
  name: "",
  width: 0,
  height: 0,
  size: "",
});
const statistics = ref([]);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const maskOpacity = ref(0.5); // 默认50%透明度
const scanPosition = ref(0); // 默认扫描位置为0（最左侧）
const isLoading = ref(false);
const errorMessage = ref("");
const originalMaskData = ref([]);
const showScanEffect = ref(false);

// Canvas 引用
const originalCanvas = ref(null);
const maskCanvas = ref(null);
const scanCanvas = ref(null);
const canvasContainer = ref(null);

// 标记 Canvas 是否已初始化
const canvasInitialized = ref(false);

// 颜色编码表
const colorMap = {
  0: { name: "城市土地", color: "rgba(0, 255, 255, 0.5)" },
  1: { name: "农业用地", color: "rgba(255, 255, 0, 0.5)" },
  2: { name: "牧场", color: "rgba(255, 0, 255, 0.5)" },
  3: { name: "森林", color: "rgba(0, 255, 0, 0.5)" },
  4: { name: "水系", color: "rgba(0, 0, 255, 0.5)" },
  5: { name: "荒地", color: "rgba(255, 255, 255, 0.5)" },
  6: { name: "未知土地", color: "rgba(0, 0, 0, 0.5)" },
};

// 计算属性
const hasFiles = computed(() => imageFile.value && textFile.value);
const hasData = computed(
  () => originalImage.value && maskData.value.length > 0
);
const scanLineStyle = computed(() => ({
  left: `${scanPosition.value}%`,
}));

// 监听 Canvas 引用变化
watch([originalCanvas, maskCanvas, scanCanvas], () => {
  if (originalCanvas.value && maskCanvas.value && scanCanvas.value) {
    initializeCanvasContexts();
  }
});

// 生命周期
onMounted(() => {
  setTimeout(() => {
    if (originalCanvas.value && maskCanvas.value && scanCanvas.value) {
      initializeCanvasContexts();
    }
  }, 300);
});

// 初始化 Canvas 上下文
const initializeCanvasContexts = () => {
  try {
    if (originalCanvas.value) {
      originalCanvas.value.getContext("2d");
    }

    if (maskCanvas.value) {
      maskCanvas.value.getContext("2d");
    }

    if (scanCanvas.value) {
      scanCanvas.value.getContext("2d");
    }

    canvasInitialized.value = true;
    console.log("Canvas contexts initialized successfully");
  } catch (error) {
    console.error("Failed to initialize canvas contexts:", error);
    errorMessage.value = "Canvas初始化失败: " + error.message;
  }
};

// 安全地获取 Canvas 上下文
const getSafeCanvasContext = (canvasElement, contextName = "canvas") => {
  if (!canvasElement) {
    throw new Error(`${contextName} element is not available`);
  }

  const context = canvasElement.getContext("2d");
  if (!context) {
    throw new Error(`${contextName} context is not available`);
  }

  return context;
};

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.match("image.*")) {
    errorMessage.value = "请选择图像文件 (PNG, JPG, JPEG)";
    return;
  }

  imageFile.value = file;
  imageInfo.value.name = file.name;
  imageInfo.value.size = formatFileSize(file.size);
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

// 处理扫描效果切换
const handleScanEffectToggle = () => {
  if (showScanEffect.value) {
    // 开启扫描时，重置扫描位置到最左侧
    scanPosition.value = 0;
    updateScanLine();
  } else {
    // 关闭扫描时，清除扫描效果
    clearScanMask();
  }
};

const processFiles = async () => {
  if (!hasFiles.value) {
    errorMessage.value = "请选择图像文件和标注文件";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 确保 Canvas 已初始化
    if (!canvasInitialized.value) {
      initializeCanvasContexts();
    }

    // 1. 先加载图像显示
    await loadImage();

    await parseTextAnnotations();

    calculateStatistics();

    // 根据是否开启扫描效果来决定如何渲染
    if (showScanEffect.value) {
      updateScanLine();
    } else {
      renderMask();
    }
  } catch (error) {
    console.error("处理文件失败:", error);
    errorMessage.value = `处理文件失败: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
};

const loadImage = () => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      originalImage.value = img;
      canvasWidth.value = img.width;
      canvasHeight.value = img.height;

      setupCanvases();

      try {
        const ctx = getSafeCanvasContext(originalCanvas.value, "Original");
        ctx.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value);

        imageInfo.value.width = img.width;
        imageInfo.value.height = img.height;

        resolve();
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("图像加载失败"));
    };

    img.src = URL.createObjectURL(imageFile.value);
  });
};

const parseTextAnnotations = () => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const textContent = e.target.result;
        const lines = textContent.trim().split("\n");
        const annotations = [];

        lines.forEach((line, index) => {
          if (line.trim() === "") return;

          const values = line.trim().split(/\s+/).map(Number);

          if (values.some(isNaN)) {
            console.warn(`第${index + 1}行包含无效数字: ${line}`);
            return;
          }

          const classId = values[0];

          if (values.length === 5) {
            // 边界框格式: classId x_center y_center width height
            annotations.push({
              classId,
              type: "bbox",
              bbox: {
                x: values[1] - values[3] / 2,
                y: values[2] - values[4] / 2,
                width: values[3],
                height: values[4],
              },
              boundingBox: {
                x: values[1] - values[3] / 2,
                y: values[2] - values[4] / 2,
                width: values[3],
                height: values[4],
              },
            });
          } else if (values.length > 5 && (values.length - 1) % 2 === 0) {
            // 多边形格式: classId x1 y1 x2 y2 ...
            const points = [];
            for (let i = 1; i < values.length; i += 2) {
              if (i + 1 < values.length) {
                points.push({ x: values[i], y: values[i + 1] });
              }
            }

            const bbox = calculateBoundingBox(points);

            annotations.push({
              classId,
              type: "polygon",
              points,
              boundingBox: bbox,
            });
          } else {
            console.warn(`第${index + 1}行格式不支持: ${line}`);
          }
        });

        if (annotations.length === 0) {
          reject(new Error("未找到有效的标注数据"));
          return;
        }

        maskData.value = annotations;
        originalMaskData.value = [...annotations];
        resolve();
      } catch (error) {
        reject(new Error(`解析标注文件失败: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("读取标注文件失败"));
    };

    reader.readAsText(textFile.value);
  });
};

const calculateBoundingBox = (points) => {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// 修改setupCanvases函数，确保Canvas层级正确
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

  // 确保Canvas层级正确：原图在最底层，掩码在中间，扫描遮罩在最顶层
  if (originalCanvas.value) {
    originalCanvas.value.style.zIndex = "1";
  }
  if (maskCanvas.value) {
    maskCanvas.value.style.zIndex = "2";
  }
  if (scanCanvas.value) {
    scanCanvas.value.style.zIndex = "3";
  }
};

const renderMask = () => {
  try {
    const ctx = getSafeCanvasContext(maskCanvas.value, "Mask");
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

    // 只在非扫描模式下绘制完整的掩码（包括边界框）
    if (!showScanEffect.value) {
      maskData.value.forEach((mask) => {
        const color = getCategoryColor(mask.classId);

        if (mask.type === "polygon") {
          drawPolygonMask(ctx, mask.points, color);
          drawBoundingBox(ctx, mask.boundingBox, color, mask.classId);
        } else if (mask.type === "bbox") {
          drawBoundingBoxMask(ctx, mask.bbox, color);
          drawBoundingBox(ctx, mask.boundingBox, color, mask.classId);
        }
      });

      // 确保掩码Canvas的透明度正确设置
      maskCanvas.value.style.opacity = maskOpacity.value;
    }

    // 如果扫描效果开启，更新扫描显示
    if (showScanEffect.value) {
      updateScanLine();
    }
  } catch (error) {
    console.error("渲染掩码失败:", error);
    errorMessage.value = `渲染掩码失败: ${error.message}`;
  }
};

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
const drawBoundingBox = (ctx, bbox, color, classId) => {
  // 绘制边界框
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1.0;

  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  ctx.strokeRect(x, y, width, height);

  // 在边界框左上角添加类别ID标签
  drawClassIdLabel(ctx, x, y, width, height, classId, color);

  ctx.globalAlpha = maskOpacity.value;
};

// 绘制类别ID标签
const drawClassIdLabel = (ctx, x, y, width, height, classId, color) => {
  const label = classId.toString();
  const padding = 5;

  // 根据边界框大小自适应字体大小
  const minDimension = Math.min(width, height);
  const baseFontSize = Math.max(12, Math.min(24, minDimension * 0.15));
  const fontSize = Math.round(baseFontSize);

  ctx.font = `bold ${fontSize}px Arial`;
  const textWidth = ctx.measureText(label).width;

  // 标签背景尺寸，根据字体大小调整
  const labelWidth = textWidth + padding * 2;
  const labelHeight = fontSize + padding * 2;

  // 绘制标签背景
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(x, y, labelWidth, labelHeight);

  // 绘制边框
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, labelWidth, labelHeight);

  // 绘制文本
  ctx.fillStyle = "#333";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + padding, y + padding);
};

const calculateStatistics = () => {
  const statsMap = {};

  maskData.value.forEach((mask) => {
    const classId = mask.classId;
    if (!statsMap[classId]) {
      statsMap[classId] = {
        classId,
        count: 0,
        area: 0,
        perimeter: 0,
      };
    }

    statsMap[classId].count++;

    let area = 0;
    if (mask.type === "polygon") {
      area = calculatePolygonArea(mask.points);
    } else if (mask.type === "bbox") {
      area =
        mask.bbox.width *
        mask.bbox.height *
        canvasWidth.value *
        canvasHeight.value;
    }
    statsMap[classId].area += Math.round(area);

    if (mask.type === "polygon") {
      const perimeter = calculatePolygonPerimeter(mask.points);
      statsMap[classId].perimeter += Math.round(perimeter);
    }
  });

  statistics.value = Object.values(statsMap);
};

const calculatePolygonArea = (points) => {
  if (!points || points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  area = Math.abs(area) / 2;
  return area * canvasWidth.value * canvasHeight.value;
};

const calculatePolygonPerimeter = (points) => {
  if (!points || points.length < 2) return 0;

  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = (points[j].x - points[i].x) * canvasWidth.value;
    const dy = (points[j].y - points[i].y) * canvasHeight.value;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
};

const updateScanLine = () => {
  updateScanMask();
};

// 更新扫描遮罩 - 重新设计逻辑
const updateScanMask = () => {
  try {
    const ctx = getSafeCanvasContext(scanCanvas.value, "Scan");
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

    if (showScanEffect.value) {
      const scanX = (scanPosition.value / 100) * canvasWidth.value;

      // 方法1：直接控制掩码Canvas的显示区域
      // 使用剪辑区域只显示扫描线右侧的掩码
      ctx.save();
      // 设置剪辑区域为扫描线右侧
      ctx.beginPath();
      ctx.rect(scanX, 0, canvasWidth.value - scanX, canvasHeight.value);
      ctx.clip();

      // 重新绘制掩码到扫描Canvas上，但不绘制边界框
      maskData.value.forEach((mask) => {
        const color = getCategoryColor(mask.classId);

        if (mask.type === "polygon") {
          drawPolygonScanMask(ctx, mask.points, color);
        } else if (mask.type === "bbox") {
          drawBoundingBoxScanMask(ctx, mask.bbox, color);
        }
      });

      ctx.restore();

      // 隐藏原始的掩码Canvas，只显示扫描Canvas上的掩码
      if (maskCanvas.value) {
        maskCanvas.value.style.opacity = 0;
      }
    } else {
      // 扫描效果关闭时，显示原始掩码Canvas
      if (maskCanvas.value) {
        maskCanvas.value.style.opacity = maskOpacity.value;
      }
    }
  } catch (error) {
    console.error("更新扫描遮罩失败:", error);
  }
};

// 绘制多边形扫描掩码（不绘制边界框）
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

// 绘制边界框扫描掩码（不绘制边界框）
const drawBoundingBoxScanMask = (ctx, bbox, color) => {
  ctx.fillStyle = color;
  ctx.globalAlpha = maskOpacity.value;

  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  ctx.fillRect(x, y, width, height);
};

// 清除扫描遮罩
const clearScanMask = () => {
  try {
    const ctx = getSafeCanvasContext(scanCanvas.value, "Scan");
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

    // 恢复原始掩码Canvas的显示
    if (maskCanvas.value) {
      maskCanvas.value.style.opacity = maskOpacity.value;
    }
  } catch (error) {
    console.error("清除扫描遮罩失败:", error);
  }
};

const highlightCategory = (classId) => {
  if (!originalMaskData.value.length) {
    originalMaskData.value = [...maskData.value];
  }
  maskData.value = originalMaskData.value.filter(
    (mask) => mask.classId === classId
  );
  renderMask();
};

const resetHighlight = () => {
  if (originalMaskData.value.length) {
    maskData.value = [...originalMaskData.value];
    renderMask();
  }
};

const getCategoryColor = (classId) => {
  return colorMap[classId]?.color || "rgba(128, 128, 128, 0.5)";
};

const getCategoryName = (classId) => {
  return colorMap[classId]?.name || `类别 ${classId}`;
};

const getColorStyle = (classId) => {
  return {
    backgroundColor: getCategoryColor(classId),
  };
};

const formatNumber = (num) => {
  return num ? num.toLocaleString() : "0";
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
</script>

<style lang="scss" scoped>
// 根容器：嵌套所有子组件样式
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f5f5f5;

  // 1. 文件上传区域：嵌套内部元素样式
  .upload-section {
    padding: 20px;
    background: white;
    border-bottom: 1px solid #eee;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    h2 {
      margin-bottom: 15px;
      color: #2c3e50;
    }

    // 上传控制区：嵌套文件组和按钮
    .upload-controls {
      display: flex;
      gap: 20px;
      align-items: flex-end;
      flex-wrap: wrap;

      // 文件上传组：嵌套标签、输入框、文件名
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

      // 按钮：嵌套所有按钮变体
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;

        // 主要按钮（处理文件）
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

        // 次要按钮（加载演示数据）
        &-secondary {
          background-color: #95a5a6;
          color: white;

          &:hover {
            background-color: #7f8c8d;
          }
        }

        // 扫描按钮（开始/停止扫描）
        &-scan {
          background-color: #e74c3c;
          color: white;

          &:hover {
            background-color: #c0392b;
          }
        }
      }
    }
  }

  // 2. 主内容区域：嵌套左侧图像区、右侧信息面板、空状态
  .main-content {
    display: flex;
    flex: 1;
    padding: 20px;
    gap: 20px;
    overflow: hidden;

    // 有数据时的额外样式（嵌套组合选择器）
    &.has-data {
      // 原样式为空，保留层级占位
    }

    // 左侧图像显示区：嵌套画布容器、控制面板
    .image-section {
      flex: 3;
      display: flex;
      flex-direction: column;
      gap: 15px;

      // 画布容器：嵌套所有canvas和扫描线
      .canvas-container {
        position: relative;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f0f0f0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        max-width: 800px;
        max-height: 600px;
        min-height: 400px;

        // 三层canvas：绝对定位保持一致
        .image-canvas,
        .mask-canvas,
        .scan-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        // 扫描线：嵌套样式
        .scan-line {
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background: red;
          pointer-events: none;
          z-index: 10;
          box-shadow: 0 0 5px rgba(255, 0, 0, 0.7);
        }
      }

      // 控制面板：嵌套控制组
      .control-panel {
        display: flex;
        gap: 20px;
        padding: 15px;
        background: white;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        flex-wrap: wrap;

        // 控制组：嵌套标签、输入框、按钮
        .control-group {
          display: flex;
          align-items: center;
          gap: 10px;

          label {
            font-weight: 500;
            min-width: 80px;
          }

          // 复选框标签：嵌套复选框
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

          // 扫描滑块：单独样式
          .scan-slider {
            width: 150px;
          }
        }
      }
    }

    // 右侧信息面板：嵌套所有面板区块
    .info-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 400px;
      overflow-y: auto;

      // 面板区块：嵌套标题、内容区
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

        // 图像信息网格：嵌套信息项
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

        // 统计容器：嵌套统计项、空状态
        .stats-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 300px;
          overflow-y: auto;

          // 统计项：嵌套颜色指示器、详情
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

              // 统计值：嵌套span
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

          // 无数据提示
          .no-data {
            text-align: center;
            color: #999;
            padding: 20px;
            font-style: italic;
          }
        }

        // 图例容器：嵌套图例项
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

    // 空状态提示：单独样式
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

  // 3. 错误提示：单独样式
  .error-message {
    background-color: #e74c3c;
    color: white;
    padding: 10px 15px;
    margin: 10px 20px;
    border-radius: 4px;
    text-align: center;
  }

  // 4. 加载遮罩：嵌套加载动画、文字
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
      // 继承父级color: white，无需额外样式
    }
  }
}

// 全局动画：独立于嵌套（动画不支持嵌套）
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 媒体查询：按屏幕尺寸嵌套对应组件样式
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
