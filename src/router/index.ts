import { createRouter, createWebHistory } from 'vue-router'
import Overview from '../views/Overview/index.vue'
import Placeholder from '../views/Placeholder/index.vue'
export default createRouter({ history: createWebHistory(), routes: [
  { path: '/', redirect: '/overview' },
  { path: '/overview', component: Overview, meta: { title: '总览' } },
  { path: '/multi-analysis', component: Placeholder, meta: { title: '多维分析' } },
  { path: '/forecast', component: Placeholder, meta: { title: '预测分析' } },
  { path: '/mapping-config', component: Placeholder, meta: { title: '映射管理配置' } },
  { path: '/detail/:id', component: Placeholder, meta: { title: '业务明细' } },
]})
