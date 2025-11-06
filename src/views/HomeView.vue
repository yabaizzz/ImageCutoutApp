<template>
  <div class="home">
    <!-- 左侧菜单 -->
    <div class="left">
      <el-menu
        :default-active="String(knowIndex)"
        class="el-menu-vertical-demo"
        @select="handleOpen"
      >
        <el-menu-item index="1">
          <el-icon :size="size" :color="color">
            <Edit />
          </el-icon>
          <span>图像切块</span>
        </el-menu-item>
        <el-sub-menu index="2">
          <template #title>
            <el-icon :size="size" :color="color">
              <Edit />
            </el-icon>
            <span>图像处理</span>
          </template>
          <el-menu-item-group>
            <el-menu-item index="2-1">
              <el-icon :size="size" :color="color">
                <Edit />
              </el-icon>
              <span>图像处理</span>
            </el-menu-item>
            <el-menu-item index="2-2">
              <el-icon :size="size" :color="color">
                <Edit />
              </el-icon>
              <span>处理历史</span>
            </el-menu-item>
          </el-menu-item-group>
        </el-sub-menu>
        <el-sub-menu index="3">
          <template #title>
            <el-icon :size="size" :color="color">
              <Edit />
            </el-icon>
            <span>图像标注</span>
          </template>
          <el-menu-item index="3-1">
            <el-icon :size="size" :color="color">
              <Edit />
            </el-icon>
            <span>普通图像标注</span>
          </el-menu-item>
          <el-menu-item index="3-2">
            <el-icon :size="size" :color="color">
              <Edit />
            </el-icon>
            <span>特殊图像标注</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="4">
          <el-icon :size="size" :color="color">
            <Edit />
          </el-icon>
          <span>多图层叠加</span>
        </el-menu-item>
      </el-menu>
    </div>
    <!-- 右侧内容 -->
    <div class="right">
      <imageCutouDraggablet2 v-if="knowIndex == '1'"></imageCutouDraggablet2>
      <imageProcessing v-if="knowIndex == '2-1'"></imageProcessing>
      <imageProcessList v-if="knowIndex == '2-2'"></imageProcessList>
      <imageCaptioning v-if="knowIndex == '3-1'"></imageCaptioning>
      <imageCaptioning2 v-if="knowIndex == '3-2'"></imageCaptioning2>
      <layerOverlay v-if="knowIndex == '4'"></layerOverlay>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, toRef } from "vue";
import imageCutouDraggablet2 from "@/views/pages/imageCutouDraggablet/index.vue";
import imageProcessing from "@/views/pages/imageProcessing/index.vue";
import imageProcessList from "@/views/pages/imageProcessList/imageProcessList.vue";
import imageCaptioning from "@/views/pages/imageCaptioning/imageCaptioning.vue";
import imageCaptioning2 from "@/views/pages/imageCaptioning/imageCaptioning2.vue";
import layerOverlay from "@/views/pages/layer/index.vue";
import { useCommonStore } from "@/store";
import { getDefaultParams } from "@/api/api";

const commonStore = useCommonStore();

// 左侧菜单，当前选中的下标
const knowIndex = ref(1);
// 左侧菜单，图标大小和颜色
const size = ref(24);
const color = ref("#409eff");

const handleOpen = (key, keyPath) => {
  knowIndex.value = key;
};

onMounted(() => {
  let algorithms = [];
  let defaultParams = {};
  getDefaultParams().then((res) => {
    for (let key in res.data.processors) {
      algorithms.push({
        label: res.data.processors[key].name,
        value: key,
      });
    }
    // 按照字符长度从小到大排序
    algorithms = algorithms.sort((a, b) => a.label.length - b.label.length);
    defaultParams = res.data;
    commonStore.updataAlgorithms(algorithms);
    commonStore.updataDefaultParams(defaultParams);
  });
});
</script>

<style scoped lang="scss">
.home {
  display: flex;
  width: 100%;
  height: 100%;
  .left {
    width: 160px;
    height: 100%;
    .el-menu-vertical-demo {
      width: 100%;
      height: 100%;
    }
  }
  .right {
    width: calc(100% - 160px);
    height: 100%;
    overflow-y: auto;
  }
}
</style>
