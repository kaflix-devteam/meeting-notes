import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Report, ReportWithTeam, Attachment } from '../models/types';

export async function createReport(
  userId: number,
  teamId: number,
  reportDate: string,
  contentHtml: string
): Promise<Report> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO reports (user_id, team_id, report_date, content_html)
     VALUES (?, ?, ?, ?)`,
    [userId, teamId, reportDate, contentHtml]
  );
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM reports WHERE id = ?', [result.insertId]);
  return rows[0] as Report;
}

export async function getReportById(id: number): Promise<ReportWithTeam | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.user_id, r.team_id, DATE_FORMAT(r.report_date, '%Y-%m-%d') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.id = ?`,
    [id]
  );
  return (rows[0] as ReportWithTeam) || null;
}

export async function getReportsByUserId(userId: number): Promise<ReportWithTeam[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.user_id, r.team_id, DATE_FORMAT(r.report_date, '%Y-%m-%d') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.user_id = ?
     ORDER BY r.report_date DESC, r.created_at DESC`,
    [userId]
  );
  return rows as ReportWithTeam[];
}

export async function updateReport(
  id: number,
  contentHtml: string,
  teamId: number,
  reportDate: string
): Promise<Report | null> {
  await pool.query<ResultSetHeader>(
    `UPDATE reports SET content_html = ?, team_id = ?, report_date = ? WHERE id = ?`,
    [contentHtml, teamId, reportDate, id]
  );
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM reports WHERE id = ?', [id]);
  return (rows[0] as Report) || null;
}

export async function deleteReport(id: number): Promise<{ report_date: string } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date FROM reports WHERE id = ?`,
    [id]
  );
  if (rows.length === 0) return null;
  const reportDate = rows[0].report_date;
  await pool.query('DELETE FROM reports WHERE id = ?', [id]);
  return { report_date: reportDate };
}

export async function getReportsByDate(reportDate: string): Promise<ReportWithTeam[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date = ?
     ORDER BY t.code, r.created_at`,
    [reportDate]
  );
  return rows as ReportWithTeam[];
}

export async function getAttachmentsByReportId(reportId: number): Promise<Attachment[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM attachments WHERE report_id = ? ORDER BY created_at`,
    [reportId]
  );
  return rows as Attachment[];
}

export async function hasOtherTeamReportsOnDate(
  reportDate: string,
  excludeTeamId: number
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM reports WHERE report_date = ? AND team_id != ? LIMIT 1`,
    [reportDate, excludeTeamId]
  );
  return rows.length > 0;
}
