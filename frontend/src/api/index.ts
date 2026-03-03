import axios from 'axios'
import type {
  Team,
  Report,
  FinalReport,
  CreateReportPayload,
  UpdateReportPayload,
} from '../types'

const api = axios.create({
  baseURL: '/meeting/api',
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

export function deleteReport(id: number) {
  return api.delete(`/reports/${id}`)
}

export function polishReport(contentHtml: string) {
  return api.post<{ content_html: string }>('/reports/polish', { content_html: contentHtml })
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

export function getFinalReports() {
  return api.get<FinalReport[]>('/final-reports')
}

export function getFinalReport(id: number) {
  return api.get<FinalReport>(`/final-reports/${id}`)
}

export default api
