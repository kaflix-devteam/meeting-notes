import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/meeting'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomePage.vue'),
    },
    {
      path: '/reports/new',
      name: 'report-create',
      component: () => import('../views/ReportCreatePage.vue'),
    },
    {
      path: '/reports/:id/edit',
      name: 'report-edit',
      component: () => import('../views/ReportEditPage.vue'),
    },
    {
      path: '/meetings',
      name: 'meeting-list',
      component: () => import('../views/MeetingListPage.vue'),
    },
    {
      path: '/meetings/:id',
      name: 'meeting-detail',
      component: () => import('../views/MeetingDetailPage.vue'),
    },
    {
      path: '/my-reports',
      name: 'my-reports',
      component: () => import('../views/MyReportsPage.vue'),
    },
  ],
})

export default router
