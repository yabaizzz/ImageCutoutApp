<template>
  <div class="annotator-container">
    <!-- 标题与说明 -->
    <div class="header">
      <h2>多格式标注工具（支持多边形+边界框）</h2>
    </div>

    <!-- 文件上传区域 -->
    <div class="file-upload">
      <div class="upload-group">
        <label>图像文件：</label>
        <input
          type="file"
          accept="image/*"
          @change="handleImageUpload"
          class="file-input"
        />
        <span v-if="imageFile">{{ imageFile.name }}</span>
      </div>

      <div class="upload-group">
        <label>标注文件（TXT）：</label>
        <input
          type="file"
          accept=".txt"
          @change="handleTextUpload"
          class="file-input"
        />
        <span v-if="textFile">{{ textFile.name }}</span>
      </div>

      <button
        @click="processFiles"
        :disabled="!hasFiles || isLoading"
        class="process-btn"
      >
        <span v-if="!isLoading">处理文件</span>
        <span v-if="isLoading">处理中...</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <!-- 图像与标注显示区域：用v-show替代v-if，确保Canvas始终存在于DOM -->
    <div v-show="hasData" class="canvas-container" ref="canvasContainer">
      <div class="canvas-wrapper">
        <!-- 原始图像Canvas：ref绑定确保正确 -->
        <canvas ref="originalCanvas" class="canvas-layer"></canvas>
        <!-- 标注渲染Canvas -->
        <canvas ref="annotationCanvas" class="canvas-layer"></canvas>
      </div>

      <!-- 控制区域 -->
      <div class="controls">
        <div class="control-group">
          <label>标注透明度：</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            v-model="annotationOpacity"
            @input="renderAnnotations"
          />
          <span>{{ annotationOpacity.toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div v-if="hasData && statistics.length" class="statistics">
      <h3>类别统计</h3>
      <table>
        <thead>
          <tr>
            <th>类别ID</th>
            <th>类别名称</th>
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in statistics" :key="stat.classId">
            <td>{{ stat.classId }}</td>
            <td>
              <span
                :style="getColorStyle(stat.classId)"
                class="color-indicator"
              ></span>
              {{ getCategoryName(stat.classId) }}
            </td>
            <td>{{ stat.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <h3>类别图例</h3>
      <div class="legend-item" v-for="(item, id) in colorMap" :key="id">
        <span :style="{ backgroundColor: item.color }" class="color-box"></span>
        <span>{{ id }}: {{ item.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";

// 1. 颜色编码表
const colorMap = ref({
  0: { name: "城市土地", color: "rgba(0, 255, 255, 0.5)" },
  1: { name: "农业用地", color: "rgba(255, 255, 0, 0.5)" },
  2: { name: "牧场", color: "rgba(255, 0, 255, 0.5)" },
  3: { name: "森林", color: "rgba(0, 255, 0, 0.5)" },
  4: { name: "水系", color: "rgba(0, 0, 255, 0.5)" },
  5: { name: "荒地", color: "rgba(255, 255, 255, 0.5)" },
  6: { name: "未知土地", color: "rgba(0, 0, 0, 0.5)" },
  45: { name: "自定义类别45", color: "rgba(255, 165, 0, 0.5)" },
  50: { name: "自定义类别50", color: "rgba(128, 0, 128, 0.5)" },
});

// 2. 响应式数据
const imageFile = ref(null);
const textFile = ref(null);
const originalImage = ref(null);
const annotationData = ref([]);
const statistics = ref([]);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const annotationOpacity = ref(0.5);
const isLoading = ref(false);
const errorMessage = ref("");

// 3. DOM引用（确保与模板ref完全一致）
const originalCanvas = ref(null); // 原始图像Canvas
const annotationCanvas = ref(null); // 标注渲染Canvas
const canvasContainer = ref(null);

// 4. 计算属性
const hasFiles = computed(() => imageFile.value && textFile.value);
const hasData = computed(
  () => originalImage.value && annotationData.value.length > 0
);

// 5. 初始化Canvas（确保DOM加载后执行）
onMounted(() => {
  // 组件挂载后，等待DOM渲染完成
  nextTick(() => {
    // 即使hasData为false，Canvas元素已通过v-show存在，可获取ref
    if (originalCanvas.value && annotationCanvas.value) {
      initializeCanvases();
    } else {
      errorMessage.value = "Canvas元素未找到，请检查模板中的ref绑定";
    }
  });
});

// 初始化Canvas上下文
const initializeCanvases = () => {
  try {
    originalCanvas.value.getContext("2d");
    annotationCanvas.value.getContext("2d");
  } catch (error) {
    errorMessage.value = "Canvas初始化失败: " + error.message;
  }
};

// 安全获取Canvas上下文（关键：确保调用时Canvas已存在）
const getSafeContext = (canvas, name) => {
  if (!canvas) {
    // 详细错误提示，帮助定位问题
    throw new Error(
      `${name} Canvas元素未找到！请检查：1.模板中ref是否为"${name.toLowerCase()}"；2.元素是否被v-if隐藏`
    );
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`${name} Canvas上下文获取失败`);
  return ctx;
};

// 6. 文件上传处理
const handleImageUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.match("image.*")) {
    errorMessage.value = "请选择图像文件（PNG/JPG/JPEG）";
    return;
  }
  imageFile.value = file;
  errorMessage.value = "";
};

const handleTextUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.endsWith(".txt")) {
    errorMessage.value = "请选择TXT格式的标注文件";
    return;
  }
  textFile.value = file;
  errorMessage.value = "";
};

// 7. 核心处理逻辑（调整执行顺序，确保Canvas存在）
const processFiles = async () => {
  if (!hasFiles.value) {
    errorMessage.value = "请先选择图像文件和TXT标注文件";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 步骤0：确保Canvas已渲染（关键修复）
    await nextTick(); // 等待DOM更新，确保Canvas元素存在
    if (!originalCanvas.value || !annotationCanvas.value) {
      throw new Error("Canvas元素未渲染，请刷新页面重试");
    }

    // 步骤1：加载图像
    await loadImage();

    // 步骤2：解析TXT
    await parseAnnotationsTXT();

    // 步骤3：计算统计
    calculateStats();

    // 步骤4：渲染标注
    renderAnnotations();
  } catch (error) {
    errorMessage.value = `处理失败: ${error.message}`;
    console.error("处理错误:", error);
  } finally {
    isLoading.value = false;
  }
};

// 8. 加载图像（确保Canvas已存在）
const loadImage = () => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      originalImage.value = img;
      canvasWidth.value = img.naturalWidth;
      canvasHeight.value = img.naturalHeight;
      resizeCanvases();

      // 绘制原始图像（此时Canvas已存在）
      const ctx = getSafeContext(originalCanvas.value, "原始图像");
      ctx.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value);
      resolve();
    };
    img.onerror = () => reject(new Error("图像加载失败，请检查文件是否有效"));
    img.src = URL.createObjectURL(imageFile.value);
  });
};

// 调整Canvas尺寸
const resizeCanvases = () => {
  if (!originalCanvas.value || !annotationCanvas.value) return;

  // 设置Canvas实际绘图尺寸
  originalCanvas.value.width = canvasWidth.value;
  originalCanvas.value.height = canvasHeight.value;
  annotationCanvas.value.width = canvasWidth.value;
  annotationCanvas.value.height = canvasHeight.value;

  // 限制容器大小
  if (canvasContainer.value) {
    canvasContainer.value.style.maxWidth = "1000px";
    canvasContainer.value.style.overflow = "auto";
  }
};

// 9. 解析TXT（自动识别格式）
const parseAnnotationsTXT = () => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.trim().split("\n");
        const annotations = [];

        lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          const values = trimmed.split(/\s+/).map(Number);
          if (values.some(isNaN)) {
            console.warn(`第${index + 1}行包含无效数字，已跳过: ${trimmed}`);
            return;
          }

          const classId = values[0];
          // 边界框（5个值）或多边形（≥7个值且成对）
          if (values.length === 5) {
            // 边界框：classId + x_center + y_center + width + height
            const [, xCenter, yCenter, width, height] = values;
            const x = xCenter - width / 2;
            const y = yCenter - height / 2;
            annotations.push({
              classId,
              type: "bbox",
              bbox: { x, y, width, height },
            });
          } else if (values.length >= 7 && (values.length - 1) % 2 === 0) {
            // 多边形：classId + 多组(x,y)
            const points = [];
            for (let i = 1; i < values.length; i += 2) {
              points.push({ x: values[i], y: values[i + 1] });
            }
            annotations.push({
              classId,
              type: "polygon",
              points,
            });
          } else {
            console.warn(`第${index + 1}行格式不支持，已跳过: ${trimmed}`);
          }
        });

        if (annotations.length === 0) {
          reject(new Error("未解析到有效标注数据"));
          return;
        }

        annotationData.value = annotations;
        resolve();
      } catch (error) {
        reject(new Error(`TXT解析错误: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error("TXT文件读取失败"));
    reader.readAsText(textFile.value);
  });
};

// 10. 渲染标注
const renderAnnotations = () => {
  if (!hasData.value) return;

  try {
    const ctx = getSafeContext(annotationCanvas.value, "标注");
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
    ctx.globalAlpha = annotationOpacity.value;

    annotationData.value.forEach((item) => {
      const { classId, type, points, bbox } = item;
      const color =
        colorMap.value[classId]?.color || "rgba(128, 128, 128, 0.5)";

      if (type === "polygon") {
        drawPolygon(ctx, points, color);
      } else if (type === "bbox") {
        drawBoundingBox(ctx, bbox, color, classId);
      }
    });
  } catch (error) {
    errorMessage.value = `渲染失败: ${error.message}`;
  }
};

// 绘制多边形
const drawPolygon = (ctx, points, color) => {
  if (!points || points.length < 3) return;

  ctx.fillStyle = color;
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
  // 绘制多边形边框
  ctx.strokeStyle = color.replace("0.5", "1"); // 边框不透明
  ctx.lineWidth = 2;
  ctx.stroke();
};

// 绘制边界框
const drawBoundingBox = (ctx, bbox, color, classId) => {
  ctx.strokeStyle = color.replace("0.5", "1"); // 边框不透明
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1.0;

  const x = bbox.x * canvasWidth.value;
  const y = bbox.y * canvasHeight.value;
  const width = bbox.width * canvasWidth.value;
  const height = bbox.height * canvasHeight.value;

  ctx.strokeRect(x, y, width, height);
  drawClassLabel(ctx, x, y, classId, color);
};

// 绘制类别标签
const drawClassLabel = (ctx, x, y, classId, color) => {
  const label = classId.toString();
  const padding = 3;
  const fontSize = 12;

  ctx.font = `bold ${fontSize}px Arial`;
  const textWidth = ctx.measureText(label).width;
  const labelWidth = textWidth + padding * 2;
  const labelHeight = fontSize + padding * 2;

  const labelX = Math.min(x, canvasWidth.value - labelWidth);
  const labelY = Math.min(y, canvasHeight.value - labelHeight);

  ctx.fillStyle = "white";
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
  ctx.strokeStyle = color.replace("0.5", "1");
  ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);
  ctx.fillStyle = "black";
  ctx.textBaseline = "top";
  ctx.fillText(label, labelX + padding, labelY + padding);
};

// 11. 计算统计
const calculateStats = () => {
  const statsMap = {};
  annotationData.value.forEach((item) => {
    const { classId } = item;
    statsMap[classId] = (statsMap[classId] || 0) + 1;
  });
  statistics.value = Object.entries(statsMap)
    .map(([classId, count]) => ({
      classId: Number(classId),
      count,
    }))
    .sort((a, b) => a.classId - b.classId);
};

// 12. 工具函数
const getCategoryName = (classId) => {
  return colorMap.value[classId]?.name || `未知类别(${classId})`;
};

const getColorStyle = (classId) => {
  return {
    backgroundColor:
      colorMap.value[classId]?.color || "rgba(128, 128, 128, 0.5)",
    border: "1px solid #333",
  };
};
</script>

<style scoped>
/* 样式与之前保持一致 */
.annotator-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.header {
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.file-upload {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
  align-items: center;
}

.upload-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-input {
  padding: 5px;
}

.process-btn {
  padding: 8px 16px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.process-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: #ff4444;
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ffdddd;
  border-radius: 4px;
}

.canvas-container {
  margin: 20px 0;
  /* 初始隐藏（v-show="false"时生效） */
  display: none;
}

/* v-show="true"时显示 */
.canvas-container[v-show="true"] {
  display: block;
}

.canvas-wrapper {
  position: relative;
  display: inline-block;
  border: 1px solid #ccc;
}

.canvas-layer {
  position: absolute;
  top: 0;
  left: 0;
}

.controls {
  margin-top: 10px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.statistics {
  margin: 20px 0;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}

.statistics table {
  width: 100%;
  border-collapse: collapse;
}

.statistics th,
.statistics td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.statistics th {
  background: #f9f9f9;
}

.legend {
  margin: 20px 0;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 5px 0;
}

.color-box,
.color-indicator {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 1px solid #333;
}
</style>
