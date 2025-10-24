const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  configureWebpack: {
    plugins: [
      new (require("webpack").DefinePlugin)({
        __VUE_OPTIONS_API__: JSON.stringify(true), // 是否启用 Options API
        __VUE_PROD_DEVTOOLS__: JSON.stringify(false), // 生产环境是否启用 devtools
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false), // 关闭 hydration mismatch 详细信息
      }),
    ],
  },
  transpileDependencies: true,
  publicPath: "./", // 相对路径
  devServer: {
    host: "0.0.0.0", // 允许外部设备访问
    port: 8080,
  },
});
