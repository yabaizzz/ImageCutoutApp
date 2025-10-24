<!-- 图像处理 -->
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

    <!-- 右侧展示区 -->
    <div class="right-panel">
      <!-- 结果展示区（上下布局） -->
      <el-card :style="rootStyle" class="card result-card" shadow="hover">
        <h3>结果展示区</h3>
        <div class="result-view">
          <div class="result-item">
            <p>原图</p>
            <img v-if="previewUrl" :src="previewUrl" />
          </div>
          <div class="result-item">
            <p>处理后图</p>
            <el-image
              v-if="resultUrl"
              :src="resultUrl"
              :zoom-rate="1.2"
              :max-scale="7"
              :min-scale="0.2"
              :preview-src-list="[resultUrl]"
              fit="cover"
            />
            <div v-else class="placeholder">未生成结果</div>
          </div>
        </div>
      </el-card>

      <!-- 输出与日志 -->
      <div class="bottom-panel">
        <el-card :style="rootStyle" class="card small" shadow="hover">
          <h3>输出区</h3>
          <div class="output-buttons">
            <el-button type="success" @click="saveResult">保存结果</el-button>
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
import { useStore } from "vuex";
const store = useStore();

// ====== 默认参数 ======
const defaultParams = ref({ ...store.state.defaultParams }); //算法参数总数据
const dialogVisible = ref(false); //弹窗是否打开
const loading = ref(false); //处理状态

// ====== 可配置主题颜色 ======
const bgColor = ref("#fff"); // 默认白色背景
const rootStyle = computed(() => ({
  background: bgColor.value,
}));

// ====== 算法选择 ======
const algorithms = ref([...store.state.algorithms]); //算法列表
const selectedAlgos = ref(null); //当前选择的算法
const currentParams = ref(null); //当前选择的算法的参数

// ====== 图像上传 ======
//原图
const previewUrl = ref(""); // 原图路径
const originalImage = ref(null); // 原图数据(包含id)

// 算法处理后图
const resultImage = ref(null); //处理后图片数据
const resultUrl = ref(null); //处理后图片路径

// 监听弹窗状态变化
watch(
  () => dialogVisible.value,
  (newValue, oldValue) => {
    if (!newValue) {
      selectedAlgos.value = null;
      currentParams.value = null;
    }
  }
);

onMounted(() => {});

// 图片上传
function handleImageUpload(file) {
  fileUpload(file.raw).then((res) => {
    if (res.data.message == "图像上传成功") {
      ElMessage.success("图像上传成功");
      originalImage.value = res.data;
      previewUrl.value = URL.createObjectURL(file.raw);
    }
  });
}
// 单选框选择算法
function radiochange(value) {
  if (!originalImage.value) {
    selectedAlgos.value = null;
    ElMessage.error("请先上传图像");
    return;
  }
  for (let key in defaultParams.value.processors) {
    if (key == value) {
      currentParams.value = defaultParams.value.processors[key];
      currentParams.value.process_type = value;
      break;
    }
  }
  dialogVisible.value = true;
}
// 保存结果——下载图片到本地
async function saveResult() {
  const result = await window.electronAPI.saveImage(
    store.state.baseUrl + resultUrl.value,
    "processed.png"
  );

  console.log("result", result);

  if (result.success) {
    ElMessage.success(`保存成功：${result.path}`);
  } else {
    ElMessage.error(result.message);
  }
}
// 弹窗组件返回的算法数据并提交网络请求处理图像
function saveParams(params) {
  loading.value = true;
  applyAlgorithms(params);
}
// 算法请求-处理图片
function applyAlgorithms(params) {
  console.log("params", {
    process_type: currentParams.value.process_type,
    parameters: { ...params },
  });
  const image_id = originalImage.value.image_id;
  getProcess(image_id, {
    process_type: currentParams.value.process_type,
    parameters: JSON.stringify({
      ...params.formData,
    }),
  }).then((res) => {
    if (res.data.message == "图像处理成功") {
      ElMessage.success("图像处理成功");
      resultImage.value = res.data.parameters;
      resultUrl.value = store.state.baseUrl + res.data.result_url;
      loading.value = false;
    }
  });
}
</script>

<style lang="scss" scoped>
.workbench {
  display: flex;
  padding: 10px;
  box-sizing: border-box;
  gap: 10px;
  transition: background 0.3s, color 0.3s;
  width: 100%;
  height: 100%;

  h3 {
    margin-bottom: 10px;
    font-size: 16px;
  }

  .left-panel {
    width: 350px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .card {
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .upload-area {
    width: 100%;
    border: 1px dashed #aaa;
    background: #fafafa;

    :deep(.el-upload-list) {
      display: none;
    }
  }

  .preview {
    text-align: center;
    margin-top: 10px;
    img {
      max-width: 100%;
      border-radius: 8px;
    }
  }

  .param-item {
    margin-bottom: 15px;
    .param-label {
      margin-bottom: 5px;
    }
  }

  .result-card {
    flex: 1;
    .result-view {
      display: flex;
      flex-direction: column; /* 上下布局 */
      justify-content: space-between;
      gap: 20px;
      height: 100%;
      .result-item {
        flex: 1;
        text-align: center;
        background: #f6f6f6;
        border-radius: 8px;
        padding: 10px;
        p {
          color: #555;
          margin-bottom: 5px;
        }
        img {
          max-width: 90%;
          max-height: 250px;
          border-radius: 8px;
        }
        .placeholder {
          color: #999;
          margin-top: 40px;
        }
      }
    }
  }

  .bottom-panel {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    .small {
      flex: 1;
      height: 180px;
    }
    .output-buttons {
      display: flex;
      justify-content: space-evenly;
      button {
        flex: 1;
        margin: 0 4px;
      }
    }
    .log-area {
      background: #fafafa;
      height: 120px;
      overflow-y: auto;
      padding: 8px;
      border-radius: 6px;
      .log-item {
        margin-bottom: 5px;
        font-size: 13px;
        .info {
          color: #409eff;
        }
        .success {
          color: #67c23a;
        }
        .error {
          color: #f56c6c;
        }
      }
    }
  }
}

:deep(.el-card__body) {
  padding: 10px;
  box-sizing: border-box;
}
:deep(.el-image) {
  img {
    max-width: 90%;
    max-height: 250px;
  }
}
</style>
