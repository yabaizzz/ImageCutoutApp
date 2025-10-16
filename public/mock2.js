export const mockData = {
  code: 200,
  message: "处理成功",
  type: "boundingBox", // 明确为第二种格式
  imageInfo: {
    name: "卫星遥感图像.png",
    width: 1200,
    height: 800,
    size: "2.4 MB",
  },
  // 核心：将原 boundingBox 数组转换为 maskData 数组，每个元素关联 classId
  maskData: [
    {
      classId: 0, // 关联类别ID（与 statistics 中的 classId 对应）
      type: "boundingBox", // 标记为第二种格式
      boundingBox: {
        x: 0.245507,
        y: 0.906863,
        width: 0.036356,
        height: 0.036356,
      },
    },
    {
      classId: 1,
      type: "boundingBox",
      boundingBox: {
        x: 0.861111,
        y: 0.82884,
        width: 0.066177,
        height: 0.037582,
      },
    },
    {
      classId: 2,
      type: "boundingBox",
      bbox: {
        x: 0.410131,
        y: 0.70915,
        width: 0.045751,
        height: 0.085376,
      },
      boundingBox: {
        x: 0.410131,
        y: 0.70915,
        width: 0.045751,
        height: 0.085376,
      },
    },
    {
      classId: 3,
      type: "boundingBox",
      boundingBox: {
        x: 0.672794,
        y: 0.707516,
        width: 0.232843,
        height: 0.100899,
      },
    },
    {
      classId: 0, // 可重复使用 classId，对应同一类别
      type: "boundingBox",
      boundingBox: {
        x: 0.17933,
        y: 0.590686,
        width: 0.043709,
        height: 0.071487,
      },
    },
    {
      classId: 1,
      type: "boundingBox",
      boundingBox: {
        x: 0.163399,
        y: 0.502042,
        width: 0.055555,
        height: 0.042484,
      },
    },
    {
      classId: 2,
      type: "boundingBox",
      boundingBox: {
        x: 0.551062,
        y: 0.486928,
        width: 0.088644,
        height: 0.074755,
      },
    },
  ],
  statistics: [
    // 保持不变，与 classId 对应
    {
      classId: 0,
      count: 2,
      area: 216815,
      perimeter: 6806,
    },
    {
      classId: 1,
      count: 2,
      area: 498944,
      perimeter: 6902,
    },
    {
      classId: 2,
      count: 2,
      area: 887553,
      perimeter: 8236,
    },
    {
      classId: 3,
      count: 1,
      area: 5783699,
      perimeter: 12581,
    },
  ],
};

export const colorMap = {
  0: { name: "城市土地", color: "rgba(0, 255, 255, 0.5)" },
  1: { name: "农业用地", color: "rgba(255, 255, 0, 0.5)" },
  2: { name: "牧场", color: "rgba(255, 0, 255, 0.5)" },
  3: { name: "森林", color: "rgba(0, 255, 0, 0.5)" },
  4: { name: "水系", color: "rgba(0, 0, 255, 0.5)" },
  5: { name: "荒地", color: "rgba(255, 255, 255, 0.5)" },
  6: { name: "未知土地", color: "rgba(0, 0, 0, 0.5)" },
};
