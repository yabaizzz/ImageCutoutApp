<template>
  <div class="image-viewer">
    <div
      class="viewer-container"
      ref="viewerContainer"
      @wheel="handleMouseWheel"
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
import {
  defineEmits,
  ref,
  onMounted,
  onUnmounted,
  watch,
  computed,
  nextTick,
} from "vue";
import { Warning, Picture } from "@element-plus/icons-vue";

// 组件状态
const viewerContainer = ref(null);
const layersContainer = ref(null);
const containerWidth = ref(0);
const containerHeight = ref(0);

// 工具状态
const isSwiping = ref(false);
const swipePositionLocal = ref(50);
let animationFrameId = null;

// 新增：拖动状态管理
const dragState = ref({
  startX: 0,
  startPosition: 0,
  isDragging: false,
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
});

const emit = defineEmits([
  "update-pan",
  "set-swipe-position",
  "apply-preprocessing",
  "undo-preprocessing",
  "zoom-in",
  "zoom-out",
  "toggle-swipe",
]);

// 计算属性 - 图像包装器样式（居中显示）
const imageWrapperStyle = computed(() => {
  if (!props.tab) return {};

  const imageScaledWidth = props.tab.imageWidth * props.tab.zoom;
  const imageScaledHeight = props.tab.imageHeight * props.tab.zoom;

  // 计算居中位置
  const translateX = Math.max(0, (containerWidth.value - imageScaledWidth) / 2);
  const translateY = Math.max(
    0,
    (containerHeight.value - imageScaledHeight) / 2
  );

  return {
    transform: `translate(${translateX}px, ${translateY}px) scale(${props.tab.zoom})`,
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

// 同步外部状态到本地状态
watch(
  () => props.swipePosition,
  (newVal) => {
    swipePositionLocal.value = newVal;
  },
  { immediate: true }
);

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

// 生命周期
onMounted(() => {
  updateContainerSize();
  window.addEventListener("resize", updateContainerSize);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateContainerSize);
  // 清理动画帧
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

// 更新容器尺寸
const updateContainerSize = () => {
  if (viewerContainer.value) {
    containerWidth.value = viewerContainer.value.clientWidth;
    containerHeight.value = viewerContainer.value.clientHeight;

    // 容器尺寸更新时，重置卷帘位置到容器中间
    if (props.swipeMode && canUseSwipeMode.value) {
      swipePositionLocal.value = 50;
      emit("set-swipe-position", 50);
    }
  }
};

// 监听卷帘模式变化
watch(
  () => props.swipeMode,
  (newVal) => {
    if (newVal && canUseSwipeMode.value) {
      // 启用卷帘时重置卷帘位置到容器视图中间
      nextTick(() => {
        // 确保容器尺寸已更新
        updateContainerSize();
        // 设置卷帘位置为容器视图中间
        swipePositionLocal.value = 50;
        emit("set-swipe-position", 50);
      });
    }
  }
);

// 鼠标滚轮缩放
const handleMouseWheel = (e) => {
  e.preventDefault();
  if (!props.tab) return;

  // 判断缩放方向
  if (e.deltaY < 0) {
    // 向上滚动 - 放大
    emit("zoom-in");
  } else {
    // 向下滚动 - 缩小
    emit("zoom-out");
  }
};

// 卷帘功能 - 完全重写以解决偏移问题
const startSwipe = (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!viewerContainer.value) return;

  // 记录初始状态
  const rect = viewerContainer.value.getBoundingClientRect();
  const containerLeft = rect.left;

  dragState.value = {
    startX: e.clientX,
    startPosition: swipePositionLocal.value,
    isDragging: true,
  };

  // 设置拖动状态
  isSwiping.value = true;

  // 添加全局事件监听器，确保鼠标移出容器也能继续拖动
  document.addEventListener("mousemove", handleSwipeMove);
  document.addEventListener("mouseup", stopSwipe);

  // 防止文本选择
  document.body.style.userSelect = "none";
};

// 使用相对移动计算位置，避免偏移
const handleSwipeMove = (e) => {
  if (!isSwiping.value || !viewerContainer.value || !dragState.value.isDragging)
    return;

  // 使用requestAnimationFrame确保流畅的动画
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  animationFrameId = requestAnimationFrame(() => {
    const rect = viewerContainer.value.getBoundingClientRect();
    const containerWidth = rect.width;

    // 计算鼠标移动的相对距离
    const deltaX = e.clientX - dragState.value.startX;

    // 将移动距离转换为百分比
    const deltaPercent = (deltaX / containerWidth) * 100;

    // 计算新的位置（基于初始位置 + 移动距离）
    let newPosition = dragState.value.startPosition + deltaPercent;

    // 限制在1%-99%范围内
    newPosition = Math.max(1, Math.min(newPosition, 99));

    // 更新本地状态
    swipePositionLocal.value = newPosition;

    // 直接更新父组件状态
    emit("set-swipe-position", newPosition);
  });
};

const stopSwipe = () => {
  isSwiping.value = false;
  dragState.value.isDragging = false;

  // 清理动画帧
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 恢复文本选择
  document.body.style.userSelect = "";

  document.removeEventListener("mousemove", handleSwipeMove);
  document.removeEventListener("mouseup", stopSwipe);
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
