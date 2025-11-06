import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useCommonStore } from "@/store";
const commonStore = useCommonStore();
import { ElMessage } from "element-plus";
const request = axios.create({
  baseURL: commonStore.baseUrl,
  timeout: 1000 * 60,
  headers: {
    "Content-Type": "application/json",
  },
});

request.interceptors.request.use((config) => {
  if (config.headers) {
    // config.headers['Authorization'] = 'Bearer ' + storage.get('token');
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    // 接口其他错误
    if (response.status !== 200) {
      ElMessage.error(response.data.message || "服务器端错误");
      return Promise.reject(new Error(response.data.message || "Error"));
    }
    return Promise.resolve(response);
  },
  (error) => {
    let message = error.message;
    if (message === "Network Error") {
      message = "后端网络故障";
    } else if (message.includes("timeout")) {
      message = "接口请求超时";
    } else if (message.includes("Request failed with status code")) {
      message = `接口${message.substring(message.length - 3)}异常`;
    }
    ElMessage.error(message);
    return Promise.reject(error);
  }
);

export default request;
