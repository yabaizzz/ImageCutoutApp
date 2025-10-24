<template>
  <div class="image-processing-container">
    <!-- 页面标题 -->
    <h2 class="page-title">特殊图像处理工具</h2>

    <!-- 1. 文件上传区域 -->
    <div class="upload-section">
      <el-upload
        class="upload-file"
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :file-list="fileList"
        :accept="'.png,.jpg,.jpeg'"
        list-type="text"
      >
        <el-button size="default" type="primary">
          <el-icon><UploadFilled /></el-icon> 选择特殊图像文件（演示用）
        </el-button>
      </el-upload>
    </div>

    <!-- 2. 滤波参数控制区域（处理后显示） -->
    <div v-if="showFilterControls" class="filter-controls-section">
      <el-card shadow="hover" class="filter-card">
        <div class="card-header">滤波参数设置</div>
        <div class="filter-form">
          <el-form :model="filterParams" inline class="param-form">
            <el-form-item label="最小区域面积（像素）：" label-width="170px">
              <el-input
                v-model.number="filterParams.minArea"
                type="number"
                min="0"
                step="100"
              />
            </el-form-item>
            <el-form-item label="最大长宽比：" label-width="100px">
              <el-input
                v-model.number="filterParams.maxAspectRatio"
                type="number"
                min="1"
                step="0.5"
              />
            </el-form-item>
            <el-form-item label="目标类别ID：" label-width="100px">
              <el-select
                style="width: 120px"
                v-model="filterParams.targetCategory"
                placeholder="选择类别"
              >
                <el-option label="全部类别" :value="-1" />
                <el-option label="类别0" :value="0" />
                <el-option label="类别1" :value="1" />
                <el-option label="类别2" :value="2" />
                <el-option label="类别3" :value="3" />
                <el-option label="类别4" :value="4" />
                <el-option label="类别5" :value="5" />
                <el-option label="类别6" :value="6" />
                <el-option label="类别7" :value="7" />
                <el-option label="类别8" :value="8" />
                <el-option label="类别9" :value="9" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-buttons">
            <el-button
              type="primary"
              size="small"
              @click="applyFilter"
              :loading="isFiltering"
            >
              应用滤波
            </el-button>
            <el-button type="default" size="small" @click="resetFilter">
              重置滤波
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 3. 结果渲染区域（处理后显示） -->
    <div v-if="showResult" class="result-render-section">
      <el-card shadow="hover" class="render-card">
        <div class="card-header">
          图像处理结果
          <span class="render-info" v-if="renderInfo">{{ renderInfo }}</span>
        </div>
        <div class="canvas-container">
          <canvas
            ref="renderCanvas"
            id="imageRenderCanvas"
            class="render-canvas"
          ></canvas>
          <el-empty
            v-if="!renderReady"
            description="正在渲染数据，请稍候..."
            class="empty-render"
          />
        </div>
      </el-card>

      <!-- 统计信息展示 -->
      <el-card shadow="hover" class="stats-card" v-if="showStats">
        <div class="card-header">类别统计信息</div>
        <el-table :data="filteredStats" border stripe class="stats-table">
          <el-table-column label="类别ID" prop="classId" align="center" />
          <el-table-column label="区域数量" prop="count" align="center" />
          <el-table-column label="总面积（像素）" prop="area" align="center" />
          <el-table-column
            label="总周长（像素）"
            prop="perimeter"
            align="center"
          />
          <el-table-column label="类别颜色" align="center">
            <template #default="scope">
              <div
                class="color-block"
                :style="{
                  backgroundColor: getCategoryColor(scope.row.classId),
                }"
              ></div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 标注文件下载 -->
      <div v-if="showDownload" class="download-section">
        <el-tooltip
          class="item"
          effect="dark"
          content="标注格式：类别ID 归一化x1 归一化y1 归一化x2 归一化y2 ..."
          placement="top"
        >
          <el-icon class="tooltip-icon"><QuestionFilled /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <!-- 4. 空状态 -->
    <div v-if="!showResult" class="empty-state">请先上传图片</div>

    <!-- 加载弹窗 -->
    <el-dialog
      title="处理中"
      v-model="showProcessDialog"
      :closable="false"
      width="30%"
    >
      <div class="process-loading">
        <p class="loading-text">{{ processText }}</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from "vue";

import { fileUpload2 } from "@/api/api.js";
import { ElMessage } from "element-plus";

// 1. 基础响应式数据
const fileList = ref([]);
const showProcessDialog = ref(false);
const processText = ref("");
const showFilterControls = ref(false);
const isFiltering = ref(false);
const showResult = ref(false);
const renderReady = ref(false);
const showDownload = ref(false);
const showStats = ref(false);
const renderCanvas = ref(null);
const renderInfo = ref("");

// 2. 图像处理相关数据
const imgWidth = ref(null);
const imgHeight = ref(null);
const coloredImageData = ref(null);
const allRegions = ref([]);
const filteredRegions = ref([]);
const allStats = ref([]);
const filteredStats = ref([]);
const annotationText = ref("");

// 3. 类别-颜色映射表
const categoryColorMap = ref({
  0: { rgb: [0, 0, 0], name: "类别0（示例：建筑区）" },
  1: { rgb: [255, 255, 0], name: "类别1（示例：植被区）" },
  2: { rgb: [255, 0, 255], name: "类别2（示例：水域）" },
  3: { rgb: [0, 255, 0], name: "类别3（示例：裸地）" },
  4: { rgb: [0, 0, 255], name: "类别4（预留）" },
  5: { rgb: [255, 0, 0], name: "类别5（预留）" },
  6: { rgb: [0, 255, 255], name: "类别6（预留）" },
  7: { rgb: [255, 165, 0], name: "类别7（预留）" },
  8: { rgb: [128, 0, 128], name: "类别8（预留）" },
  9: { rgb: [128, 128, 0], name: "类别9（预留）" },
});

// 4. 滤波参数
const filterParams = ref({
  minArea: 100,
  maxAspectRatio: 10,
  targetCategory: -1,
});

// 新增：重置所有状态
const resetAllState = () => {
  // 重置基础状态
  showProcessDialog.value = false;
  processText.value = "";
  showFilterControls.value = false;
  isFiltering.value = false;
  showResult.value = false;
  renderReady.value = false;
  showDownload.value = false;
  showStats.value = false;
  renderInfo.value = "";

  // 重置图像数据
  imgWidth.value = null;
  imgHeight.value = null;
  coloredImageData.value = null;
  allRegions.value = [];
  filteredRegions.value = [];
  allStats.value = [];
  filteredStats.value = [];
  annotationText.value = "";

  // 重置滤波参数
  filterParams.value = {
    minArea: 100,
    maxAspectRatio: 10,
    targetCategory: -1,
  };

  // 清除Canvas
  if (renderCanvas.value) {
    const ctx = renderCanvas.value.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, renderCanvas.value.width, renderCanvas.value.height);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, renderCanvas.value.width, renderCanvas.value.height);
    }
  }
};

// 5. 文件上传处理 - 修复：使用异步确保弹窗立即显示
const handleFileChange = async (uploadFile) => {
  // 重置所有内容
  resetAllState();

  fileList.value = [uploadFile.raw];

  // 立即显示弹窗并更新文本
  showProcessDialog.value = true;
  processText.value = "开始上传图像...";

  // 使用nextTick确保DOM更新
  await nextTick();

  try {
    const res = await fileUpload2(uploadFile.raw);
    console.log("上传成功", res);

    // 确保弹窗仍然显示并更新状态
    processText.value = "开始处理图像数据...";
    await nextTick();

    await RenderData(res.data);
  } catch (error) {
    console.error("上传失败", error);
    showProcessDialog.value = false;
    ElMessage.error("上传失败: " + error.message);
  }
};

// 6. 核心：加载数据并渲染 - 优化：拆分大数据处理
const RenderData = async (mockData) => {
  try {
    imgWidth.value = mockData.imageInfo.width;
    imgHeight.value = mockData.imageInfo.height;

    // ========== 阶段1：解析数据 ==========
    processText.value = "正在解析数据（区域+统计）...";
    await nextTick();

    // 分批解析 maskData，避免阻塞
    await processRegionsInBatches(mockData.maskData);

    allStats.value = [...mockData.statistics];

    // 给 UI 一点喘息时间
    await sleep(50);

    // ========== 阶段2：应用默认滤波 ==========
    processText.value = "正在应用默认滤波参数...";
    await nextTick();
    await applyDefaultFilter();
    await sleep(50);

    // ========== 阶段3：生成彩色映射图像 ==========
    processText.value = "正在生成彩色映射图像...";
    await nextTick();
    await generateMockColoredImage(filteredRegions.value);
    await sleep(50);

    // ========== 阶段4：准备渲染 ==========
    processText.value = "正在准备渲染画布...";
    await nextTick();
    showResult.value = true;
    showFilterControls.value = true;
    await nextTick();

    let canvas =
      renderCanvas.value || document.getElementById("imageRenderCanvas");
    if (!canvas) throw new Error("Canvas元素未找到");
    renderCanvas.value = canvas;

    // ========== 阶段5：渲染 ==========
    processText.value = "正在渲染结果...";
    await nextTick();
    await initCanvasAndRender(canvas);

    // ========== 阶段6：收尾 ==========
    showDownload.value = true;
    showStats.value = true;
    generateAnnotationText();

    renderInfo.value = `显示 ${filteredRegions.value.length} 个区域（共 ${allRegions.value.length} 个）`;

    // 延时关闭弹窗，保证“处理完成”能看到
    processText.value = "处理完成！";
    await nextTick();
    await sleep(500);

    showProcessDialog.value = false;
    ElMessage.success(`处理完成，显示 ${filteredRegions.value.length} 个区域`);
  } catch (error) {
    console.error("数据加载失败：", error);
    processText.value = `加载失败：${error.message}`;
    await nextTick();
    await sleep(1000);
    showProcessDialog.value = false;
    ElMessage.error(`图像处理失败：${error.message}`);
  }
};

// 小辅助函数
const sleep = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

// 新增：分批次处理区域数据，避免UI卡顿
const processRegionsInBatches = async (maskData, batchSize = 50) => {
  const regions = [];

  for (let i = 0; i < maskData.length; i += batchSize) {
    const batch = maskData.slice(i, i + batchSize);

    // 定期更新进度文本
    if (i % 200 === 0) {
      processText.value = `正在解析数据... ${i}/${maskData.length}`;
      await nextTick();
    }

    const batchRegions = batch
      .map((region) => {
        const points = region.points || [];
        const boundingBox = region.boundingBox || calculateBoundingBox(points);

        const area = getRegionArea(points, imgWidth.value, imgHeight.value);
        const aspectRatio = calculateAspectRatio(
          boundingBox,
          imgWidth.value,
          imgHeight.value
        );

        const isValid =
          area > 0 &&
          aspectRatio >= 1 &&
          !isNaN(area) &&
          !isNaN(aspectRatio) &&
          isFinite(area) &&
          isFinite(aspectRatio) &&
          points.length >= 3;

        return {
          categoryId: region.classId,
          polygonVertices: points.map((point) => [point.x, point.y]),
          boundingBox: boundingBox,
          area: area,
          aspectRatio: aspectRatio,
          isValid: isValid,
        };
      })
      .filter((region) => region.isValid);

    regions.push(...batchRegions);
  }

  allRegions.value = regions;
};

// 应用默认滤波
const applyDefaultFilter = async () => {
  const minArea = Math.max(0, filterParams.value.minArea || 100);
  const maxAspectRatio = Math.max(1, filterParams.value.maxAspectRatio || 10);
  const targetCategory = filterParams.value.targetCategory;

  // 滤波区域
  const filtered = allRegions.value.filter((region) => {
    if (!region.isValid) return false;

    const categoryMatch =
      targetCategory === -1 || region.categoryId === targetCategory;
    const areaMatch = region.area >= minArea;
    const aspectRatioMatch = region.aspectRatio <= maxAspectRatio;

    return categoryMatch && areaMatch && aspectRatioMatch;
  });

  // 滤波统计
  const filteredStatsData =
    targetCategory === -1
      ? [...allStats.value]
      : allStats.value.filter((stat) => stat.classId === targetCategory);

  filteredRegions.value = filtered;
  filteredStats.value = filteredStatsData;
};

// 7. 计算边界框
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

  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);

  return {
    x: minX,
    y: minY,
    width: width,
    height: height,
  };
};

// 8. 生成彩色图像
const generateMockColoredImage = (regions) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = imgWidth.value;
    canvas.height = imgHeight.value;
    const ctx = canvas.getContext("2d");

    // 创建背景（浅灰色）
    const coloredData = ctx.createImageData(canvas.width, canvas.height);
    const data = coloredData.data;

    // 初始化背景为浅灰色
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 240; // R
      data[i + 1] = 240; // G
      data[i + 2] = 240; // B
      data[i + 3] = 255; // A
    }

    // 为每个区域填充颜色
    regions.forEach((region) => {
      if (!region.isValid) return;

      const { polygonVertices, categoryId } = region;
      const color = categoryColorMap.value[categoryId] || {
        rgb: [128, 128, 128],
      };

      // 创建临时Canvas来绘制多边形掩码
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext("2d");

      // 绘制多边形
      maskCtx.beginPath();
      let hasValidPoints = false;

      for (let i = 0; i < polygonVertices.length; i++) {
        const [x, y] = polygonVertices[i];
        const pixelX = x * canvas.width;
        const pixelY = y * canvas.height;

        if (
          isNaN(pixelX) ||
          isNaN(pixelY) ||
          !isFinite(pixelX) ||
          !isFinite(pixelY)
        ) {
          continue;
        }

        if (i === 0) {
          maskCtx.moveTo(pixelX, pixelY);
        } else {
          maskCtx.lineTo(pixelX, pixelY);
        }
        hasValidPoints = true;
      }

      if (hasValidPoints && polygonVertices.length >= 3) {
        maskCtx.closePath();
        maskCtx.fillStyle = "white";
        maskCtx.fill();

        const maskData = maskCtx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        for (let i = 0; i < maskData.data.length; i += 4) {
          if (maskData.data[i] > 128) {
            const pixelIndex = i;
            data[pixelIndex] = color.rgb[0];
            data[pixelIndex + 1] = color.rgb[1];
            data[pixelIndex + 2] = color.rgb[2];
            data[pixelIndex + 3] = 255;
          }
        }
      }
    });

    coloredImageData.value = coloredData;
    resolve();
  });
};

// 9. 辅助函数：计算区域面积
const getRegionArea = (points, width, height) => {
  if (!points || points.length < 3) return 0;

  const vertices = points.map((point) => [point.x * width, point.y * height]);
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const calculatedArea = Math.abs(area) / 2;

  return Math.max(
    0,
    isNaN(calculatedArea) || !isFinite(calculatedArea) ? 0 : calculatedArea
  );
};

// 10. 辅助函数：计算长宽比
const calculateAspectRatio = (bbox, width, height) => {
  const pixelWidth = bbox.width * width;
  const pixelHeight = bbox.height * height;

  if (pixelWidth <= 0 || pixelHeight <= 0) {
    return 1;
  }

  const ratio =
    pixelWidth > pixelHeight
      ? pixelWidth / pixelHeight
      : pixelHeight / pixelWidth;

  return Math.max(1, isNaN(ratio) || !isFinite(ratio) ? 1 : ratio);
};

// 11. 初始化Canvas并渲染结果
const initCanvasAndRender = (canvas) => {
  return new Promise((resolve, reject) => {
    try {
      if (!canvas) {
        reject(new Error("初始化Canvas失败：Canvas元素为空"));
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas上下文获取失败"));
        return;
      }

      // 设置Canvas尺寸
      const container = canvas.parentElement;
      const maxWidth = 800;
      const scale = Math.min(
        container.clientWidth / imgWidth.value,
        maxWidth / imgWidth.value,
        1
      );

      canvas.width = imgWidth.value * scale;
      canvas.height = imgHeight.value * scale;

      // 清除Canvas并正确绘制
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 创建临时Canvas用于缩放绘制
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imgWidth.value;
      tempCanvas.height = imgHeight.value;
      const tempCtx = tempCanvas.getContext("2d");

      // 在临时Canvas上绘制图像数据
      if (coloredImageData.value) {
        tempCtx.putImageData(coloredImageData.value, 0, 0);
      }

      // 在临时Canvas上绘制区域边界
      drawFilteredRegions(tempCtx);

      // 将临时Canvas内容缩放到主Canvas
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        imgWidth.value,
        imgHeight.value,
        0,
        0,
        canvas.width,
        canvas.height
      );

      renderReady.value = true;
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

// 12. 绘制滤波后区域 - 修复：去除红色虚线边界框和所有标注
const drawFilteredRegions = (ctx) => {
  const regions = filteredRegions.value;
  if (regions.length === 0) return;

  regions.forEach((region) => {
    if (!region.isValid) return;

    const { polygonVertices, categoryId } = region;
    const color = categoryColorMap.value[categoryId] || {
      rgb: [128, 128, 128],
    };

    // 只绘制多边形边界，不绘制边界框和标签
    ctx.save();
    ctx.beginPath();
    let hasValidPoints = false;

    for (let i = 0; i < polygonVertices.length; i++) {
      const [x, y] = polygonVertices[i];
      const pixelX = x * imgWidth.value;
      const pixelY = y * imgHeight.value;

      if (
        isNaN(pixelX) ||
        isNaN(pixelY) ||
        !isFinite(pixelX) ||
        !isFinite(pixelY)
      ) {
        continue;
      }

      if (i === 0) {
        ctx.moveTo(pixelX, pixelY);
      } else {
        ctx.lineTo(pixelX, pixelY);
      }
      hasValidPoints = true;
    }

    if (hasValidPoints && polygonVertices.length >= 3) {
      ctx.closePath();
      ctx.strokeStyle = `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // 注释掉边界框绘制代码，去除红色虚线
    // if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
    //   ctx.save();
    //   const bboxX = boundingBox.x * imgWidth.value;
    //   const bboxY = boundingBox.y * imgHeight.value;
    //   const bboxW = boundingBox.width * imgWidth.value;
    //   const bboxH = boundingBox.height * imgHeight.value;

    //   if (bboxW > 0 && bboxH > 0 && !isNaN(bboxX) && !isNaN(bboxY)) {
    //     ctx.strokeStyle = "#ff0000";
    //     ctx.lineWidth = 1.5;
    //     ctx.setLineDash([8, 4]);
    //     ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);
    //     ctx.setLineDash([]);
    //   }
    //   ctx.restore();
    // }
  });
};

// 13. 应用滤波
const applyFilter = async () => {
  if (allRegions.value.length === 0) {
    ElMessage.warning("错误：无区域数据可滤波，请重新加载数据！");
    return;
  }

  isFiltering.value = true;
  showProcessDialog.value = true;
  processText.value = "正在应用滤波...";
  await nextTick();

  try {
    const minArea = Math.max(0, filterParams.value.minArea || 100);
    const maxAspectRatio = Math.max(1, filterParams.value.maxAspectRatio || 10);
    const targetCategory = filterParams.value.targetCategory;

    // ========== 阶段1：滤波 ==========
    processText.value = "正在筛选有效区域...";
    await nextTick();
    await sleep(20);

    const filtered = allRegions.value.filter((region) => {
      if (!region.isValid) return false;

      const categoryMatch =
        targetCategory === -1 || region.categoryId === targetCategory;
      const areaMatch = region.area >= minArea;
      const aspectRatioMatch = region.aspectRatio <= maxAspectRatio;

      return categoryMatch && areaMatch && aspectRatioMatch;
    });

    const filteredStatsData =
      targetCategory === -1
        ? [...allStats.value]
        : allStats.value.filter((stat) => stat.classId === targetCategory);

    filteredRegions.value = filtered;
    filteredStats.value = filteredStatsData;
    await sleep(20);

    // ========== 阶段2：生成彩色图像 ==========
    processText.value = "正在重新生成彩色图像...";
    await nextTick();
    await generateMockColoredImage(filteredRegions.value);
    await sleep(30);

    // ========== 阶段3：渲染 Canvas ==========
    processText.value = "正在重新渲染滤波结果...";
    await nextTick();

    let canvas =
      renderCanvas.value || document.getElementById("imageRenderCanvas");
    if (!canvas) throw new Error("应用滤波时Canvas元素未找到");

    await initCanvasAndRender(canvas);
    await sleep(20);

    // ========== 阶段4：收尾 ==========
    generateAnnotationText();
    renderInfo.value = `显示 ${filtered.length} 个区域（共 ${allRegions.value.length} 个）`;

    processText.value = "滤波完成！";
    await nextTick();
    await sleep(300);

    showProcessDialog.value = false;
    isFiltering.value = false;

    const categoryText =
      targetCategory === -1 ? "全部类别" : `类别${targetCategory}`;
    ElMessage.success(
      `滤波完成：${categoryText}共保留${filtered.length}个有效区域`
    );
  } catch (error) {
    console.error("滤波失败：", error);
    processText.value = `滤波失败：${error.message}`;
    await nextTick();
    await sleep(1000);
    showProcessDialog.value = false;
    isFiltering.value = false;
    ElMessage.error(`滤波失败：${error.message}`);
  }
};

// 14. 重置滤波功能
const resetFilter = async () => {
  // 重置滤波参数为默认值
  filterParams.value = {
    minArea: 100,
    maxAspectRatio: 10,
    targetCategory: -1,
  };

  // 应用默认滤波
  await applyDefaultFilter();

  // 重新生成彩色图像和渲染
  await generateMockColoredImage(filteredRegions.value);

  if (renderCanvas.value) {
    await initCanvasAndRender(renderCanvas.value);
  }

  renderInfo.value = `显示 ${filteredRegions.value.length} 个区域（共 ${allRegions.value.length} 个）`;
  ElMessage.success("已重置滤波，显示默认滤波结果");
};

// 15. 生成标注文件内容
const generateAnnotationText = () => {
  let text = "";
  filteredRegions.value.forEach((region) => {
    if (!region.isValid) return;

    const parts = [region.categoryId];
    region.polygonVertices.forEach(([x, y]) => {
      parts.push(x.toFixed(6));
      parts.push(y.toFixed(6));
    });
    text += parts.join(" ") + "\n";
  });
  annotationText.value = text;
};

// 16. 辅助函数：获取类别颜色
const getCategoryColor = (classId) => {
  const color = categoryColorMap.value[classId] || { rgb: [128, 128, 128] };
  return `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
};

// 组件挂载初始化
onMounted(() => {});

// 监听showResult变化，确保Canvas生成后初始化背景
watch(showResult, (newVal) => {
  if (newVal) {
    nextTick(() => {
      const canvas =
        renderCanvas.value || document.getElementById("imageRenderCanvas");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#f5f5f5";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    });
  }
});
</script>

<style lang="scss" scoped>
.image-processing-container {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
  font-family: "Microsoft YaHei", Arial, sans-serif;

  .page-title {
    color: #333;
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 24px;
    border-bottom: 1px solid #eee;
    padding-bottom: 12px;
  }

  .upload-section {
    margin-bottom: 32px;
  }

  .upload-file {
    margin-bottom: 16px;
  }

  .filter-controls-section {
    margin-bottom: 32px;
  }

  .filter-card {
    border-radius: 8px;
    margin-bottom: 16px;

    .card-header {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .filter-form {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .param-form {
    flex: 1;
    min-width: 300px;
  }

  .filter-buttons {
    display: flex;
    gap: 8px;
  }

  .result-render-section {
    margin-bottom: 32px;
  }

  .render-card {
    border-radius: 8px;
    overflow: hidden;

    .card-header {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .render-info {
        font-size: 14px;
        font-weight: normal;
        color: #666;
      }
    }
  }

  .canvas-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 500px;
    padding: 20px;
    background-color: #f9f9f9;
    overflow: auto;

    .render-canvas {
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: #fff;
      max-width: 100%;
      max-height: 600px;
    }

    .empty-render {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }

  .stats-card {
    border-radius: 8px;
    margin-top: 20px;

    .card-header {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }

    .stats-table {
      width: 100%;
      margin-top: 10px;
    }
  }

  .color-block {
    width: 30px;
    height: 15px;
    border-radius: 3px;
    margin: 0 auto;
  }

  .download-section {
    margin-top: 20px;
    display: flex;
    align-items: center;
    gap: 8px;

    .tooltip-icon {
      color: #666;
      cursor: pointer;
    }
  }

  .empty-state {
    min-height: 500px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #999;
    font-size: 16px;
  }

  .process-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px 0;

    .loading-text {
      font-size: 14px;
      color: #666;
    }
  }
}

// 响应式设计
@media (max-width: 1200px) {
  .image-processing-container {
    .filter-form {
      flex-direction: column;
      align-items: flex-start;
    }

    .param-form {
      min-width: 100%;
    }

    .canvas-container {
      padding: 10px;
    }
  }
}

@media (max-width: 768px) {
  .image-processing-container {
    .canvas-container {
      padding: 5px;
    }

    .stats-table {
      font-size: 12px;
    }

    .color-block {
      width: 20px;
      height: 12px;
    }

    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }
}
</style>
