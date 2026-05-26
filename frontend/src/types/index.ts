export interface Department {
  id: number
  code: string
  name: string
}

export interface Team {
  id: number
  code: string
  name: string
  department_id: number
}

export interface Report {
  id: number
  user_id: number
  team_id: number
  team_name?: string
  content_html: string
  report_date: string
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: number
  report_id: number
  filename: string
  mimetype: string
  url: string
  created_at: string
}

export interface FinalReport {
  id: number
  report_date: string
  content_html: string
  team_summary: Record<string, unknown> | null
  teams?: string[]
  created_at: string
  updated_at: string
}

export interface CreateReportPayload {
  content_html: string
  report_date: string
  user_id: number
  team_id?: number
}

export interface UpdateReportPayload {
  content_html?: string
  report_date?: string
  team_id?: number
}

export interface SignupPayload {
  username: string
  password: string
  display_name: string
  team_id: number
  email?: string
}

export interface User {
  id: number
  username: string
  display_name: string
  is_admin?: boolean
  team_id: number
  team_name?: string
  team_color?: string
  department_id?: number
  department_name?: string
  department_color?: string
  email?: string | null
}
