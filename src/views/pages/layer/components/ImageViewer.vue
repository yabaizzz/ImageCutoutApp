<template>
  <div class="image-viewer">
    <div
      class="viewer-container"
      ref="viewerContainer"
      @wheel="handleMouseWheel"
      @mousedown="startDrag"
    >
      <div class="image-wrapper" :style="imageWrapperStyle">
        <div
          class="layers-container"
          ref="layersContainer"
          :style="layersContainerStyle"
        >
          <!-- 普通模式：显示所有可见图层 -->
          <template v-if="!swipeMode">
            <div
              v-for="(layer, index) in visibleLayers"
              :key="layer.id"
              class="layer"
              :style="getLayerStyle(layer, index)"
            >
              <img
                :src="layer.src"
                :alt="layer.name"
                :style="getImageStyle(layer)"
                @load="handleImageLoad"
                :id="`layer-${layer.id}`"
                crossorigin="anonymous"
              />
            </div>
          </template>

          <!-- 卷帘模式：只显示前两个可见图层 -->
          <template v-else-if="canUseSwipeMode">
            <!-- 基础图层（完整显示） -->
            <div
              class="swipe-base-layer"
              :style="getLayerStyle(swipeLayers[1], 1)"
            >
              <img
                :src="swipeLayers[1].src"
                :alt="swipeLayers[1].name"
                :style="getImageStyle(swipeLayers[1])"
                @load="handleImageLoad"
                :id="`layer-${swipeLayers[1].id}`"
                crossorigin="anonymous"
              />
            </div>

            <!-- 卷帘图层（被裁剪显示） -->
            <div
              class="swipe-compare-layer"
              :style="{
                ...getLayerStyle(swipeLayers[0], 0),
                clipPath: `inset(0 ${100 - effectiveSwipePosition}% 0 0)`,
              }"
            >
              <img
                :src="swipeLayers[0].src"
                :alt="swipeLayers[0].name"
                :style="getImageStyle(swipeLayers[0])"
                @load="handleImageLoad"
                :id="`layer-${swipeLayers[0].id}`"
                crossorigin="anonymous"
              />
            </div>

            <!-- 卷帘分割线 -->
            <div
              class="swipe-divider"
              :style="{ left: `${effectiveSwipePosition}%` }"
              @mousedown="startSwipe($event)"
            >
              <div class="divider-handle"></div>
            </div>
          </template>

          <!-- 卷帘模式但图层不足的提示 -->
          <div v-else-if="swipeMode" class="swipe-warning">
            <div class="warning-content">
              <el-icon><Warning /></el-icon>
              <span>卷帘对比需要至少两个可见图层</span>
              <el-button
                size="small"
                @click="handleDisableSwipe"
                style="margin-top: 10px"
              >
                退出卷帘模式
              </el-button>
            </div>
          </div>

          <!-- 没有图层时的提示 -->
          <div
            v-if="visibleLayers.length === 0 && !swipeMode"
            class="no-layers"
          >
            <div class="no-layers-content">
              <el-icon><Picture /></el-icon>
              <span>请加载图像</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from "vue";
import { useLayerStore } from "@/store";
import { Warning, Picture } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const layerStore = useLayerStore();

// 组件状态
const viewerContainer = ref(null);
const layersContainer = ref(null);
const containerWidth = ref(0);
const containerHeight = ref(0);

// 拖动相关状态
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const currentPan = ref({ x: 0, y: 0 });

// 卷帘相关状态
const isSwiping = ref(false);
const swipePositionLocal = ref(50);
let animationFrameId = null;
let resizeObserver = null;

// 卷帘拖动状态管理
const swipeDragState = ref({
  startX: 0,
  startPosition: 0,
  isDragging: false,
});

// 区域选择状态
const rectSelection = ref({
  isSelecting: false,
  startPoint: { x: 0, y: 0 },
  currentRect: { x: 0, y: 0, width: 0, height: 0 },
  canvas: null,
  completedRect: null,
});

// 属性定义
const props = defineProps({
  tab: {
    type: Object,
    default: null,
  },
  layers: {
    type: Array,
    default: () => [],
  },
  swipeMode: {
    type: Boolean,
    default: false,
  },
  swipePosition: {
    type: Number,
    default: 50,
  },
  rectSelectMode: {
    type: Boolean,
    default: false,
  },
  dragMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update-pan",
  "set-swipe-position",
  "zoom-in",
  "zoom-out",
  "toggle-swipe",
  "rect-complete",
]);

// 初始化canvas
const initCanvas = () => {
  if (rectSelection.value.canvas) {
    rectSelection.value.canvas.remove();
  }

  const canvas = document.createElement("canvas");
  canvas.className = "rect-canvas";
  canvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    pointer-events: auto;
    cursor: crosshair;
  `;

  if (layersContainer.value) {
    layersContainer.value.appendChild(canvas);
    rectSelection.value.canvas = canvas;
    updateCanvasSize();

    canvas.addEventListener("mousedown", startRectSelect);
    canvas.addEventListener("mousemove", drawRectSelect);
    canvas.addEventListener("mouseup", endRectSelect);
    canvas.addEventListener("mouseleave", cancelRectSelect);
  }
};

// 更新canvas尺寸
const updateCanvasSize = () => {
  if (rectSelection.value.canvas && layersContainer.value) {
    const rect = layersContainer.value.getBoundingClientRect();
    rectSelection.value.canvas.width = rect.width;
    rectSelection.value.canvas.height = rect.height;

    if (rectSelection.value.completedRect) {
      drawCompletedRect();
    }
  }
};

// 清除canvas
const clearCanvas = () => {
  if (rectSelection.value.canvas) {
    const ctx = rectSelection.value.canvas.getContext("2d");
    ctx.clearRect(
      0,
      0,
      rectSelection.value.canvas.width,
      rectSelection.value.canvas.height
    );
  }
  rectSelection.value.completedRect = null;
};

// 获取当前变换矩阵 - 关键修复：正确处理缩放和平移
const getCurrentTransform = () => {
  if (!props.tab) return { scale: 1, translateX: 0, translateY: 0 };

  const zoom = props.tab.zoom;
  const pan = props.tab.pan || { x: 0, y: 0 };

  // 计算图像在容器中的实际位置
  const imageScaledWidth = props.tab.imageWidth * zoom;
  const imageScaledHeight = props.tab.imageHeight * zoom;

  let translateX = pan.x;
  let translateY = pan.y;

  // 如果图像小于容器，需要居中
  if (imageScaledWidth < containerWidth.value) {
    translateX = (containerWidth.value - imageScaledWidth) / 2;
  }

  if (imageScaledHeight < containerHeight.value) {
    translateY = (containerHeight.value - imageScaledHeight) / 2;
  }

  return {
    scale: zoom,
    translateX,
    translateY,
    imageScaledWidth,
    imageScaledHeight,
  };
};

// 屏幕坐标到图像坐标转换 - 关键修复：正确处理缩放
const screenToImageCoords = (screenX, screenY) => {
  if (!props.tab) return { x: 0, y: 0 };

  const transform = getCurrentTransform();

  // 关键修复：减去平移，然后除以缩放比例
  const imageX = (screenX - transform.translateX) / transform.scale;
  const imageY = (screenY - transform.translateY) / transform.scale;

  // 限制在图像范围内
  const clampedX = Math.max(0, Math.min(imageX, props.tab.imageWidth));
  const clampedY = Math.max(0, Math.min(imageY, props.tab.imageHeight));

  return { x: clampedX, y: clampedY };
};

// 图像坐标到屏幕坐标转换 - 关键修复：正确处理缩放
const imageToScreenCoords = (imageX, imageY) => {
  const transform = getCurrentTransform();

  const screenX = imageX * transform.scale + transform.translateX;
  const screenY = imageY * transform.scale + transform.translateY;

  return { x: screenX, y: screenY };
};

// 检查点是否在图像区域内
const isPointInImage = (screenX, screenY) => {
  if (!props.tab) return false;

  const transform = getCurrentTransform();

  return (
    screenX >= transform.translateX &&
    screenX <= transform.translateX + transform.imageScaledWidth &&
    screenY >= transform.translateY &&
    screenY <= transform.translateY + transform.imageScaledHeight
  );
};

// 绘制已完成的矩形
const drawCompletedRect = () => {
  if (
    !rectSelection.value.canvas ||
    !props.tab ||
    !rectSelection.value.completedRect
  )
    return;

  const ctx = rectSelection.value.canvas.getContext("2d");
  const canvas = rectSelection.value.canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rect = rectSelection.value.completedRect;

  ctx.strokeStyle = "#52c41a";
  ctx.fillStyle = "rgba(82, 196, 26, 0.1)";
  ctx.lineWidth = 3;
  ctx.setLineDash([]);

  const startScreen = imageToScreenCoords(rect.x, rect.y);
  const endScreen = imageToScreenCoords(
    rect.x + rect.width,
    rect.y + rect.height
  );

  const screenWidth = endScreen.x - startScreen.x;
  const screenHeight = endScreen.y - startScreen.y;

  ctx.beginPath();
  ctx.rect(startScreen.x, startScreen.y, screenWidth, screenHeight);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#52c41a";
  const points = [
    { x: startScreen.x, y: startScreen.y },
    { x: endScreen.x, y: startScreen.y },
    { x: endScreen.x, y: endScreen.y },
    { x: startScreen.x, y: endScreen.y },
  ];

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#52c41a";
  const fontSize = Math.max(12, 12 * getCurrentTransform().scale);
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = "top";
  const text = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;

  const textX = Math.max(
    5,
    Math.min(startScreen.x + 5, canvas.width - ctx.measureText(text).width - 5)
  );
  const textY = Math.max(fontSize + 5, startScreen.y - fontSize - 5);

  ctx.fillText(text, textX, textY);
};

// 开始矩形选择
const startRectSelect = (e) => {
  if (!props.rectSelectMode || !props.tab || props.dragMode) return;

  const containerRect = viewerContainer.value.getBoundingClientRect();
  const scrollLeft = viewerContainer.value.scrollLeft || 0;
  const scrollTop = viewerContainer.value.scrollTop || 0;

  // 关键修复：正确计算相对于容器的坐标，包括滚动位置
  const screenX = e.clientX - containerRect.left + scrollLeft;
  const screenY = e.clientY - containerRect.top + scrollTop;

  if (!isPointInImage(screenX, screenY)) {
    ElMessage.warning("请在图像区域内进行选择");
    return;
  }

  const imageCoords = screenToImageCoords(screenX, screenY);

  rectSelection.value.isSelecting = true;
  rectSelection.value.startPoint = { x: imageCoords.x, y: imageCoords.y };
  rectSelection.value.currentRect = {
    x: imageCoords.x,
    y: imageCoords.y,
    width: 0,
    height: 0,
  };

  rectSelection.value.completedRect = null;

  e.preventDefault();
  e.stopPropagation();
};

// 绘制矩形选择
const drawRectSelect = (e) => {
  if (
    !props.rectSelectMode ||
    !props.tab ||
    props.dragMode ||
    !rectSelection.value.isSelecting
  ) {
    return;
  }

  const containerRect = viewerContainer.value.getBoundingClientRect();
  const scrollLeft = viewerContainer.value.scrollLeft || 0;
  const scrollTop = viewerContainer.value.scrollTop || 0;

  // 关键修复：正确计算相对于容器的坐标，包括滚动位置
  const screenX = e.clientX - containerRect.left + scrollLeft;
  const screenY = e.clientY - containerRect.top + scrollTop;

  const imageCoords = screenToImageCoords(screenX, screenY);

  const width = imageCoords.x - rectSelection.value.startPoint.x;
  const height = imageCoords.y - rectSelection.value.startPoint.y;

  const rectX = width >= 0 ? rectSelection.value.startPoint.x : imageCoords.x;
  const rectY = height >= 0 ? rectSelection.value.startPoint.y : imageCoords.y;
  const rectWidth = Math.abs(width);
  const rectHeight = Math.abs(height);

  const maxX = props.tab.imageWidth - rectX;
  const maxY = props.tab.imageHeight - rectY;

  rectSelection.value.currentRect = {
    x: rectX,
    y: rectY,
    width: Math.max(1, Math.min(rectWidth, maxX)),
    height: Math.max(1, Math.min(rectHeight, maxY)),
  };

  drawRect();

  e.preventDefault();
  e.stopPropagation();
};

// 绘制矩形（选择过程中的预览）
const drawRect = () => {
  if (!rectSelection.value.canvas || !props.tab) return;

  const ctx = rectSelection.value.canvas.getContext("2d");
  const canvas = rectSelection.value.canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (
    rectSelection.value.currentRect.width === 0 ||
    rectSelection.value.currentRect.height === 0
  ) {
    return;
  }

  ctx.strokeStyle = "#1890ff";
  ctx.fillStyle = "rgba(24, 144, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  const startScreen = imageToScreenCoords(
    rectSelection.value.currentRect.x,
    rectSelection.value.currentRect.y
  );
  const endScreen = imageToScreenCoords(
    rectSelection.value.currentRect.x + rectSelection.value.currentRect.width,
    rectSelection.value.currentRect.y + rectSelection.value.currentRect.height
  );

  const screenWidth = endScreen.x - startScreen.x;
  const screenHeight = endScreen.y - startScreen.y;

  ctx.beginPath();
  ctx.rect(startScreen.x, startScreen.y, screenWidth, screenHeight);
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.fillStyle = "#1890ff";
  const points = [
    { x: startScreen.x, y: startScreen.y },
    { x: endScreen.x, y: startScreen.y },
    { x: endScreen.x, y: endScreen.y },
    { x: startScreen.x, y: endScreen.y },
  ];

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#1890ff";
  const fontSize = Math.max(12, 12 * getCurrentTransform().scale);
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = "top";
  const text = `${Math.round(
    rectSelection.value.currentRect.width
  )} × ${Math.round(rectSelection.value.currentRect.height)}`;

  const textX = Math.max(
    5,
    Math.min(startScreen.x + 5, canvas.width - ctx.measureText(text).width - 5)
  );
  const textY = Math.max(fontSize + 5, startScreen.y - fontSize - 5);

  ctx.fillText(text, textX, textY);
};

// 结束矩形选择
const endRectSelect = async (e) => {
  if (
    !props.rectSelectMode ||
    !props.tab ||
    props.dragMode ||
    !rectSelection.value.isSelecting
  ) {
    return;
  }

  rectSelection.value.isSelecting = false;

  if (
    rectSelection.value.currentRect.width < 5 ||
    rectSelection.value.currentRect.height < 5
  ) {
    clearCanvas();
    return;
  }

  const rectData = {
    ...rectSelection.value.currentRect,
    bounds: {
      minX: rectSelection.value.currentRect.x,
      maxX:
        rectSelection.value.currentRect.x +
        rectSelection.value.currentRect.width,
      minY: rectSelection.value.currentRect.y,
      maxY:
        rectSelection.value.currentRect.y +
        rectSelection.value.currentRect.height,
      width: rectSelection.value.currentRect.width,
      height: rectSelection.value.currentRect.height,
    },
  };

  rectSelection.value.completedRect = { ...rectSelection.value.currentRect };
  drawCompletedRect();

  if (visibleLayers.value.length < 2) {
    ElMessage.warning("需要至少两个可见图层进行区域对比");
    clearCanvas();
    return;
  }

  const layerImageData = [];
  const errors = [];

  for (const layer of visibleLayers.value) {
    try {
      const imageData = await getRectImageData(layer, rectData);
      layerImageData.push(imageData);
    } catch (error) {
      console.error(`获取图层 ${layer.name} 的区域图像失败:`, error);
      errors.push({ layer: layer.name, error: error.message });
    }
  }

  if (layerImageData.length < 2) {
    let errorMessage = "无法获取足够的图层数据进行对比";
    if (errors.length > 0) {
      errorMessage += `。错误: ${errors
        .map((e) => `${e.layer}: ${e.error}`)
        .join("; ")}`;
    }
    ElMessage.error(errorMessage);
    clearCanvas();
    return;
  }

  emit("rect-complete", {
    rectData,
    layerImageData,
    swipeMode: props.swipeMode,
    swipePosition: effectiveSwipePosition.value,
  });

  e.preventDefault();
  e.stopPropagation();
};

// 取消矩形选择
const cancelRectSelect = () => {
  rectSelection.value.isSelecting = false;
  if (!rectSelection.value.completedRect) {
    clearCanvas();
  } else {
    drawCompletedRect();
  }
};

// ============================================================================
// 计算属性和状态
// ============================================================================

const rectSelectMode = computed(() => props.rectSelectMode);
const dragMode = computed(() => props.dragMode);

// 计算属性 - 图像变换信息
const imageTransform = computed(() => {
  if (!props.tab)
    return {
      scale: 1,
      panX: 0,
      panY: 0,
      containerWidth: containerWidth.value,
      containerHeight: containerHeight.value,
    };

  const transform = getCurrentTransform();

  return {
    scale: props.tab.zoom,
    panX: transform.translateX,
    panY: transform.translateY,
    containerWidth: containerWidth.value,
    containerHeight: containerHeight.value,
    scaledWidth: transform.imageScaledWidth,
    scaledHeight: transform.imageScaledHeight,
  };
});

// 计算属性 - 图像包装器样式
const imageWrapperStyle = computed(() => {
  if (!props.tab) return {};

  const transform = getCurrentTransform();

  return {
    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${props.tab.zoom})`,
    transformOrigin: "0 0",
    width: `${props.tab.imageWidth}px`,
    height: `${props.tab.imageHeight}px`,
  };
});

// 图层容器样式
const layersContainerStyle = computed(() => {
  if (!props.tab) return {};

  return {
    width: `${props.tab.imageWidth}px`,
    height: `${props.tab.imageHeight}px`,
    minWidth: `${props.tab.imageWidth}px`,
    minHeight: `${props.tab.imageHeight}px`,
  };
});

// 可见图层
const visibleLayers = computed(() => {
  return props.layers.filter((layer) => layer.visible);
});

// 卷帘模式可用图层（前两个可见图层）
const swipeLayers = computed(() => {
  return visibleLayers.value.slice(0, 2);
});

// 是否可以启用卷帘模式
const canUseSwipeMode = computed(() => {
  return swipeLayers.value.length >= 2;
});

// 计算有效的卷帘位置（基于容器视图）
const effectiveSwipePosition = computed(() => {
  if (!props.tab || !canUseSwipeMode.value) return 50;
  return Math.max(1, Math.min(swipePositionLocal.value, 99));
});

// ============================================================================
// 其他方法
// ============================================================================

// 图层样式
const getLayerStyle = (layer, index) => {
  return {
    zIndex: props.layers.length - index,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  };
};

// 图像样式
const getImageStyle = (layer) => {
  return {
    display: "block",
    userSelect: "none",
    WebkitUserDrag: "none",
    width: "100%",
    height: "100%",
  };
};

// 图像加载完成处理
const handleImageLoad = (event) => {
  console.log("图像加载完成:", event.target.src);
};

// 禁用卷帘模式
const handleDisableSwipe = () => {
  emit("toggle-swipe");
};

// 更新容器尺寸
const updateContainerSize = () => {
  if (viewerContainer.value) {
    containerWidth.value = viewerContainer.value.clientWidth;
    containerHeight.value = viewerContainer.value.clientHeight;

    updateCanvasSize();

    if (props.swipeMode && canUseSwipeMode.value) {
      swipePositionLocal.value = 50;
      emit("set-swipe-position", 50);
    }
  }
};

// 鼠标滚轮缩放
const handleMouseWheel = (e) => {
  e.preventDefault();
  if (!props.tab) return;

  if (e.deltaY < 0) {
    emit("zoom-in");
  } else {
    emit("zoom-out");
  }
};

// 获取矩形区域图像数据的方法
const getRectImageData = (layer, rectData) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = Math.round(rectData.width);
      canvas.height = Math.round(rectData.height);

      try {
        const safeX = Math.max(0, Math.min(rectData.x, img.width - 1));
        const safeY = Math.max(0, Math.min(rectData.y, img.height - 1));
        const safeWidth = Math.min(rectData.width, img.width - safeX);
        const safeHeight = Math.min(rectData.height, img.height - safeY);

        ctx.drawImage(
          img,
          safeX,
          safeY,
          safeWidth,
          safeHeight,
          0,
          0,
          safeWidth,
          safeHeight
        );

        canvas.toBlob((blob) => {
          if (blob) {
            resolve({
              blob,
              layerId: layer.id,
              layerName: layer.name,
              rectData: {
                ...rectData,
                x: safeX,
                y: safeY,
                width: safeWidth,
                height: safeHeight,
              },
              imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            });
          } else {
            reject(new Error("图像转换失败"));
          }
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = function () {
      reject(new Error("图像加载失败"));
    };

    img.src = layer.src;

    if (img.complete) {
      img.onload();
    }
  });
};

// ============================================================================
// 拖动相关方法
// ============================================================================

// 开始拖动
const startDrag = (e) => {
  if (!props.dragMode || !props.tab) return;

  isDragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY };

  if (viewerContainer.value) {
    viewerContainer.value.style.cursor = "grabbing";
  }

  e.preventDefault();
  e.stopPropagation();
};

// 执行拖动
const doDrag = (e) => {
  if (!isDragging.value || !props.tab) return;

  const deltaX = e.clientX - dragStart.value.x;
  const deltaY = e.clientY - dragStart.value.y;

  dragStart.value = { x: e.clientX, y: e.clientY };

  const newPanX = (props.tab.pan?.x || 0) + deltaX;
  const newPanY = (props.tab.pan?.y || 0) + deltaY;

  const imageScaledWidth = props.tab.imageWidth * props.tab.zoom;
  const imageScaledHeight = props.tab.imageHeight * props.tab.zoom;

  const maxPanX = Math.max(0, (imageScaledWidth - containerWidth.value) / 2);
  const maxPanY = Math.max(0, (imageScaledHeight - containerHeight.value) / 2);

  const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
  const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));

  emit("update-pan", clampedPanX, clampedPanY);
};

// 结束拖动
const endDrag = () => {
  if (!isDragging.value) return;

  isDragging.value = false;

  if (viewerContainer.value) {
    viewerContainer.value.style.cursor = props.dragMode ? "grab" : "default";
  }
};

// ============================================================================
// 卷帘相关方法
// ============================================================================

// 开始卷帘拖动
const startSwipe = (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!viewerContainer.value || props.dragMode) return;

  const rect = viewerContainer.value.getBoundingClientRect();

  swipeDragState.value = {
    startX: e.clientX,
    startPosition: swipePositionLocal.value,
    isDragging: true,
  };

  isSwiping.value = true;

  document.addEventListener("mousemove", handleSwipeMove);
  document.addEventListener("mouseup", stopSwipe);

  document.body.style.userSelect = "none";
};

// 处理卷帘移动
const handleSwipeMove = (e) => {
  if (
    !isSwiping.value ||
    !viewerContainer.value ||
    !swipeDragState.value.isDragging ||
    props.dragMode
  )
    return;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  animationFrameId = requestAnimationFrame(() => {
    const rect = viewerContainer.value.getBoundingClientRect();
    const containerWidth = rect.width;

    const deltaX = e.clientX - swipeDragState.value.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;

    let newPosition = swipeDragState.value.startPosition + deltaPercent;
    newPosition = Math.max(1, Math.min(newPosition, 99));

    swipePositionLocal.value = newPosition;
    emit("set-swipe-position", newPosition);
  });
};

// 停止卷帘拖动
const stopSwipe = () => {
  isSwiping.value = false;
  swipeDragState.value.isDragging = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  document.body.style.userSelect = "";

  document.removeEventListener("mousemove", handleSwipeMove);
  document.removeEventListener("mouseup", stopSwipe);
};

// ============================================================================
// 监听器和生命周期
// ============================================================================

// 同步外部状态到本地状态
watch(
  () => props.swipePosition,
  (newVal) => {
    swipePositionLocal.value = newVal;
  },
  { immediate: true }
);

// 监听当前标签的平移变化
watch(
  () => props.tab?.pan,
  (newPan) => {
    if (newPan) {
      currentPan.value = { ...newPan };
    }
  },
  { immediate: true, deep: true }
);

// 监听各种变化 - 关键修复：确保在变换时重新绘制
watch(
  [
    () => props.tab?.zoom,
    containerWidth,
    containerHeight,
    () => props.tab?.pan,
  ],
  () => {
    nextTick(() => {
      if (rectSelection.value.isSelecting) {
        drawRect();
      } else if (rectSelection.value.completedRect) {
        drawCompletedRect();
      }
    });
  },
  { deep: true }
);

// 监听矩形选择模式变化
watch(
  () => props.rectSelectMode,
  (newVal) => {
    if (newVal) {
      nextTick(() => {
        if (!rectSelection.value.canvas) {
          initCanvas();
        } else {
          updateCanvasSize();
        }
      });
    } else {
      clearCanvas();
    }
  }
);

// 监听卷帘模式变化
watch(
  () => props.swipeMode,
  (newVal) => {
    if (newVal && canUseSwipeMode.value) {
      nextTick(() => {
        updateContainerSize();
        swipePositionLocal.value = 50;
        emit("set-swipe-position", 50);
      });
    }
  }
);

// 监听各种模式变化
watch(
  [rectSelectMode, dragMode],
  ([newRectMode, newDragMode]) => {
    if (viewerContainer.value) {
      if (newRectMode) {
        viewerContainer.value.style.cursor = "crosshair";
      } else if (newDragMode) {
        viewerContainer.value.style.cursor = "grab";
      } else {
        viewerContainer.value.style.cursor = "default";
      }
    }

    if (!newRectMode) {
      clearCanvas();
    }

    if (!newDragMode) {
      isDragging.value = false;
    }

    if (newRectMode) {
      nextTick(() => {
        updateContainerSize();
        if (!rectSelection.value.canvas) {
          initCanvas();
        }
      });
    }
  },
  { immediate: true }
);

// 生命周期
onMounted(() => {
  updateContainerSize();
  window.addEventListener("resize", updateContainerSize);

  if (viewerContainer.value) {
    resizeObserver = new ResizeObserver(updateContainerSize);
    resizeObserver.observe(viewerContainer.value);
  }

  document.addEventListener("mousemove", handleGlobalMouseMove);
  document.addEventListener("mouseup", handleGlobalMouseUp);

  nextTick(() => {
    updateContainerSize();
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", updateContainerSize);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  document.removeEventListener("mousemove", handleGlobalMouseMove);
  document.removeEventListener("mouseup", handleGlobalMouseUp);

  if (rectSelection.value.canvas) {
    rectSelection.value.canvas.remove();
  }
});

// 全局鼠标事件处理
const handleGlobalMouseMove = (e) => {
  if (isDragging.value) {
    doDrag(e);
  }
};

const handleGlobalMouseUp = () => {
  if (isDragging.value) {
    endDrag();
  }
};
</script>

<style lang="scss" scoped>
.image-viewer {
  flex: 1;
  background-color: #2b2b2b;
  overflow: hidden;
  position: relative;

  .viewer-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    cursor: default;
    position: relative;

    // 滚动条样式
    &::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }

    &::-webkit-scrollbar-track {
      background: #1e1e1e;
      border-radius: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 6px;
      border: 2px solid #1e1e1e;

      &:hover {
        background: #777;
      }
    }

    &::-webkit-scrollbar-corner {
      background: #1e1e1e;
    }
  }

  .image-wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 100%;
    min-height: 100%;
  }

  .layers-container {
    position: relative;
    background-color: #1e1e1e;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .layer {
    position: absolute;
    top: 0;
    left: 0;

    img {
      display: block;
      user-select: none;
      -webkit-user-drag: none;
    }
  }

  // 卷帘模式样式
  .swipe-base-layer,
  .swipe-compare-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    img {
      display: block;
      user-select: none;
      -webkit-user-drag: none;
      width: 100%;
      height: 100%;
    }
  }

  .swipe-compare-layer {
    z-index: 2;
  }

  .swipe-divider {
    position: absolute;
    top: 0;
    height: 100%;
    width: 3px;
    background: linear-gradient(to bottom, #1890ff, #52c41a);
    cursor: col-resize;
    z-index: 10;
    box-shadow: 0 0 15px rgba(24, 144, 255, 0.5);
    transition: all 0.1s ease;
    user-select: none;

    &:hover {
      width: 5px;
      box-shadow: 0 0 20px rgba(24, 144, 255, 0.7);
    }

    .divider-handle {
      position: absolute;
      top: 50%;
      left: -12px;
      width: 27px;
      height: 60px;
      background: linear-gradient(135deg, #1890ff, #52c41a);
      border-radius: 6px;
      transform: translateY(-50%);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;

      &::before,
      &::after {
        content: "";
        position: absolute;
        width: 3px;
        height: 20px;
        background: white;
        border-radius: 2px;
      }

      &::before {
        left: 8px;
      }

      &::after {
        right: 8px;
      }
    }

    &:hover .divider-handle {
      background: linear-gradient(135deg, #40a9ff, #73d13d);
    }
  }

  .swipe-warning,
  .no-layers {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(30, 30, 30, 0.95);

    .warning-content,
    .no-layers-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 30px;
      background: #2b2b2b;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      text-align: center;
      border: 1px solid #404040;

      .el-icon {
        font-size: 56px;
        color: #e6a23c;
      }

      span {
        color: #d9d9d9;
        font-size: 16px;
        font-weight: 500;
      }
    }
  }

  .no-layers .no-layers-content .el-icon {
    color: #8c8c8c;
  }
}
</style>
