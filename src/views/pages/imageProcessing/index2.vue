<template>
  <div class="workbench" :style="rootStyle" v-loading="loading">
    <!-- 左侧操作栏 -->
    <div class="left-panel">
      <!-- 图像输入区 -->
      <el-card :style="rootStyle" class="card" shadow="hover">
        <h3>图像输入区</h3>
        <el-upload
          drag
          :auto-upload="false"
          accept=".jpg,.png,.tif,.bmp"
          :on-change="handleImageUpload"
          class="upload-area"
        >
          <i class="el-icon-upload" />
          <div class="el-upload__text">拖拽或点击上传图像</div>
        </el-upload>
      </el-card>

      <!-- 算法选择区 -->
      <el-card :style="rootStyle" class="card" shadow="hover">
        <h3>算法选择区</h3>
        <el-radio-group
          style="gap: 10px"
          v-model="selectedAlgos"
          @change="radiochange"
        >
          <el-radio
            border
            v-for="algo in algorithms"
            :key="algo.value"
            :label="algo.value"
          >
            {{ algo.label }}
          </el-radio>
        </el-radio-group>
      </el-card>
    </div>

    <!-- 右侧展示与操作区 -->
    <div class="right-panel">
      <!-- 原图展示 -->
      <el-card :style="rootStyle" class="card origin-card" shadow="hover">
        <h3>原图</h3>
        <div class="image-container">
          <img v-if="previewUrl" :src="previewUrl" class="origin-image" />
          <div v-else class="placeholder">未上传图像</div>
        </div>
      </el-card>

      <!-- 处理后图 + 切块操作（使用封装的组件） -->
      <el-card :style="rootStyle" class="card main-card" shadow="hover">
        <div class="card-header">
          <h3>处理后图（可切块）</h3>
        </div>

        <!-- 引入图像切块组件 -->
        <ImageCutout
          ref="cutoutComponent"
          :image-url="resultUrl"
          :min-canvas-size="500"
          :show-layers="true"
          @exportData="handleExportData"
          @saveImage="handleSaveCutoutImage"
        />
      </el-card>

      <!-- 输出区 -->
      <div class="bottom-panel">
        <el-card :style="rootStyle" class="card small" shadow="hover">
          <h3>输出区</h3>
          <div class="output-buttons">
            <el-button type="success" @click="saveResult"
              >保存处理结果</el-button
            >
            <el-button
              type="primary"
              @click="handleSaveCutoutImageBtn"
              :disabled="!resultUrl"
            >
              保存含切块图像
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <AlgorithmParamDialog
      v-model="dialogVisible"
      :defaultParams="currentParams"
      @confirm="saveParams"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { fileUpload, getDefaultParams, getProcess } from "@/api/api";
import AlgorithmParamDialog from "./algorithmParamDialog.vue";
import ImageCutout from "@/components/ImageCutTool.vue"; // 引入封装的切块组件
import { useCommonStore } from "@/store";
const store = useCommonStore();

// ====== 图像处理基础配置 ======
const defaultParams = ref({ ...store.defaultParams });
const dialogVisible = ref(false);
const loading = ref(false);

// 主题样式
const bgColor = ref("#fff");
const rootStyle = computed(() => ({
  background: bgColor.value,
}));

// 算法选择
const algorithms = ref([...store.algorithms]);
const selectedAlgos = ref(null);
const currentParams = ref(null);

// 图像数据
const previewUrl = ref("");
const originalImage = ref(null);
const resultUrl = ref(null);

// 切块组件引用
const cutoutComponent = ref(null);

// ====== 图像处理方法 ======
function handleImageUpload(file) {
  fileUpload(file.raw).then((res) => {
    if (res.data.message === "图像上传成功") {
      ElMessage.success("图像上传成功");
      originalImage.value = res.data;
      previewUrl.value = URL.createObjectURL(file.raw);
      resultUrl.value = null; // 重置处理结果
    }
  });
}

function radiochange(value) {
  if (!originalImage.value) {
    selectedAlgos.value = null;
    ElMessage.error("请先上传图像");
    return;
  }
  for (let key in defaultParams.value.processors) {
    if (key === value) {
      currentParams.value = defaultParams.value.processors[key];
      currentParams.value.process_type = value;
      break;
    }
  }
  dialogVisible.value = true;
}

async function saveResult() {
  if (!resultUrl.value) {
    ElMessage.error("没有可保存的结果");
    return;
  }
  const result = await window.electronAPI.saveImage(
    store.baseUrl + resultUrl.value,
    "processed.png"
  );
  if (result.success) ElMessage.success(`保存成功：${result.path}`);
  else ElMessage.error(result.message);
}

function saveParams(params) {
  loading.value = true;
  const image_id = originalImage.value.image_id;
  getProcess(image_id, {
    process_type: currentParams.value.process_type,
    parameters: JSON.stringify({ ...params.formData }),
  }).then((res) => {
    if (res.data.message === "图像处理成功") {
      ElMessage.success("图像处理成功");
      resultUrl.value = store.baseUrl + res.data.result_url;
      loading.value = false;
    }
  });
}

// ====== 切块组件相关回调 ======
// 处理切块数据导出
function handleExportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cutouts_data.json";
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success("切块数据已导出");
}

// 处理含切块图像的保存
function handleSaveCutoutImage(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "processed_with_cutouts.png";
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success("含切块图像已保存");
}

// 保存含切块图像的按钮点击
function handleSaveCutoutImageBtn() {
  if (cutoutComponent.value) {
    cutoutComponent.value.saveCutoutImage();
  }
}
</script>

<style lang="scss" scoped>
.workbench {
  display: flex;
  padding: 10px;
  box-sizing: border-box;
  gap: 10px;
  width: 100%;
  height: 100%;
  overflow: hidden;

  h3,
  h4 {
    margin: 0 0 10px 0;
    font-size: 16px;
    color: #333;
  }

  .left-panel {
    width: 350px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
  }

  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    overflow: hidden;
  }

  .card {
    border-radius: 8px;
    border: 1px solid #ddd;
    overflow: hidden;
  }

  .origin-card {
    :deep(.el-card__body) {
      padding: 10px;
      .image-container {
        background: #f6f6f6;
        border-radius: 6px;
        padding: 10px;
        text-align: center;
        min-height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;

        .origin-image {
          max-width: 100%;
          max-height: 200px;
          border-radius: 4px;
        }

        .placeholder {
          color: #999;
        }
      }
    }
  }

  .main-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    :deep(.el-card__body) {
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .card-header {
      padding: 10px;
      border-bottom: 1px solid #eee;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .cutout-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;

        button {
          cursor: pointer;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          background: #3498db;
          color: white;
          font-size: 13px;
          transition: 0.2s;

          &:hover:not(:disabled) {
            background: #217dbb;
          }
          &:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
          }
        }

        .keep-original-switch {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          margin-left: auto;
        }
      }
    }

    // 画布容器（确保正方形显示）
    .canvas-wrapper {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10px;
      overflow: auto;

      .canvas-container {
        position: relative;
        border: 2px solid #ddd;
        border-radius: 6px;
        background: #f9f9f9;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .main-canvas,
      .overlay-canvas {
        position: absolute;
        top: 0;
        left: 0;
      }

      .main-canvas {
        z-index: 1;
      }

      .overlay-canvas {
        z-index: 2;
        cursor: crosshair;
      }
    }

    .cutout-list {
      padding: 10px;
      border-top: 1px solid #eee;
      max-height: 150px;
      overflow-y: auto;

      h4 {
        font-size: 14px;
        color: #555;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;

        li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 4px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          font-size: 13px;

          &:last-child {
            border-bottom: none;
          }

          &.selected {
            background: #e6f7ff;
            border-radius: 4px;
          }

          button {
            background: #f56c6c;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 12px;

            &:hover {
              background: #e45151;
            }
          }
        }
      }
    }
  }

  .layer-list {
    .layer-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px solid #eee;

      &:last-child {
        border-bottom: none;
      }

      &.selected {
        background: #f0f7ff;
        padding-left: 4px;
        border-radius: 4px;
      }

      span {
        font-size: 12px;
        width: 40px;
      }
    }
  }

  .bottom-panel {
    height: 100px;
    display: flex;
    gap: 10px;

    .small {
      flex: 1;
      :deep(.el-card__body) {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .output-buttons {
        display: flex;
        gap: 10px;

        button {
          flex: 1;
        }
      }
    }
  }

  .upload-area {
    width: 100%;
    border: 1px dashed #aaa;
    background: #fafafa;

    :deep(.el-upload-list) {
      display: none;
    }
  }
}

:deep(.el-card__body) {
  padding: 10px;
  box-sizing: border-box;
}
</style>
