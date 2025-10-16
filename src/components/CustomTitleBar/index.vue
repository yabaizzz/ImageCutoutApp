<!-- windwos桌面应用自定义标题栏 -->
<template>
  <div class="title-bar">
    <div class="title">{{ title }}</div>
    <div class="actions">
      <!-- 开发环境自定义菜单 -->
      <div v-if="isDev" class="dev-menu">
        <button @click="toggleMenu">☰</button>
        <div v-if="showMenu" class="menu-dropdown">
          <button @click="refresh">刷新</button>
          <button @click="toggleDevTools">开发者工具</button>
          <button @click="quitApp">退出</button>
        </div>
      </div>

      <!-- 新增图标 -->
      <button @click="openCustomPopup">⚙️</button>

      <!-- 系统按钮 -->
      <button @click="minimize">🗕</button>
      <button @click="maximize">🗖</button>
      <button @click="close">✖</button>
    </div>

    <!-- 弹窗 -->
    <div v-if="showPopup" class="popup">
      <h3>自定义弹窗</h3>
      <p>这里放内容</p>
      <button @click="showPopup = false">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  title: { type: String, default: "我的应用" },
});

const showPopup = ref(false);
function openCustomPopup() {
  showPopup.value = true;
}

// 是否开发环境
const isDev = process.env.NODE_ENV === "development";

// 自定义菜单状态
const showMenu = ref(false);
function toggleMenu() {
  showMenu.value = !showMenu.value;
}

// 系统按钮
function minimize() {
  window.electronAPI?.windowMinimize();
}
function maximize() {
  window.electronAPI?.windowMaximize();
}
function close() {
  window.electronAPI?.windowClose();
}

// 开发环境菜单操作
function refresh() {
  window.location.reload();
  showMenu.value = false;
}
function toggleDevTools() {
  window.electronAPI?.windowToggleDevTools();
  showMenu.value = false;
}
function quitApp() {
  window.electronAPI?.appQuit();
  showMenu.value = false;
}
</script>

<style scoped lang="scss">
.title-bar {
  height: 35px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  -webkit-app-region: drag;
  background: #222;
  color: #fff;
  padding: 0 10px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;

  .actions {
    display: flex;
    gap: 6px;
    -webkit-app-region: no-drag;

    button {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
    }

    .dev-menu {
      position: relative;
      width: 100px;

      .menu-dropdown {
        position: absolute;
        top: 35px;
        right: 0;
        background: #333;
        border-radius: 5px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        button {
          width: 100%;
          padding: 5px 10px;
          text-align: left;
          &:hover {
            background: #444;
          }
        }
      }
    }
  }

  .popup {
    position: absolute;
    top: 40px;
    right: 10px;
    width: 200px;
    padding: 15px;
    background: #333;
    color: #fff;
    border-radius: 8px;
  }
}
</style>
