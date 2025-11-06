<template>
  <el-card class="process-history-card">
    <el-table
      :data="history"
      style="width: 100%"
      border
      stripe
      size="small"
      row-key="img_id"
      :expand-row-keys="expandedRowKeys"
      @expand-change="onExpandChange"
    >
      <!-- 展开列 -->
      <el-table-column type="expand">
        <template #default="{ row }">
          <el-table
            v-loading="row.loading"
            :data="row.children"
            size="small"
            border
          >
            <el-table-column prop="process_type" label="步骤" />
            <el-table-column prop="status" label="详情" />

            <el-table-column label="操作" width="150">
              <template #default="{ row: child }">
                <div class="action-buttons">
                  <el-button
                    size="small"
                    type="primary"
                    text
                    @click="openChildDialog(child)"
                  >
                    查看详情
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    text
                    @click="deleteChildTask(row, child)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </el-table-column>

      <!-- 可编辑文件名 -->
      <el-table-column label="文件名">
        <template #default="{ row }">
          <div class="editable-cell">
            <el-input
              v-if="editingRow === row"
              v-model="editValue"
              size="small"
              class="edit-input"
            />
            <span v-else>{{ row.filename }}</span>

            <el-icon
              v-if="editingRow !== row"
              class="edit-icon"
              @click="startEdit(row)"
            >
              <Edit />
            </el-icon>

            <template v-else>
              <el-icon class="confirm-icon" @click="confirmEdit(row)">
                <Check />
              </el-icon>
              <el-icon class="cancel-icon" @click="cancelEdit">
                <Close />
              </el-icon>
            </template>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="action" label="操作" />
      <el-table-column prop="upload_time" label="处理时间" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button size="small" type="danger" text @click="deleteimg(row)">
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="history.length === 0" class="no-data">暂无处理历史</div>

    <!-- 预留弹窗 -->
    <el-dialog v-model="dialogVisible" title="详情弹窗" width="500px">
      <div class="custom-dialog-body">
        <slot name="custom-dialog"></slot>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted, toRaw } from "vue";
import { ElMessage } from "element-plus";
import { Edit, Check, Close } from "@element-plus/icons-vue";
import moment from "moment";
import {
  getImageHistory,
  editImageTitle,
  deleteImage,
  getImageTasks,
  editTaskImageTitle,
  deleteTaskImage,
} from "@/api/api";
import { useCommonStore } from "@/store";
const store = useCommonStore();

// 示例数据
const history = ref([]);

// ✅ 手风琴模式控制
const expandedRowKeys = ref([]); // 当前展开的行的key数组

// ✅ 文件名编辑逻辑
const editingRow = ref(null);
const editValue = ref("");

// ✅ 弹窗逻辑
const dialogVisible = ref(false);
const currentChild = ref(null);

// ✅ 手风琴模式：展开行变化处理
function onExpandChange(row, expandedRows) {
  // 如果当前行被展开
  if (expandedRows.length > 0) {
    // 只保留当前展开的行，实现手风琴效果
    expandedRowKeys.value = [row.img_id];

    // 加载子数据
    if (!row.children) {
      row.loading = true;
      getImageTasks(row.img_id)
        .then((res) => {
          res.data.tasks.forEach((x) => {
            x.process_time = moment(x.process_time).format(
              "YYYY-MM-DD HH:mm:ss"
            );
            x.process_type = store.algorithms.find(
              (y) => y.value == x.process_type
            ).label;
          });
          row.children = res.data.tasks;
        })
        .finally(() => {
          row.loading = false;
        });
    }
  } else {
    // 如果当前行被关闭，清空展开的key
    expandedRowKeys.value = [];
  }
}

// 开始编辑
function startEdit(row) {
  editingRow.value = row;
  editValue.value = row.filename;
}

// 确认修改
function confirmEdit(row) {
  if (!editValue.value.trim()) {
    ElMessage.warning("文件名不能为空");
    return;
  }

  try {
    editImageTitle({ image_id: row.img_id, title: editValue.value }).then(
      (res) => {
        if (res.data.message == "图像标题更新成功") {
          row.filename = res.data.new_title;
        }
      }
    );
  } catch {
    ElMessage.error("请求失败，请稍后重试");
    console.error(error);
  } finally {
    editingRow.value = null;
  }
}

// 取消修改
function cancelEdit() {
  editingRow.value = null;
  editValue.value = "";
}

// 删除上传头像列表
function deleteimg(row) {
  console.log("row", toRaw(row));
  try {
    deleteImage(row.img_id).then((res) => {
      console.log("rrrrrr", res);
      if (res.data.message == "图像删除成功") {
        ElMessage.success("图像删除成功");
        history.value = history.value.filter(
          (item) => item.img_id !== row.img_id
        );
        // 如果删除的是当前展开的行，清空展开状态
        if (expandedRowKeys.value.includes(row.img_id)) {
          expandedRowKeys.value = [];
        }
      }
    });
  } catch (error) {
    ElMessage.error("请求失败，请稍后重试");
    console.error(error);
  }
}

// 删除子任务
function deleteChildTask(parentRow, child) {
  // 这里添加删除子任务的逻辑
  console.log("删除子任务:", parentRow, child);
  ElMessage.info("删除子任务功能待实现");
}

// 打开子项详情弹窗
function openChildDialog(child) {
  currentChild.value = child;
  dialogVisible.value = true;
}

onMounted(() => {
  getImageHistory().then((res) => {
    if (res.status == "200") {
      history.value = res.data.images.map((item) => ({
        ...item,
        upload_time: moment(item.upload_time).format("YYYY-MM-DD HH:mm:ss"),
        loading: false, // 添加加载状态
        children: null, // 初始化为null，延迟加载
      }));
    }
  });
});
</script>

<style lang="scss" scoped>
.process-history-card {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  font-size: 14px; // 默认内容字体
  box-sizing: border-box;

  h3 {
    margin-bottom: 10px;
    font-weight: 600;
    font-size: 16px;
  }

  // 表格样式统一调整
  :deep(.el-table) {
    font-size: 14px; // 表格内容字体

    // 表头字体更大一些
    .el-table__header-wrapper th {
      font-size: 16px;
      font-weight: 600;
      background: #f9fafc;
    }

    // 每行固定高度
    .el-table__row {
      height: 44px;
    }

    // 让单元格内文字垂直居中
    .cell {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      line-height: normal;
    }

    // 展开行样式调整
    .el-table__expand-column {
      .cell {
        justify-content: flex-start;
      }
    }
  }

  .editable-cell {
    display: flex;
    align-items: center;
    height: 100%;
    gap: 6px;

    .edit-input {
      width: 140px;
      height: 28px;
    }

    .edit-icon,
    .confirm-icon,
    .cancel-icon {
      cursor: pointer;
      font-size: 16px;
      transition: color 0.2s ease;
    }

    .edit-icon {
      color: #409eff;
      &:hover {
        color: #66b1ff;
      }
    }

    .confirm-icon {
      color: #67c23a;
      &:hover {
        color: #85ce61;
      }
    }

    .cancel-icon {
      color: #f56c6c;
      &:hover {
        color: #f78989;
      }
    }
  }

  .no-data {
    text-align: center;
    padding: 20px 0;
    color: #999;
    font-size: 14px;
  }

  .custom-dialog-body {
    min-height: 150px;
    padding: 10px;
    background: #fafafa;
    border-radius: 6px;
    font-size: 14px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
}
</style>
