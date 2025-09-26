import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
// import VueTianditu from "vue-tianditu";
import "@/font/font.css";
const app = createApp(App);

app.use(store);
app.use(router);
// // 天地图服务
// app.use(VueTianditu, {
//   v: "4.0", //目前只支持4.0版本
//   tk: "d0f52b1bd3f5a580a48e690aa80f5deb",
// });
app.use(ElementPlus);
app.mount("#app");
