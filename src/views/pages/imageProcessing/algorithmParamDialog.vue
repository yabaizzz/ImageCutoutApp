<template>
  <el-dialog
    v-model="visible"
    :title="params.name + '参数设置'"
    width="500px"
    class="algorithm-param-dialog"
  >
    <div class="param-body">
      <el-form label-width="120px" v-if="!isObjectEmpty(params.params)">
        <el-form-item
          :label="item.name"
          v-for="(item, key, index) in params.param_ranges"
          :key="key"
        >
          <el-radio-group
            v-if="item.option_names"
            style="gap: 10px"
            v-model="formData[key]"
          >
            <el-radio
              border
              v-for="(algo, index) in item.option_names"
              :key="item.options[index]"
              :value="item.options[index]"
            >
              {{ algo }}
            </el-radio>
          </el-radio-group>
          <el-slider
            v-else
            v-model="formData[key]"
            :min="item.min"
            :max="item.max"
            :step="item.step"
            show-input
          />
        </el-form-item>
      </el-form>
      <!-- 其他算法占位 -->
      <template v-else>
        <div class="no-param">暂不支持的算法参数配置</div>
      </template>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch, toRefs, ref } from "vue";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  defaultParams: {
    type: Object,
    default: () => ({}),
  },
});

const emits = defineEmits(["update:modelValue", "confirm"]);

const visible = ref(props.modelValue);
const params = ref({ ...props.defaultParams });
const formData = ref({});

watch(
  () => props.modelValue,
  (newValue, oldValue) => {
    visible.value = newValue;
    if (newValue) {
      params.value = { ...props.defaultParams }; // 打开弹窗时更新 params
      formData.value = { ...props.defaultParams.params }; // 重置表单数据
      console.log("param_ranges", typeof params.value.param_ranges);
    }
  }
);
watch(visible, (val) => emits("update:modelValue", val));

function handleCancel() {
  visible.value = false;
}

function handleConfirm() {
  emits("confirm", {
    formData: { ...formData.value },
  });
  visible.value = false;
}

function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}
</script>

<style scoped lang="scss">
.algorithm-param-dialog {
  .param-body {
    padding: 10px 20px;
    background: #fafafa;
    border-radius: 8px;
  }

  .no-param {
    padding: 30px 0;
    text-align: center;
    color: #999;
  }

  .el-slider {
    width: 90%;
  }
}
</style>
