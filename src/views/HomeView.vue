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
        <el-menu-item index="3">
          <el-icon :size="size" :color="color">
            <Edit />
          </el-icon>
          <span>图像标注</span>
        </el-menu-item>
        <!-- <el-menu-item index="2">
          <span>图像处理</span>
        </el-menu-item> -->
      </el-menu>
    </div>
    <!-- 右侧内容 -->
    <div class="right">
      <imageCutouDraggablet2 v-if="knowIndex == 1"></imageCutouDraggablet2>
      <imageProcessing v-if="knowIndex == '2-1'"></imageProcessing>
      <imageProcessList v-if="knowIndex == '2-2'"></imageProcessList>
      <!-- <imageCaptioning v-if="knowIndex == '3'"></imageCaptioning> -->
      <imageCaptioning2 v-if="knowIndex == '3'"></imageCaptioning2>
      <!-- <imageCaptioning3 v-if="knowIndex == '3'"></imageCaptioning3> -->
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from "vue";
import imageCutouDraggablet2 from "@/views/pages/imageCutouDraggablet/index.vue";
import imageProcessing from "@/views/pages/imageProcessing/index.vue";
import imageProcessList from "@/views/pages/imageProcessList/imageProcessList.vue";
import imageCaptioning from "@/views/pages/imageCaptioning/index.vue"; //纯前端读取
import imageCaptioning2 from "@/views/pages/imageCaptioning/imageCaptioning.vue"; // 模拟后端读取（限定第一种格式）
import imageCaptioning3 from "@/views/pages/imageCaptioning/imageCaptioning2.vue"; //  模拟后端读取（两种格式）
import { useStore } from "vuex";
import { getDefaultParams } from "@/api/api";

const store = useStore();

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
    store.commit("updataAlgorithms", algorithms);
    store.commit("updataDefaultParams", defaultParams);
  });
});
</script>

<style scoped lang="scss">
.home {
  display: flex;
  width: 100%;
  height: 100%;
  .left {
    width: 220px;
    height: 100%;
    .el-menu-vertical-demo {
      width: 100%;
      height: 100%;
    }
  }
  .right {
    width: calc(100% - 220px);
    height: 100%;
    overflow-y: auto;
  }
}
</style>
