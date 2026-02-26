import axios from 'axios'
import type {
  Team,
  Report,
  FinalReport,
  CreateReportPayload,
  UpdateReportPayload,
} from '../types'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getTeams() {
  return api.get<Team[]>('/teams')
}

export function createReport(data: CreateReportPayload) {
  return api.post<Report>('/reports', data)
}

export function getMyReports(userId: number = 1) {
  return api.get<Report[]>('/reports', { params: { user_id: userId } })
}

export function getReport(id: number) {
  return api.get<Report>(`/reports/${id}`)
}

export function updateReport(id: number, data: UpdateReportPayload) {
  return api.put<Report>(`/reports/${id}`, data)
}

export function uploadAttachment(reportId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/reports/${reportId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getFinalReports() {
  return api.get<FinalReport[]>('/final-reports')
}

export function getFinalReport(id: number) {
  return api.get<FinalReport>(`/final-reports/${id}`)
}

export default api
