<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>
<template><section class="panel empty-page"><h2>{{ route.meta.title }}</h2><p>该模块已接入统一布局、筛选状态和视觉令牌，等待业务接口接入。</p><el-empty description="暂无可展示数据" /></section></template>
