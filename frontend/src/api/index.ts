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
  baseURL: '/meeting/api',
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

export function updateUserTeam(userId: number, teamId: number) {
  return api.put<User>(`/auth/users/${userId}`, { team_id: teamId })
}

export function deleteUser(userId: number) {
  return api.delete(`/auth/users/${userId}`)
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

export function getPreviousWeekReport(userId: number, reportDate: string) {
  return api.get<Report | null>('/reports/previous', { params: { user_id: userId, report_date: reportDate } })
}

export function updateReport(id: number, data: UpdateReportPayload) {
  return api.put<Report>(`/reports/${id}`, data)
}

export function deleteReport(id: number) {
  return api.delete(`/reports/${id}`)
}

export function polishReport(contentHtml: string, previousContentHtml?: string) {
  return api.post<{ content_html: string }>('/reports/polish', { content_html: contentHtml, previous_content_html: previousContentHtml })
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

export function getPreviousFinalReport(reportDate: string, departmentId: number) {
  return api.get<FinalReport | null>('/final-reports/previous', { params: { report_date: reportDate, department_id: departmentId } })
}

export function analyzeWeeklyComparison(currentHtml: string, previousHtml: string, currentDate: string, previousDate: string) {
  return api.post<{ analysis_html: string }>('/final-reports/analyze', {
    current_html: currentHtml,
    previous_html: previousHtml,
    current_date: currentDate,
    previous_date: previousDate,
  })
}

export default api
