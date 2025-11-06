import { createPinia } from "pinia";

import { useCommonStore } from "./modules/common"; //通用
import { useLayerStore } from "./modules/layer"; // 多图层

const pinia = createPinia();

// 导出实例供全局使用
export default pinia;

export { useCommonStore, useLayerStore };
