<script setup lang="ts">
import type { QueryTemplate } from '../../api/self-query'
defineProps<{ template: QueryTemplate }>()
const emit = defineEmits<{ command: [command: string] }>()
function onCommand(command: string) { emit('command', command) }
</script>
<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="onCommand"><button class="query-template-menu" aria-label="模板更多操作" @click.stop><el-icon><MoreFilled/></el-icon></button><template #dropdown><el-dropdown-menu class="query-template-dropdown"><el-dropdown-item v-if="!template.builtin" command="edit"><el-icon><EditPen/></el-icon>编辑基本信息</el-dropdown-item><el-dropdown-item command="config"><el-icon><Setting/></el-icon>修改配置</el-dropdown-item><el-dropdown-item command="copy"><el-icon><CopyDocument/></el-icon>另存为新模板</el-dropdown-item><el-dropdown-item v-if="template.builtin" command="reset"><el-icon><RefreshLeft/></el-icon>恢复模板默认值</el-dropdown-item><el-dropdown-item command="delete" :disabled="template.builtin"><el-icon><Delete/></el-icon>删除模板</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
</template>
