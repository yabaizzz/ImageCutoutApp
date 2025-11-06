<template>
  <div class="layer-overlay-page">
    <el-row>
      <el-col :span="4"><layerList /></el-col>
      <el-col :span="16"><layerCanvas /></el-col>
      <el-col :span="4">
        <layerControls />
        <el-button type="primary" class="mt-2" @click="openPreprocess"
          >图层预处理</el-button
        >
        <preprocessModal ref="preprocessRef" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from "vue";
import layerCanvas from "@/components/multiLayer/layerCanvas.vue";
import layerList from "@/components/multiLayer/layerList.vue";
import layerControls from "@/components/multiLayer/layerControls.vue";
import preprocessModal from "@/components/multiLayer/preprocessModal.vue";

const preprocessRef = ref(null);
function openPreprocess() {
  console.log("111");

  preprocessRef.value?.open();
}
</script>

<style scoped>
.layer-overlay-page {
  padding: 10px;
}
</style>

<style scoped>
.layer-overlay-page {
  padding: 10px;
}
.mt-2 {
  margin-top: 10px;
}
</style>
