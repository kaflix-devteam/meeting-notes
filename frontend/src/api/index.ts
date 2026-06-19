import axios from 'axios'
import type {
  Department,
  Team,
  Report,
  FinalReport,
  CreateReportPayload,
  UpdateReportPayload,
  SignupPayload,
  User,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getDepartments() {
  return api.get<Department[]>('/teams/departments')
}

export function getTeams(departmentId?: number) {
  if (departmentId) {
    return api.get<Team[]>('/teams', { params: { department_id: departmentId } })
  }
  return api.get<Team[]>('/teams')
}

export function signup(data: SignupPayload) {
  return api.post<User>('/auth/signup', data)
}

export function login(username: string, password: string) {
  return api.post<User>('/auth/login', { username, password })
}

export function getUsers() {
  return api.get<User[]>('/auth/users')
}

export function updateUserTeam(userId: number, teamId?: number, displayName?: string) {
  return api.put<User>(`/auth/users/${userId}`, {
    ...(teamId ? { team_id: teamId } : {}),
    ...(displayName ? { display_name: displayName } : {}),
  })
}

export function deleteUser(userId: number) {
  return api.delete(`/auth/users/${userId}`)
}

export function requestPasswordReset(email: string) {
  return api.post<{ message: string }>('/auth/forgot-password', { email })
}

export function verifyResetToken(token: string) {
  return api.get<{ valid: boolean; username?: string; display_name?: string; error?: string }>(
    '/auth/reset-password/verify',
    { params: { token } }
  )
}

export function resetPassword(token: string, newPassword: string) {
  return api.post<{ message: string }>('/auth/reset-password', {
    token,
    new_password: newPassword,
  })
}

export function verifySsoToken(token: string) {
  return api.get<User>('/auth/sso/verify', { params: { token } })
}

// 개인 MCP 토큰
export interface McpToken {
  id: number
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export function getMcpTokens(userId: number) {
  return api.get<McpToken[]>('/tokens', { params: { user_id: userId } })
}

export function createMcpToken(userId: number, name: string) {
  return api.post<McpToken & { token: string }>('/tokens', { user_id: userId, name })
}

export function deleteMcpToken(userId: number, tokenId: number) {
  return api.delete<{ message: string }>(`/tokens/${tokenId}`, { data: { user_id: userId } })
}

export function getAllTeams() {
  return api.get('/teams/all')
}

export function createTeam(departmentName: string, teamName: string, departmentColor?: string, teamColor?: string) {
  return api.post('/teams', { department_name: departmentName, team_name: teamName, department_color: departmentColor, team_color: teamColor })
}

export function updateTeam(id: number, departmentName: string, teamName: string, departmentColor?: string, teamColor?: string) {
  return api.put(`/teams/${id}`, { department_name: departmentName, team_name: teamName, department_color: departmentColor, team_color: teamColor })
}

export function deleteTeam(id: number) {
  return api.delete(`/teams/${id}`)
}

export function deleteFinalReport(id: number) {
  return api.delete(`/final-reports/${id}`)
}

export function createReport(data: CreateReportPayload) {
  return api.post<Report>('/reports', data)
}

export function getMyReports(userId?: number) {
  return api.get<Report[]>('/reports', { params: { user_id: userId } })
}

export function getAllReports() {
  return api.get<Report[]>('/reports', { params: { all: 'true' } })
}

export function getReport(id: number) {
  return api.get<Report>(`/reports/${id}`)
}

export function getPreviousWeekReport(userId: number, reportDate: string, teamId?: number) {
  return api.get<Report | null>('/reports/previous', { params: { user_id: userId, report_date: reportDate, ...(teamId ? { team_id: teamId } : {}) } })
}

export function checkDuplicateReport(userId: number, reportDate: string, teamId?: number) {
  return api.get<{ id: number } | null>('/reports/check-duplicate', {
    params: { user_id: userId, report_date: reportDate, ...(teamId ? { team_id: teamId } : {}) },
  })
}

export function updateReport(id: number, data: UpdateReportPayload) {
  return api.put<Report>(`/reports/${id}`, data)
}

export function deleteReport(id: number) {
  return api.delete(`/reports/${id}`)
}

export function polishReport(contentHtml: string, previousContentHtml?: string) {
  return api.post<{ content_html: string; apiKeyPrefix?: string }>('/reports/polish', { content_html: contentHtml, previous_content_html: previousContentHtml })
    .then((res) => {
      const headerPrefix = res.headers['x-claude-key-prefix']
      const bodyPrefix = res.data?.apiKeyPrefix
      console.log('[polishReport] CLAUDE_API_KEY prefix:', bodyPrefix || headerPrefix || '(none)')
      return res
    })
    .catch((err) => {
      const headerPrefix = err?.response?.headers?.['x-claude-key-prefix']
      const data = err?.response?.data
      console.error('[polishReport] failed:', {
        apiKeyPrefix: data?.apiKeyPrefix || headerPrefix || '(none)',
        status: err?.response?.status,
        detail: data?.detail,
        body: data,
      })
      throw err
    })
}

export function uploadAttachment(reportId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/reports/${reportId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function uploadImage(file: File | Blob) {
  const formData = new FormData()
  if (file instanceof Blob && !(file instanceof File)) {
    formData.append('image', file, 'pasted-image.png')
  } else {
    formData.append('image', file)
  }
  return api.post<{ url: string }>('/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function mergeFinalReport(reportDate: string, departmentId?: number) {
  return api.post<{ message: string }>('/final-reports/merge', {
    report_date: reportDate,
    ...(departmentId ? { department_id: departmentId } : {}),
  })
}

export function getFinalReports() {
  return api.get<FinalReport[]>('/final-reports')
}

export function getFinalReport(id: number) {
  return api.get<FinalReport>(`/final-reports/${id}`)
}

export function getPreviousFinalReport(reportDate: string, departmentId: number, tagSignature?: string) {
  return api.get<FinalReport | null>('/final-reports/previous', {
    params: { report_date: reportDate, department_id: departmentId, tag_signature: tagSignature || '' }
  })
}

export function generateShareLink(finalReportId: number) {
  return api.post<{ share_url: string; share_token: string }>(`/final-reports/${finalReportId}/share`)
}

export function getSharedReport(token: string) {
  return api.get<FinalReport>(`/final-reports/shared/${token}`)
}

export function sendShareEmail(finalReportId: number, recipients: string[]) {
  return api.post<{ message: string; share_url: string }>(`/final-reports/${finalReportId}/send-email`, { recipients })
}

// Tags
export function getTags(departmentId: number, teamId: number) {
  return api.get<any[]>('/tags', { params: { department_id: departmentId, team_id: teamId } })
}

export function createTagApi(name: string, teamId: number, departmentId: number) {
  return api.post<any>('/tags', { name, team_id: teamId, department_id: departmentId })
}

export function deleteTagApi(id: number) {
  return api.delete(`/tags/${id}`)
}

export function getReportTags(reportId: number) {
  return api.get<any[]>(`/tags/report/${reportId}`)
}

export function setReportTags(reportId: number, tagIds: number[]) {
  return api.put(`/tags/report/${reportId}`, { tag_ids: tagIds })
}

// Meeting Notes (회의록)
export function getMeetingNotesList(params?: { userId?: number; all?: boolean }) {
  if (params?.all) {
    return api.get<any[]>('/meeting-notes', { params: { all: 'true' } })
  }
  if (params?.userId) {
    return api.get<any[]>('/meeting-notes', { params: { user_id: params.userId } })
  }
  return api.get<any[]>('/meeting-notes')
}

export function getMeetingNoteById(id: number) {
  return api.get<any>(`/meeting-notes/${id}`)
}

export function createMeetingNote(data: { report_date: string; department_id: number; team_id?: number; user_id: number; content_html: string; tag_signature?: string }) {
  return api.post<{ id: number; message: string }>('/meeting-notes', data)
}

export function updateMeetingNote(id: number, data: { content_html: string; report_date: string; team_id?: number; department_id?: number; tag_signature?: string }) {
  return api.put(`/meeting-notes/${id}`, data)
}

export function deleteMeetingNote(id: number) {
  return api.delete(`/meeting-notes/${id}`)
}

export function generateNoteShareLink(noteId: number) {
  return api.post<{ share_url: string; share_token: string }>(`/meeting-notes/${noteId}/share`)
}

export function getSharedMeetingNote(token: string) {
  return api.get<any>(`/meeting-notes/shared/${token}`)
}

export function sendNoteShareEmail(noteId: number, recipients: string[]) {
  return api.post<{ message: string; share_url: string }>(`/meeting-notes/${noteId}/send-email`, { recipients })
}

export function saveMeetingNotes(finalReportId: number, meetingNotes: string) {
  return api.put(`/final-reports/${finalReportId}/meeting-notes`, { meeting_notes: meetingNotes })
}

// 공지
export function getNotices(userId?: number) {
  return api.get<any[]>('/notices', { params: userId ? { user_id: userId } : {} })
}

export function getUnreadNotices(userId: number) {
  return api.get<any[]>('/notices/unread', { params: { user_id: userId } })
}

export function createNotice(data: { title: string; content: string }) {
  return api.post<{ id: number; message: string }>('/notices', data)
}

export function updateNotice(id: number, data: { title: string; content: string }) {
  return api.put(`/notices/${id}`, data)
}

export function deleteNotice(id: number) {
  return api.delete(`/notices/${id}`)
}

export function markNoticeAsRead(id: number, userId: number) {
  return api.post(`/notices/${id}/read`, { user_id: userId })
}

export function markAllNoticesAsRead(userId: number) {
  return api.post('/notices/read-all', { user_id: userId })
}

export function analyzeWeeklyComparison(currentHtml: string, previousHtml: string, currentDate: string, previousDate: string, finalReportId?: number) {
  return api.post<{ analysis_html: string }>('/final-reports/analyze', {
    current_html: currentHtml,
    previous_html: previousHtml,
    current_date: currentDate,
    previous_date: previousDate,
    final_report_id: finalReportId,
  })
}

export default api
