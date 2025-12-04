// 模拟统计信息API
export const getPolygonStatistics = (params) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 模拟处理后的统计信息
      const mockStatistics = {
        mean: {
          layer1: Math.random() * 100 + 50,
          layer2: Math.random() * 100 + 50,
          difference: Math.random() * 20 - 10,
        },
        std: {
          layer1: Math.random() * 30 + 10,
          layer2: Math.random() * 30 + 10,
          difference: Math.random() * 10 - 5,
        },
        min: {
          layer1: Math.floor(Math.random() * 50),
          layer2: Math.floor(Math.random() * 50),
          difference: Math.floor(Math.random() * 20 - 10),
        },
        max: {
          layer1: Math.floor(Math.random() * 100 + 150),
          layer2: Math.floor(Math.random() * 100 + 150),
          difference: Math.floor(Math.random() * 20 - 10),
        },
        median: {
          layer1: Math.random() * 100 + 50,
          layer2: Math.random() * 100 + 50,
          difference: Math.random() * 20 - 10,
        },
      };

      resolve({
        data: mockStatistics,
        message: "统计信息获取成功",
      });
    }, 1500);
  });
};

// 实际项目中，这个文件应该包含与后端通信的真实API
