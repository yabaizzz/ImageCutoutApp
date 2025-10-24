import { createStore } from "vuex";

export default createStore({
  state: {
    baseUrl: "http://192.168.1.2:8000",
    // baseUrl: "http://101.132.72.84:8000",
    algorithms: null, //算法列表
    defaultParams: null, //算法总参数
  },
  getters: {},
  mutations: {
    updataAlgorithms(state, data) {
      state.algorithms = data;
    },
    updataDefaultParams(state, data) {
      state.defaultParams = data;
    },
  },
  actions: {},
  modules: {},
});
