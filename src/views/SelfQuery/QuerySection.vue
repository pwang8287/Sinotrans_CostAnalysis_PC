<script setup lang="ts">
defineProps<{ title: string; summary?: string; icon?: string; open: boolean; nested?: boolean }>()
defineEmits<{ toggle: [] }>()
</script>
<template>
  <section :class="['query-accordion', {open, nested}]">
    <button class="query-accordion-heading" :aria-expanded="open" @click="$emit('toggle')"><span><el-icon v-if="icon"><component :is="icon"/></el-icon><strong>{{ title }}</strong><small v-if="nested">{{ summary }}</small></span><span><small v-if="!nested">{{ summary }}</small><el-icon class="query-accordion-chevron"><ArrowRight/></el-icon></span></button>
    <div v-show="open" class="query-accordion-body"><slot/></div>
  </section>
</template>
