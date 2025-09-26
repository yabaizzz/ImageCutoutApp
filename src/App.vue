<template>
  <router-view />
</template>

<script setup>
import { onMounted } from "vue";

onMounted(() => {});
</script>

<style lang="scss">
/* 隐藏竖向滚动条 */
::-webkit-scrollbar {
  width: 0; /* 竖向滚动条宽度设为0 */
}

/* 保留横向滚动条 */
::-webkit-scrollbar:horizontal {
  height: 8px; /* 横向滚动条高度 */
}

/* 横向滚动条轨道 */
::-webkit-scrollbar-track:horizontal {
  background: #f1f1f1;
}

/* 横向滚动条滑块 */
::-webkit-scrollbar-thumb:horizontal {
  background: #888;
  border-radius: 4px;
}

/* 横向滚动条滑块悬停效果 */
::-webkit-scrollbar-thumb:horizontal:hover {
  background: #555;
}
body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
}

#app {
  width: 100%;
  height: 100%;
}
</style>
