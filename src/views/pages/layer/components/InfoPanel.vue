<!-- 
  罗佳琪 2025年11月17日09:15:20
  描述：图层信息面板
-->
<template>
  <div class="info-panel">
    <el-card>
      <div slot="header">
        <span>图层信息</span>
      </div>

      <div v-if="currentLayer">
        <!-- 原有图层信息 -->
        <el-descriptions column="1" border>
          <el-descriptions-item label="名称">{{
            currentLayer.name
          }}</el-descriptions-item>
          <el-descriptions-item label="尺寸">
            {{ currentLayer.width }} × {{ currentLayer.height }}
          </el-descriptions-item>
          <el-descriptions-item label="像素数">
            {{ currentLayer.width * currentLayer.height }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <span v-if="currentLayer.processed">已处理</span>
            <span v-else>原始</span>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 更新统计信息对比 (区域选择后显示)-->
        <div v-if="statisticsData" class="statistics-section">
          <el-divider content-position="left">区域统计对比</el-divider>

          <!-- 区域信息 -->
          <div class="area-info" v-if="statisticsData.area">
            <el-tag type="info">{{ statisticsData.area.description }}</el-tag>
          </div>

          <div class="statistics-comparison">
            <div
              class="stat-item"
              v-for="(statType, key) in mainStatistics"
              :key="key"
            >
              <div class="stat-header">{{ getStatLabel(key) }}</div>
              <div class="stat-values">
                <div
                  class="stat-value"
                  v-for="(layerData, layerKey) in statType"
                  :key="layerKey"
                  v-if="typeof layerData === 'object'"
                >
                  <span class="layer-label">{{ layerData.name }}</span>
                  <span class="value">{{ layerData.value.toFixed(2) }}</span>
                </div>
              </div>
              <div
                v-if="
                  statisticsData.differences && statisticsData.differences[key]
                "
                class="stat-difference"
                :class="getDifferenceClass(statisticsData.differences[key])"
              >
                差异:
                {{ statisticsData.differences[key] > 0 ? "+" : "" }}
                {{ statisticsData.differences[key].toFixed(2) }}
              </div>
            </div>
          </div>

          <el-button
            size="small"
            style="width: 100%; margin-top: 10px"
            @click="handleClearStatistics"
          >
            清除统计
          </el-button>

          <el-button
            size="small"
            style="width: 100%; margin-top: 5px"
            type="primary"
            @click="handleDownloadRegion"
            v-if="statisticsData"
          >
            下载区域图像
          </el-button>
        </div>
      </div>

      <div v-else class="empty-info">请选择一个图层</div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { ElMessage } from "element-plus";
const props = defineProps({
  currentLayer: {
    type: Object,
    default: null,
  },
  statisticsData: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  "clear-statistics",
  "download-region",
]);

const mainStatistics = computed(() => {
  if (!props.statisticsData) return {};
  const { area, ...mainStats } = props.statisticsData;
  return mainStats;
});

const getStatLabel = (key) => {
  const labels = {
    mean: "平均值",
    std: "标准差",
    min: "最小值",
    max: "最大值",
    median: "中位数",
  };
  return labels[key] || key;
};

const getDifferenceClass = (difference) => {
  if (Math.abs(difference) < 0.1) return "neutral";
  return difference > 0 ? "positive" : "negative";
};

const handleClearStatistics = () => {
  emit("clear-statistics");
};

const handleDownloadRegion = () => {
  ElMessage.info("下载功能开发中...");
  emit("download-region");
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
