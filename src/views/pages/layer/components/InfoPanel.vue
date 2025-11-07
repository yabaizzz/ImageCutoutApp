<template>
  <div class="info-panel">
    <el-card>
      <div slot="header">
        <span>图层信息</span>
      </div>

      <div v-if="currentLayer">
        <el-descriptions column="1" border>
          <el-descriptions-item label="名称">{{
            currentLayer.name
          }}</el-descriptions-item>
          <el-descriptions-item label="尺寸"
            >{{ currentLayer.width }} ×
            {{ currentLayer.height }}</el-descriptions-item
          >
          <el-descriptions-item label="像素数">{{
            currentLayer.width * currentLayer.height
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <span v-if="currentLayer.processed">已处理</span>
            <span v-else>原始</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="layer-operations">
          <el-button
            size="small"
            style="width: 100%; margin-top: 10px"
            @click="handleApplyPreprocessing"
          >
            图像预处理
          </el-button>

          <el-button
            size="small"
            style="width: 100%; margin-top: 5px"
            @click="handleUndoPreprocessing"
            :disabled="!currentLayer.processed"
          >
            撤销处理
          </el-button>
        </div>
      </div>

      <div v-else class="empty-info">请选择一个图层</div>
    </el-card>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";

const props = defineProps({
  currentLayer: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["apply-preprocessing", "undo-preprocessing"]);

const handleApplyPreprocessing = () => {
  if (!props.currentLayer) return;

  // 获取图层图像元素
  const img = document.querySelector(`#layer-${props.currentLayer.id}`);
  if (!img) return;

  // 创建canvas进行图像处理
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = props.currentLayer.width;
  canvas.height = props.currentLayer.height;

  // 绘制图像到canvas
  ctx.drawImage(img, 0, 0);

  // 保存原始数据
  if (!props.currentLayer.originalData) {
    props.currentLayer.originalData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  // 获取当前图像数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 简单的预处理：反色效果
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]; // 红色通道反色
    data[i + 1] = 255 - data[i + 1]; // 绿色通道反色
    data[i + 2] = 255 - data[i + 2]; // 蓝色通道反色
    // alpha通道不变
  }

  // 应用处理结果
  ctx.putImageData(imageData, 0, 0);

  // 更新图像源
  img.src = canvas.toDataURL();

  // 通知父组件更新状态
  emit("apply-preprocessing", props.currentLayer.id, imageData);
};

const handleUndoPreprocessing = () => {
  if (!props.currentLayer) return;

  // 获取图层图像元素
  const img = document.querySelector(`#layer-${props.currentLayer.id}`);
  if (!img || !props.currentLayer.originalData) return;

  // 恢复原始图像
  img.src = props.currentLayer.src;

  // 通知父组件更新状态
  emit("undo-preprocessing", props.currentLayer.id);
};
</script>

<style lang="scss" scoped>
.info-panel {
  width: 280px;
  border-left: 1px solid #e5e7eb;
  background-color: #fff;
  height: 100%;
  overflow-y: auto;
  padding: 10px;

  .el-card {
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .empty-info {
    text-align: center;
    padding: 20px;
    color: #999;
    font-size: 14px;
  }

  .layer-operations {
    margin-top: 15px;
  }
}
</style>
