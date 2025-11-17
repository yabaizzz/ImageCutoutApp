<!-- 
  罗佳琪 2025年11月17日09:15:20
  描述：多图层叠加-图层管理-算法选择与参数设置弹窗
-->

<template>
  <el-dialog
    v-model="visible"
    title="算法选择与参数设置"
    width="700px"
    class="algorithm-selection-dialog"
  >
    <div class="dialog-content">
      <!-- 左侧算法列表 -->
      <div class="algorithm-list-panel">
        <div class="panel-header">算法列表</div>
        <div class="algorithm-list">
          <div
            v-for="algo in algorithms"
            :key="algo.value"
            class="algorithm-item"
            :class="{ active: selectedAlgorithmValue === algo.value }"
            @click="selectAlgorithm(algo.value)"
          >
            <div class="algorithm-info">
              <div class="algorithm-name">{{ algo.label }}</div>
              <div class="algorithm-description">
                {{ getAlgorithmDescription(algo.value) }}
              </div>
            </div>
            <i class="el-icon-arrow-right algorithm-arrow"></i>
          </div>
        </div>
      </div>

      <!-- 右侧参数设置 -->
      <div class="parameter-panel">
        <!-- 算法信息 -->
        <div class="algorithm-info-section" v-if="selectedAlgorithmDetail">
          <div class="section-header">
            <h4>{{ selectedAlgorithmDetail.name }}</h4>
            <div class="algorithm-type">
              {{ getAlgorithmType(selectedAlgorithmValue) }}
            </div>
          </div>
          <div class="algorithm-description-full">
            {{ selectedAlgorithmDetail.description || "暂无详细描述" }}
          </div>
        </div>

        <!-- 参数设置区域 -->
        <div
          class="parameter-section"
          v-if="selectedAlgorithmDetail && hasParameters"
        >
          <div class="section-header">参数设置</div>
          <div class="param-body">
            <el-form label-width="120px">
              <el-form-item
                :label="paramConfig.name"
                v-for="(
                  paramConfig, key
                ) in selectedAlgorithmDetail.param_ranges"
                :key="key"
              >
                <el-radio-group
                  v-if="paramConfig.option_names"
                  style="gap: 10px"
                  v-model="formData[key]"
                >
                  <el-radio
                    border
                    v-for="(optionName, index) in paramConfig.option_names"
                    :key="paramConfig.options[index]"
                    :value="paramConfig.options[index]"
                  >
                    {{ optionName }}
                  </el-radio>
                </el-radio-group>
                <el-slider
                  v-else
                  v-model="formData[key]"
                  :min="paramConfig.min"
                  :max="paramConfig.max"
                  :step="paramConfig.step"
                  show-input
                />
                <div class="param-tips" v-if="paramConfig.tips">
                  {{ paramConfig.tips }}
                </div>
              </el-form-item>
            </el-form>
          </div>
        </div>

        <!-- 无参数提示 -->
        <div class="no-parameters" v-else-if="selectedAlgorithmDetail">
          <i class="el-icon-info"></i>
          <p>该算法无需参数配置</p>
        </div>

        <!-- 无算法选中时的提示 -->
        <div class="no-algorithm-selected" v-else>
          <i class="el-icon-info"></i>
          <p>请从左侧选择一个算法</p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="selected-algorithm-info" v-if="selectedAlgorithmDetail">
          <span class="label">已选择:</span>
          <span class="algorithm-name">{{ selectedAlgorithmDetail.name }}</span>
        </div>
        <div class="footer-buttons">
          <el-button @click="handleCancel">取消</el-button>
          <el-button
            type="primary"
            @click="handleConfirm"
            :disabled="!selectedAlgorithmDetail"
          >
            确定
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch, toRefs, ref, computed } from "vue";
import { ElMessage } from "element-plus"; // 引入
import { useLayerStore, useCommonStore } from "@/store";
import { getProcess } from "@/api/api";
const store = useLayerStore();
const store2 = useCommonStore();

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  imageId: {
    type: String,
    default: "",
  },
  // 算法列表
  algorithms: {
    type: Array,
    default: () => [],
  },
  // 详细参数
  defaultParams: {
    type: Object,
    default: () => ({}),
  },
});

const emits = defineEmits(["update:modelValue", "confirm"]);

const visible = ref(props.modelValue);
const selectedAlgorithmValue = ref(null);
const formData = ref({});

// 当前选中的算法详细信息
const selectedAlgorithmDetail = computed(() => {
  if (!selectedAlgorithmValue.value || !props.defaultParams.processors) {
    return null;
  }

  return props.defaultParams.processors[selectedAlgorithmValue.value] || null;
});

// 是否有参数需要配置
const hasParameters = computed(() => {
  if (!selectedAlgorithmDetail.value) return false;
  return !isObjectEmpty(selectedAlgorithmDetail.value.param_ranges || {});
});

// 监听props变化
watch(
  () => props.modelValue,
  (newValue) => {
    visible.value = newValue;
    if (newValue) {
      // 打开弹窗时重置状态
      selectedAlgorithmValue.value = null;
      formData.value = {};

      // 默认选择第一个算法
      if (props.algorithms.length > 0) {
        selectAlgorithm(props.algorithms[0].value);
      }
    }
  }
);

// 监听visible变化，同步到父组件
watch(visible, (val) => {
  emits("update:modelValue", val);
});

// 选择算法
function selectAlgorithm(algorithmValue) {
  selectedAlgorithmValue.value = algorithmValue;

  // 加载该算法的默认参数
  const algorithmDetail = props.defaultParams.processors[algorithmValue];
  if (algorithmDetail && algorithmDetail.params) {
    formData.value = { ...algorithmDetail.params };
  } else {
    formData.value = {};
  }
}

// 获取算法描述
function getAlgorithmDescription(algorithmValue) {
  if (
    !props.defaultParams.processors ||
    !props.defaultParams.processors[algorithmValue]
  ) {
    return "暂无描述";
  }

  const processor = props.defaultParams.processors[algorithmValue];
  return processor.description || "暂无描述";
}

// 获取算法类型（可以根据需要自定义分类逻辑）
function getAlgorithmType(algorithmValue) {
  // 这里可以根据算法value的前缀或其他规则判断算法类型
  // 例如：edge_开头的为边缘检测算法，filter_开头的为滤波算法等
  // 这里只是一个示例，您需要根据实际算法命名规则调整
  if (algorithmValue.includes("edge") || algorithmValue.includes("canny")) {
    return "边缘检测";
  } else if (
    algorithmValue.includes("filter") ||
    algorithmValue.includes("blur")
  ) {
    return "滤波处理";
  } else if (
    algorithmValue.includes("threshold") ||
    algorithmValue.includes("segment")
  ) {
    return "图像分割";
  } else if (
    algorithmValue.includes("enhance") ||
    algorithmValue.includes("equalize")
  ) {
    return "图像增强";
  } else {
    return "通用处理";
  }
}

// 点击取消
function handleCancel() {
  visible.value = false;
}

// 点击确认
function handleConfirm() {
  if (!selectedAlgorithmDetail.value) {
    return ElMessage.error("请选择算法");
  }
  // 提交参数到服务器
  applyAlgorithms({ ...formData.value });
}

// 提交后后端处理图像并渲染
function applyAlgorithms(params) {
  const image_id = props.imageId;
  getProcess(image_id, {
    process_type: selectedAlgorithmValue.value,
    parameters: JSON.stringify({
      ...params.formData,
    }),
  }).then((res) => {
    if (res.data.message == "图像处理成功") {
      ElMessage.success("图像处理成功");
      // 更新当前层的 src
      store.updateLayerSrc(
        store.activeTabId,
        store.activeLayerId,
        store2.baseUrl + res.data.result_url
      );
      visible.value = false;
    }
  });
}

function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}
</script>

<style scoped lang="scss">
.algorithm-selection-dialog {
  .dialog-content {
    display: flex;
    height: 500px;
    gap: 20px;

    .algorithm-list-panel {
      width: 250px;
      border-right: 1px solid #e6e6e6;
      display: flex;
      flex-direction: column;

      .panel-header {
        padding: 10px 15px;
        font-weight: bold;
        border-bottom: 1px solid #e6e6e6;
        margin-bottom: 10px;
      }

      .algorithm-list {
        flex: 1;
        overflow-y: auto;

        .algorithm-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
          margin-bottom: 5px;

          &:hover {
            background-color: #f5f7fa;
          }

          &.active {
            background-color: #ecf5ff;
            border: 1px solid #409eff;
          }

          .algorithm-info {
            flex: 1;
            .algorithm-name {
              font-weight: 500;
              margin-bottom: 4px;
            }

            .algorithm-description {
              font-size: 12px;
              color: #909399;
              line-height: 1.4;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          }

          .algorithm-arrow {
            color: #c0c4cc;
            margin-left: 10px;
          }
        }
      }
    }

    .parameter-panel {
      flex: 1;
      display: flex;
      flex-direction: column;

      .algorithm-info-section {
        border-bottom: 1px solid #e6e6e6;
        padding-bottom: 15px;
        margin-bottom: 15px;

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;

          h4 {
            margin: 0;
            font-size: 16px;
            color: #303133;
          }

          .algorithm-type {
            font-size: 12px;
            color: #909399;
            background: #f4f4f5;
            padding: 2px 8px;
            border-radius: 10px;
          }
        }

        .algorithm-description-full {
          font-size: 14px;
          color: #606266;
          line-height: 1.5;
        }
      }

      .parameter-section {
        flex: 1;
        overflow-y: auto;

        .section-header {
          font-weight: bold;
          margin-bottom: 10px;
        }

        .param-body {
          padding: 10px;
          background: #fafafa;
          border-radius: 8px;

          .param-tips {
            font-size: 12px;
            color: #909399;
            margin-top: 5px;
          }
        }
      }

      .no-parameters {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #909399;

        i {
          font-size: 48px;
          margin-bottom: 15px;
        }

        p {
          font-size: 14px;
        }
      }

      .no-algorithm-selected {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #909399;

        i {
          font-size: 48px;
          margin-bottom: 15px;
        }

        p {
          font-size: 14px;
        }
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .selected-algorithm-info {
      .label {
        color: #909399;
        margin-right: 5px;
      }

      .algorithm-name {
        font-weight: 500;
        color: #409eff;
      }
    }

    .footer-buttons {
      display: flex;
      gap: 10px;
    }
  }

  .el-slider {
    width: 90%;
  }
}
</style>
