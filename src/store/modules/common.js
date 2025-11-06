// 通用数据
import { defineStore } from "pinia";

// 定义并导出 store 模块，第一个参数是唯一 ID（必须唯一）
export const useCommonStore = defineStore("common", {
  // 状态（类似组件的 data）
  state: () => ({
    baseUrl: "http://192.168.1.2:8000",
    // baseUrl: "http://101.132.72.84:8000",
    algorithms: null, //算法列表
    defaultParams: null, //算法总参数
  }),

  // 计算属性（类似组件的 computed）
  getters: {},

  // 方法（类似组件的 methods，可异步）
  actions: {
    updataAlgorithms(data) {
      this.algorithms = data;
    },
    // 保存算法总参数
    updataDefaultParams(data) {
      this.defaultParams = data;
    },
  },
});
