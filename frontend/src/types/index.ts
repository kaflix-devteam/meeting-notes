export interface Team {
  id: number
  name: string
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
  team_id: number
  content_html: string
  report_date: string
  user_id: number
}

export interface UpdateReportPayload {
  team_id?: number
  content_html?: string
  report_date?: string
}
