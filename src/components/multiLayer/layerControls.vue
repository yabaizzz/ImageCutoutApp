<template>
  <el-card class="layer-controls">
    <template #header>图层控制</template>

    <!-- 卷帘对比 -->
    <div class="control-item">
      <span>卷帘对比：</span>
      <el-slider
        v-model="layerStore.compareSplit"
        :min="0"
        :max="1"
        :step="0.01"
        show-tooltip
      />
    </div>

    <!-- 缩放比例（数值控制） -->
    <div class="control-item">
      <span>缩放比例：</span>
      <el-input-number
        v-model="layerStore.containerScale"
        :min="0.1"
        :max="5"
        :step="0.1"
        controls-position="right"
      />
    </div>

    <!-- 新增：比例输入 1:x -->
    <div class="control-item">
      <span>输入比例（1:x）：</span>
      <el-input
        v-model="scaleInput"
        placeholder="例如 1:200"
        clearable
        @change="handleScaleInput"
      />
    </div>

    <div class="buttons">
      <el-button @click="resetView">重置视图</el-button>
    </div>
  </el-card>
</template>

<script setup>
import { ref } from "vue";
import { useLayerStore } from "@/store";
import { ElMessage } from "element-plus";
const layerStore = useLayerStore();

// 用户输入的比例
const scaleInput = ref("");

// 假设当前系统默认比例是 1:100 (可以改)
const baseRatio = 100;
const baseScale = 1.0;

const handleScaleInput = () => {
  const input = scaleInput.value.trim();

  // 匹配 1:数字 或 1/数字
  const match = input.match(/^1[:/](\d+(\.\d+)?)$/);
  if (!match) {
    ElMessage.error("请输入正确格式，例如 1:200");
    return;
  }

  const denominator = parseFloat(match[1]);
  if (denominator <= 0) {
    ElMessage.error("比例必须大于0");
    return;
  }

  // 计算新的缩放比例
  const newScale = baseScale * (baseRatio / denominator);

  // 限制范围
  layerStore.containerScale = Math.min(Math.max(newScale, 0.1), 5);
  ElMessage.success(`已应用比例 1:${denominator}`);
};

const resetView = () => {
  layerStore.containerScale = 1;
  layerStore.compareSplit = 0.5;
  scaleInput.value = "";
};
</script>

<style scoped>
.layer-controls {
  margin-top: 10px;
}
.control-item {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}
.buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
