<!-- 
  罗佳琪 2025年11月17日09:15:20
  描述：图层管理面板
-->
<template>
  <div class="layer-panel">
    <el-card>
      <div slot="header">
        <span>图层管理</span>
      </div>

      <div class="layer-list">
        <draggable
          v-model="localLayers"
          :group="'layers'"
          :sort="true"
          item-key="id"
          @end="handleDragEnd"
        >
          <template #item="{ element: layer }">
            <div
              class="layer-item"
              :class="{ 'active-layer': activeLayerId === layer.id }"
              @click="handleSelectLayer(layer.id)"
            >
              <el-checkbox
                :model-value="layer.visible"
                style="margin-right: 5px"
                @change="handleVisibilityChange(layer.id, $event)"
              />
              <span class="layer-name">{{ layer.name }}</span>

              <div class="layer-actions">
                <el-icon @click.stop="handleDuplicateLayer(layer.id)">
                  <CopyDocument />
                </el-icon>
                <el-icon @click.stop="handleOpenSettings(layer.imageId)">
                  <Setting />
                </el-icon>
                <el-icon @click.stop="handleRemoveLayer(layer.id)">
                  <Delete />
                </el-icon>
              </div>
            </div>
          </template>
        </draggable>
      </div>

      <div v-if="localLayers.length === 0" class="empty-layer">
        无图层，请上传图像
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, toRef, watch } from "vue";
import { CopyDocument, Setting, Delete } from "@element-plus/icons-vue";
import draggable from "vuedraggable";

const props = defineProps({
  layers: {
    type: Array,
    default: () => [],
  },
  activeLayerId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits([
  "set-active-layer",
  "duplicate-layer",
  "remove-layer",
  "set-visibility",
  "open-settings",
  "update:layers",
]);

// 创建本地副本用于拖拽
const localLayers = ref([...props.layers]);

// 监听 props.layers 变化
watch(
  () => props.layers,
  (newLayers) => {
    localLayers.value = [...newLayers];
  },
  { deep: true }
);

const handleDragEnd = () => {
  emit("update:layers", [...localLayers.value]);
};

const handleVisibilityChange = (layerId, visible) => {
  emit("set-visibility", layerId, visible);
};

const handleSelectLayer = (layerId) => {
  emit("set-active-layer", layerId);
};

const handleDuplicateLayer = (layerId) => {
  emit("duplicate-layer", layerId);
};

const handleRemoveLayer = (layerId) => {
  emit("remove-layer", layerId);
};

const handleOpenSettings = (layerId, layer) => {
  emit("open-settings", layerId);
};
</script>

<style lang="scss" scoped>
.layer-panel {
  width: 280px;
  border-right: 1px solid #e5e7eb;
  background-color: #fff;
  height: 100%;
  overflow: hidden;

  .el-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    margin: 0;
    border-radius: 0;
    border: none;

    .el-card__body {
      flex: 1;
      padding: 10px;
      overflow-y: auto;
    }
  }

  .layer-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .layer-item {
    padding: 5px 10px;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f5f7fa;
    }
  }

  .active-layer {
    background-color: #e6f7ff;
    border-left: 3px solid #1890ff;
  }

  .layer-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0 5px;
  }

  .layer-actions {
    display: flex;
    gap: 5px;
    color: #666;

    .el-icon {
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: #1890ff;
      }
    }
  }

  .empty-layer {
    text-align: center;
    padding: 20px;
    color: #999;
    font-size: 14px;
  }
}
</style>
