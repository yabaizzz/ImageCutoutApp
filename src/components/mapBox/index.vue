<!-- 
    * 地图组件
    *
-->
<template>
  <div id="container" />
</template>

<script setup>
import AMapLoader from "@amap/amap-jsapi-loader";
import { onMounted, onUnmounted, reactive, ref } from "vue";
import tzsMap from "/public/tzs.json";

let map = null;
// 引入地图的相关配置(key,组件,版本)
let mapData = ref({
  // 申请好的Web端开发者Key，首次调用 load 时必填
  key: "69be35414ad0fa3e6fa2618bd39985f4",
  // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
  version: "2.0",
  //需要使用的的插件列表，如比例尺'AMap.Scale'，支持添加多个如：['...','...']
  plugins: ["AMap.Scale", "AMap.GeoJSON", "AMap.Geocoder", "AMap.CircleMarker"],
});
// 初始化地图的数据
let mapConfig = ref({
  // 设置地图容器id
  viewMode: "3D", // 是否为3D地图模式
  zoom: 10, // 初始化地图级别
  baseLayerPicker: false, // 是否显示图层选择器
  center: [121.42079, 28.655716], // 初始化地图中心点位置
});

onMounted(() => {
  window._AMapSecurityConfig = {
    securityJsCode: "8981da6ea53f9a0d71927d79f3898ff7",
  };
  AMapLoader.load({ ...mapData.value })
    .then((AMap) => {
      map = new AMap.Map("container", {
        ...mapConfig.value,
        layers: [
          // 卫星
          new AMap.TileLayer.Satellite(),
          // 路网
          new AMap.TileLayer.RoadNet(),
        ],
      });
      // 绘制geojson地图（台州市json数据）
      var geojson = new AMap.GeoJSON({
        geoJSON: tzsMap,
        // 还可以自定义getMarker和getPolyline
        getPolygon: function (geojson, lnglats) {
          // 计算面积
          var area = AMap.GeometryUtil.ringArea(lnglats[0]);
          // 通过地图json数据渲染到地图上,圈出指定范围
          return new AMap.Polygon({
            path: lnglats,
            fillOpacity: 0.2,
            // fillOpacity: 1 - Math.sqrt(area / 8000000000), // 面积越大透明度越高
            strokeColor: "white",
            fillColor: "red",
          });
        },
      });
      map.add(geojson);
      // 地图打点
      let capitals = [{ center: [120.857218, 28.7175] }];
      for (var i = 0; i < capitals.length; i += 1) {
        var center = capitals[i].center;
        var circleMarker = new AMap.CircleMarker({
          center: center, //圆心
          radius: 8, //半径
          borderWeight: 3, //描边的宽度
          //strokeColor: "#fff", //轮廓线颜色
          strokeOpacity: 1, //轮廓线透明度
          strokeWeight: 1, //轮廓线宽度
          fillOpacity: 1, //圆形填充透明度
          strokeStyle: "dashed", //轮廓线样式
          strokeDasharray: [10, 10],
          fillColor: "#1791fc", //圆形填充颜色
          zIndex: 1, //圆形的叠加顺序
        });
        circleMarker.setMap(map);
        //圆形 Circle 对象添加到 Map
        // map.add(circleMarker);
        // //根据覆盖物范围调整视野
        // map.setFitView([circleMarker]);
      }
    })
    .catch((e) => {
      console.log(e);
    });
});

onUnmounted(() => {
  map?.destroy();
});
</script>

<style lang="scss" scoped>
#container {
  width: 100%;
  height: 100%;
}
</style>