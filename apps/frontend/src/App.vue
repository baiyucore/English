<template>
  <RouterView />
  <Search />
  <Login />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import Search from './component/Search/index.vue';
import Login from './component/Login/index.vue';
import { IS_SHOW_LOGIN } from './component/Login/type.ts';
import { provide, ref } from 'vue';
provide(IS_SHOW_LOGIN, ref(false));
</script>
