<template>
  <el-card>
    <div>
      <el-button type="primary" @click="uploadLayer">上传图层</el-button>
    </div>
    <el-list>
      <el-list-item
        v-for="layer in layers"
        :key="layer.id"
        style="display: inline-block"
      >
        <el-checkbox v-model="layer.visible"></el-checkbox>
        <span @click="setActive(layer.id)">{{ layer.name }}</span>
        <el-button @click="duplicate(layer.id)" size="mini">复制</el-button>
        <el-button @click="remove(layer.id)" size="mini" type="danger"
          >删除</el-button
        >
      </el-list-item>
    </el-list>
  </el-card>
</template>

<script setup>
import { computed, ref } from "vue";
import { useLayerStore } from "@/store/index.js";
import { ElMessage } from "element-plus";

const layerStore = useLayerStore();
const layers = computed(() => layerStore.layers);

function setActive(id) {
  layerStore.setActiveLayer(id);
}
function duplicate(id) {
  layerStore.duplicateLayer(id);
}
function remove(id) {
  layerStore.removeLayer(id);
}

function uploadLayer() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      layerStore.addLayer({
        id: Date.now().toString(),
        name: file.name,
        image: img,
        visible: true,
        opacity: 1,
        history: [],
      });
    };
  };
  input.click();
}
</script>
