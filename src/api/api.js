import request from "@/utils/http";

// 上传图片
export const fileUpload = (file) => {
  const formData = new FormData();
  formData.append("image", file);

  return request.post("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/** 应用算法处理图像 */
export const getProcess = (image_id, data) =>
  request.post(`/api/process/${image_id}`, null, {
    params: data,
  });

/** 获取默认参数 */
export const getDefaultParams = (params) =>
  request.get("/api/config", { params });

// 上传图像历史
export const getImageHistory = (params) => request.get("/api/images");

// 修改上传图像历史标题
export const editImageTitle = (data) =>
  request.put(`/api/image/${data.image_id}/title`, null, {
    params: { title: data.title },
  });

// 删除图像
export const deleteImage = (image_id) =>
  request.delete(`/api/image/${image_id}/delete`);

// 图像处理历史
export const getImageTasks = (image_id) =>
  request.get(`/api/tasks/${image_id}`);

// 修改上传图像处理历史标题
export const editTaskImageTitle = (data) =>
  request.put(`/api/task/${data.task_id}/title`, null, {
    params: { new_title: data.title },
  });

// 删除任务图像
export const deleteTaskImage = (task_id) =>
  request.delete(`/api/task/${task_id}/delete`);

// 普通图像标记
export const fileUpload1 = (image, txt) => {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("annotation", txt);

  return request.post("/api/annotation", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// 特殊图像标记
export const fileUpload2 = (file) => {
  const formData = new FormData();
  formData.append("image", file);

  return request.post("/api/annotation2", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
