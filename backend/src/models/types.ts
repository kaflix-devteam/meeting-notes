export interface Department {
  id: number;
  code: string;
  name: string;
  created_at: Date;
}

export interface Team {
  id: number;
  code: string;
  name: string;
  department_id: number;
  created_at: Date;
}

export interface User {
  id: number;
  username: string;
  password: string;
  display_name: string;
  team_id: number;
  created_at: Date;
}

export interface Report {
  id: number;
  user_id: number;
  team_id: number;
  department_id: number;
  report_date: Date;
  content_html: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReportWithTeam extends Report {
  team_code: string;
  team_name: string;
  department_name?: string;
  user_display_name?: string;
}

export interface FinalReport {
  id: number;
  report_date: Date;
  content_html: string;
  team_summary: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface Attachment {
  id: number;
  report_id: number;
  original_name: string;
  stored_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  created_at: Date;
}
