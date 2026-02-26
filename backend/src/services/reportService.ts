import pool from '../config/database';
import { Report, ReportWithTeam, Attachment } from '../models/types';

export async function createReport(
  userId: number,
  teamId: number,
  reportDate: string,
  contentHtml: string
): Promise<Report> {
  const result = await pool.query(
    `INSERT INTO reports (user_id, team_id, report_date, content_html)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, teamId, reportDate, contentHtml]
  );
  return result.rows[0];
}

export async function getReportById(id: number): Promise<ReportWithTeam | null> {
  const result = await pool.query(
    `SELECT r.id, r.user_id, r.team_id, TO_CHAR(r.report_date, 'YYYY-MM-DD') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getReportsByUserId(userId: number): Promise<ReportWithTeam[]> {
  const result = await pool.query(
    `SELECT r.id, r.user_id, r.team_id, TO_CHAR(r.report_date, 'YYYY-MM-DD') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.user_id = $1
     ORDER BY r.report_date DESC, r.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function updateReport(
  id: number,
  contentHtml: string,
  teamId: number,
  reportDate: string
): Promise<Report | null> {
  const result = await pool.query(
    `UPDATE reports
     SET content_html = $1, team_id = $2, report_date = $3
     WHERE id = $4
     RETURNING *`,
    [contentHtml, teamId, reportDate, id]
  );
  return result.rows[0] || null;
}

export async function deleteReport(id: number): Promise<{ report_date: string } | null> {
  const result = await pool.query(
    `DELETE FROM reports WHERE id = $1 RETURNING report_date`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getReportsByDate(reportDate: string): Promise<ReportWithTeam[]> {
  const result = await pool.query(
    `SELECT r.*, t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date = $1
     ORDER BY t.code, r.created_at`,
    [reportDate]
  );
  return result.rows;
}

export async function getAttachmentsByReportId(reportId: number): Promise<Attachment[]> {
  const result = await pool.query(
    `SELECT * FROM attachments WHERE report_id = $1 ORDER BY created_at`,
    [reportId]
  );
  return result.rows;
}

export async function hasOtherTeamReportsOnDate(
  reportDate: string,
  excludeTeamId: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM reports WHERE report_date = $1 AND team_id != $2 LIMIT 1`,
    [reportDate, excludeTeamId]
  );
  return result.rows.length > 0;
}
