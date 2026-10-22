import { createRouter, createWebHashHistory } from 'vue-router'
import Overview from '../views/Overview/index.vue'
import MultiAnalysis from '../views/MultiAnalysis/index.vue'
import MappingConfig from '../views/MappingConfig/index.vue'
import SelfQuery from '../views/SelfQuery/index.vue'
import Forecast from '../views/Forecast/index.vue'
import Placeholder from '../views/Placeholder/index.vue'
export default createRouter({ history: createWebHashHistory(import.meta.env.BASE_URL), routes: [
  { path: '/', redirect: '/overview' },
  { path: '/overview', component: Overview, meta: { title: '总览' } },
  { path: '/multi-analysis', component: MultiAnalysis, meta: { title: '多维分析' } },
  { path: '/forecast', component: Forecast, meta: { title: '预测分析' } },
  { path: '/query', component: SelfQuery, meta: { title: '自助查询' } },
  { path: '/mapping-config', component: MappingConfig, meta: { title: '映射管理配置' } },
  { path: '/detail/:id', component: Placeholder, meta: { title: '业务明细' } },
]})
