import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/SignupPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      redirect: '/meetings',
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
      path: '/notes',
      name: 'notes-list',
      component: () => import('../views/MeetingNotesListPage.vue'),
    },
    {
      path: '/notes/new',
      name: 'note-create',
      component: () => import('../views/MeetingNoteCreatePage.vue'),
    },
    {
      path: '/notes/:id/edit',
      name: 'note-edit',
      component: () => import('../views/MeetingNoteEditPage.vue'),
    },
    {
      path: '/notices',
      name: 'notice-list',
      component: () => import('../views/NoticeListPage.vue'),
    },
    {
      path: '/my-reports',
      name: 'my-reports',
      component: () => import('../views/MyReportsPage.vue'),
    },
    {
      path: '/admin/users',
      name: 'user-management',
      component: () => import('../views/UserManagementPage.vue'),
    },
    {
      path: '/admin/teams',
      name: 'team-management',
      component: () => import('../views/TeamManagementPage.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const isPublic = to.meta.public === true
  const hasToken = !!to.query.token
  const raw = localStorage.getItem('meeting_user')
  const hasUser = !!raw

  if (!isPublic && !hasToken && !hasUser) {
    return { name: 'login' }
  }

  if (to.meta.admin === true && raw) {
    try {
      const user = JSON.parse(raw)
      if (!user.is_admin) return { name: 'my-reports' }
    } catch {
      return { name: 'my-reports' }
    }
  }
})

export default router
