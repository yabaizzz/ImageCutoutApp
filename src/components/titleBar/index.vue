<!-- 
  时间：2024年12月5日15:06:08
  作者；罗佳琪
  描述：驾驶舱顶部标题栏
-->

<template>
  <div class="title-home">
    <div class="title">{{ $store.state.title }}</div>
    <!-- <div class="time">
      <span>{{ time }}</span>
      <span>{{ days }}</span>
    </div> -->
  </div>
</template>

<script>
import moment from "moment";
export default {
  data() {
    return {
      time: "",
      days: "",
      timer: null,
    };
  },
  methods: {
    // 获取时间
    getTime() {
      this.time = moment(new Date()).format("HH:mm");
      this.days = moment(new Date()).format("YYYY-MM-DD");
    },
    // 定时器刷新时间
    startTime() {
      this.timer = setInterval(() => {
        this.getTime();
      }, 6000); // 6000ms = 1min
    },
    // 离开页面时，移除定时器
    endTime() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null; // 清除定时器ID
      }
    },
  },
  mounted() {
    // 获取初始化时间
    // this.getTime();
    // 开启定时器
    // this.startTime();
  },
  beforeDestroy() {
    // 离开页面时，移除定时器
    // this.endTime();
  },
};
</script>

<style lang="scss">
.title-home {
  display: flex;
  font-size: 16px;
  height: 88px;
  width: 100%;
  position: relative;
  color: #fff;
  background-image: url("@/assets/title.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
  .title {
    display: flex;
    align-items: center;
    position: absolute;
    top: 4%;
    left: 50%;
    // height: 88%;
    font-weight: bold;
    text-shadow: 0 0 10px #3affe4;
    transform: translateX(-50%);
    margin: 0;
    letter-spacing: 10px;
    font-size: 40px;
  }
  .time {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: absolute;
    right: 38px;
    bottom: 20px;
    width: auto;
    span {
      &:nth-child(1) {
        font-size: 30px;
      }
      &:nth-child(2) {
        font-size: 16px;
      }
    }
  }
}
</style>