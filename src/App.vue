<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SwitchButton } from '@element-plus/icons-vue'
const router = useRouter(); const route = useRoute()
const nav = [{ path: '/overview', label: '成本分析' }, { path: '/multi-analysis', label: '多维分析' }, { path: '/forecast', label: '预测分析' }, { path: '/query', label: '自助查询' }, { path: '/mapping-config', label: '映射配置' }]
const active = computed(() => route.path)
</script>
<template><div class="app-shell"><header class="topbar"><div class="brand"><span class="brand-mark">M</span><strong>中国外运</strong><i></i><b>业财融合</b></div><nav class="top-nav"><button v-for="item in nav" :key="item.path" :class="{active: active === item.path}" @click="router.push(item.path)">{{ item.label }}</button></nav><div class="top-user"><el-icon><SwitchButton /></el-icon><span class="user-line"></span><el-avatar :size="28">A</el-avatar><span>admin</span></div></header><main class="main"><div class="content"><router-view/></div></main></div></template>
