// 扫描效果相关逻辑

import { ref, computed, onUnmounted } from "vue";

export function useScanEffect(options = {}) {
  const {
    canvasWidth = 0,
    canvasHeight = 0,
    maskData = [],
    getCategoryColor = () => "rgba(128, 128, 128, 0.5)",
    maskOpacity = 0.5,
  } = options;

  // 扫描状态
  const showScanEffect = ref(false);
  const scanPosition = ref(0);
  const isAutoScanning = ref(false);
  const animationFrameId = ref(null);

  // 计算属性
  const scanLineStyle = computed(() => ({ left: `${scanPosition.value}%` }));

  // 获取安全的 Canvas 上下文
  const getSafeCanvasContext = (canvasElement, contextName = "canvas") => {
    if (!canvasElement)
      throw new Error(`${contextName} element is not available`);
    const context = canvasElement.getContext("2d");
    if (!context) throw new Error(`${contextName} context is not available`);
    return context;
  };

  // 绘制多边形扫描掩码
  const drawPolygonScanMask = (ctx, points, color) => {
    if (!points || points.length < 3) return;

    ctx.fillStyle = color;
    ctx.globalAlpha = maskOpacity;
    ctx.beginPath();

    const startX = points[0].x * canvasWidth;
    const startY = points[0].y * canvasHeight;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < points.length; i++) {
      const x = points[i].x * canvasWidth;
      const y = points[i].y * canvasHeight;
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  };

  // 绘制边界框扫描掩码
  const drawBoundingBoxScanMask = (ctx, bbox, color) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = maskOpacity;

    const x = bbox.x * canvasWidth;
    const y = bbox.y * canvasHeight;
    const width = bbox.width * canvasWidth;
    const height = bbox.height * canvasHeight;

    ctx.fillRect(x, y, width, height);
  };

  // 更新扫描掩码
  const updateScanMask = (scanCanvas, maskCanvas) => {
    try {
      const ctx = getSafeCanvasContext(scanCanvas, "Scan");
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      if (showScanEffect.value) {
        const scanX = (scanPosition.value / 100) * canvasWidth;

        ctx.save();
        // 扫描线左侧区域（已扫描部分）
        ctx.beginPath();
        ctx.rect(0, 0, scanX, canvasHeight);
        ctx.clip();

        // 在已扫描区域绘制掩码
        maskData.forEach((mask) => {
          const color = getCategoryColor(mask.classId);
          if (mask.type === "polygon") {
            drawPolygonScanMask(ctx, mask.points, color);
          } else if (mask.type === "boundingBox") {
            drawBoundingBoxScanMask(ctx, mask.boundingBox, color);
          }
        });

        ctx.restore();

        // 隐藏基础掩码，只显示扫描区域内的掩码
        if (maskCanvas) {
          maskCanvas.style.opacity = 0;
        }
      }
    } catch (error) {
      console.error("更新扫描遮罩失败:", error);
      throw error;
    }
  };

  // 清除扫描掩码
  const clearScanMask = (scanCanvas, maskCanvas, originalMaskOpacity) => {
    try {
      const ctx = getSafeCanvasContext(scanCanvas, "Scan");
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // 恢复基础掩码显示
      if (maskCanvas) {
        maskCanvas.style.opacity = originalMaskOpacity;
      }
    } catch (error) {
      console.error("清除扫描遮罩失败:", error);
      throw error;
    }
  };

  // 自动扫描动画
  const startAutoScan = (scanCanvas, maskCanvas, duration = 3000) => {
    if (!showScanEffect.value) return;

    isAutoScanning.value = true;
    const startTime = Date.now();

    const animate = () => {
      if (!showScanEffect.value || !isAutoScanning.value) {
        isAutoScanning.value = false;
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      scanPosition.value = progress * 100;
      updateScanMask(scanCanvas, maskCanvas);

      if (progress < 1) {
        animationFrameId.value = requestAnimationFrame(animate);
      } else {
        isAutoScanning.value = false;
      }
    };

    animationFrameId.value = requestAnimationFrame(animate);
  };

  // 停止自动扫描
  const stopAutoScan = () => {
    isAutoScanning.value = false;
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value);
      animationFrameId.value = null;
    }
  };

  // 切换扫描效果
  const toggleScanEffect = (scanCanvas, maskCanvas, originalMaskOpacity) => {
    showScanEffect.value = !showScanEffect.value;

    if (showScanEffect.value) {
      scanPosition.value = 0;
      updateScanMask(scanCanvas, maskCanvas);
      // 可选：开启自动扫描
      // startAutoScan(scanCanvas, maskCanvas)
    } else {
      clearScanMask(scanCanvas, maskCanvas, originalMaskOpacity);
      stopAutoScan();
    }
  };

  // 手动更新扫描位置
  const updateScanPosition = (position, scanCanvas, maskCanvas) => {
    scanPosition.value = position;
    updateScanMask(scanCanvas, maskCanvas);
  };

  // 组件卸载时清理
  onUnmounted(() => {
    stopAutoScan();
  });

  return {
    // 状态
    showScanEffect,
    scanPosition,
    isAutoScanning,

    // 计算属性
    scanLineStyle,

    // 方法
    toggleScanEffect,
    updateScanMask,
    clearScanMask,
    startAutoScan,
    stopAutoScan,
    updateScanPosition,
  };
}
