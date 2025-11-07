<template>
  <div class="image-viewer">
    <div
      class="viewer-container"
      ref="viewerContainer"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel="handleMouseWheel"
    >
      <div class="image-wrapper" :style="imageWrapperStyle">
        <div class="layers-container" ref="layersContainer">
          <!-- 正常图层渲染 -->
          <div
            v-for="(layer, index) in layers"
            :key="layer.id"
            class="layer"
            :style="getLayerStyle(layer, index)"
            v-show="layer.visible && !swipeMode"
          >
            <img
              :src="layer.src"
              :alt="layer.name"
              :width="layer.width"
              :height="layer.height"
            />
          </div>

          <!-- 卷帘模式下的图层 -->
          <div v-if="swipeMode && layers.length >= 2" class="swipe-container">
            <!-- 左侧图层 (第一个图层) -->
            <div
              class="swipe-layer left-layer"
              :style="{
                width: `${swipePosition}px`,
                display: layers[0].visible ? 'block' : 'none',
              }"
            >
              <img
                :src="layers[0].src"
                :alt="layers[0].name"
                :width="layers[0].width"
                :height="layers[0].height"
              />
            </div>

            <!-- 卷帘分割线 -->
            <div
              class="swipe-divider"
              :style="{ left: `${swipePosition}px` }"
              @mousedown="startSwipe"
            >
              <div class="divider-handle"></div>
            </div>

            <!-- 右侧图层 (第二个图层) -->
            <div
              class="swipe-layer right-layer"
              :style="{
                left: `${swipePosition}px`,
                width: `${containerWidth - swipePosition}px`,
                display: layers[1].visible ? 'block' : 'none',
              }"
            >
              <img
                :src="layers[1].src"
                :alt="layers[1].name"
                :width="layers[1].width"
                :height="layers[1].height"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  defineProps,
  defineEmits,
  ref,
  onMounted,
  onUnmounted,
  watch,
  computed,
  nextTick,
} from "vue";

// 组件状态
const viewerContainer = ref(null);
const layersContainer = ref(null);
const containerWidth = ref(0);
const containerHeight = ref(0);

// 工具状态
const isDragging = ref(false);
const lastMousePos = ref({ x: 0, y: 0 });
const isSwiping = ref(false);

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
    default: 0,
  },
});

const emit = defineEmits([
  "update-pan",
  "set-swipe-position",
  "apply-preprocessing",
  "undo-preprocessing",
  "zoom-in",
  "zoom-out",
]);

// 计算属性
const imageWrapperStyle = computed(() => {
  if (!props.tab) return {};

  return {
    transform: `scale(${props.tab.zoom}) translate(${props.tab.pan.x}px, ${props.tab.pan.y}px)`,
    transformOrigin: "0 0",
  };
});

// 图层样式
const getLayerStyle = (layer, index) => {
  return {
    zIndex: props.layers.length - index,
  };
};

// 生命周期
onMounted(() => {
  updateContainerSize();
  window.addEventListener("resize", updateContainerSize);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateContainerSize);
});

// 更新容器尺寸
const updateContainerSize = () => {
  if (viewerContainer.value) {
    containerWidth.value = viewerContainer.value.clientWidth;
    containerHeight.value = viewerContainer.value.clientHeight;

    // 如果卷帘模式启用且swipePosition为0，设置默认位置
    if (
      props.swipeMode &&
      props.swipePosition === 0 &&
      containerWidth.value > 0
    ) {
      emit("set-swipe-position", containerWidth.value / 2);
    }
  }
};

// 监听卷帘模式变化
watch(
  () => props.swipeMode,
  (newVal) => {
    if (newVal) {
      // 启用卷帘时重置视图和卷帘位置
      nextTick(() => {
        updateContainerSize();
        if (containerWidth.value > 0) {
          emit("set-swipe-position", containerWidth.value / 2);
        }
      });
    }
  }
);

// 监听容器尺寸变化
watch(
  () => [containerWidth.value, containerHeight.value],
  () => {
    if (props.swipeMode && containerWidth.value > 0) {
      // 确保卷帘位置在容器范围内
      const currentPosition = props.swipePosition;
      const maxPosition = containerWidth.value;

      if (currentPosition > maxPosition) {
        emit("set-swipe-position", maxPosition / 2);
      }
    }
  }
);

// 鼠标事件处理 - 合并移动和卷帘功能
const handleMouseDown = (e) => {
  if (!props.tab) return;

  lastMousePos.value = { x: e.clientX, y: e.clientY };

  // 检查是否点击了卷帘分割线
  const isDivider = e.target.closest(".swipe-divider");

  if (isDivider && props.swipeMode && props.layers.length >= 2) {
    // 开始卷帘拖动
    isSwiping.value = true;
    if (viewerContainer.value) {
      viewerContainer.value.style.cursor = "col-resize";
    }
    e.preventDefault();
    e.stopPropagation();
  } else {
    // 开始移动拖动
    isDragging.value = true;
    if (viewerContainer.value) {
      viewerContainer.value.style.cursor = "grabbing";
    }
  }
};

const handleMouseMove = (e) => {
  if (!props.tab) return;

  const deltaX = e.clientX - lastMousePos.value.x;
  const deltaY = e.clientY - lastMousePos.value.y;

  if (isDragging.value) {
    // 移动画布
    emit("update-pan", deltaX, deltaY);
    lastMousePos.value = { x: e.clientX, y: e.clientY };
  } else if (isSwiping.value && props.swipeMode && props.layers.length >= 2) {
    // 更新卷帘位置
    updateSwipePosition(e);
  }

  lastMousePos.value = { x: e.clientX, y: e.clientY };
};

const handleMouseUp = () => {
  if (isDragging.value) {
    isDragging.value = false;
    if (viewerContainer.value) {
      viewerContainer.value.style.cursor = "grab";
    }
  }

  if (isSwiping.value) {
    isSwiping.value = false;
    if (viewerContainer.value) {
      viewerContainer.value.style.cursor = "grab";
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

// 卷帘功能
const startSwipe = (e) => {
  e.preventDefault();
  e.stopPropagation();
  isSwiping.value = true;

  document.addEventListener("mousemove", handleSwipeMove);
  document.addEventListener("mouseup", stopSwipe);
};

const handleSwipeMove = (e) => {
  if (isSwiping.value) {
    updateSwipePosition(e);
  }
};

const stopSwipe = () => {
  isSwiping.value = false;
  document.removeEventListener("mousemove", handleSwipeMove);
  document.removeEventListener("mouseup", stopSwipe);
};

// 卷帘位置更新 - 基于容器尺寸
const updateSwipePosition = (e) => {
  const container = viewerContainer.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const containerLeft = rect.left;

  // 计算鼠标在容器内的位置
  let position = e.clientX - containerLeft;

  // 限制在容器范围内
  position = Math.max(10, Math.min(position, containerWidth.value - 10));

  emit("set-swipe-position", position);
};
</script>

<style lang="scss" scoped>
.image-viewer {
  flex: 1;
  background-color: #f5f5f5;
  overflow: hidden;
  position: relative;

  .viewer-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    cursor: grab;
    position: relative;

    &:active {
      cursor: grabbing;
    }
  }

  .image-wrapper {
    position: relative;
    display: inline-block;
  }

  .layers-container {
    position: relative;
    display: inline-block;
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

  .swipe-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;

    .swipe-layer {
      position: absolute;
      top: 0;
      height: 100%;
      overflow: hidden;

      &.left-layer {
        left: 0;
      }

      &.right-layer {
        left: 0;
      }

      img {
        display: block;
        user-select: none;
        -webkit-user-drag: none;
        height: 100%;
        width: auto;
        max-width: none;
      }
    }

    .swipe-divider {
      position: absolute;
      top: 0;
      height: 100%;
      width: 3px;
      background-color: white;
      cursor: col-resize;
      z-index: 3;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);

      .divider-handle {
        position: absolute;
        top: 50%;
        left: -10px;
        width: 23px;
        height: 40px;
        background-color: white;
        border-radius: 3px;
        transform: translateY(-50%);
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);

        &::before,
        &::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 2px;
          height: 12px;
          background-color: #666;
          transform: translateY(-50%);
        }

        &::before {
          left: 7px;
        }

        &::after {
          right: 7px;
        }
      }

      &:hover .divider-handle {
        background-color: #f0f0f0;
      }
    }
  }
}
</style>
