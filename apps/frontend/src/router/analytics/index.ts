import layout from '@/layout/index.vue';

export default [
  {
    path: '/analytics',
    component: layout,
    children: [
      {
        path: 'overview',
        component: () => import('@/views/Analytics/index.vue'),
      },
    ],
  },
];
