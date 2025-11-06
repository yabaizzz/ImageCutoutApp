import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import pinia from "./store";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";

import "@/font/font.css";
const app = createApp(App);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}
app.use(pinia);
app.use(router);
// // 天地图服务
// app.use(VueTianditu, {
//   v: "4.0", //目前只支持4.0版本
//   tk: "d0f52b1bd3f5a580a48e690aa80f5deb",
// });
app.use(ElementPlus);
app.mount("#app");
