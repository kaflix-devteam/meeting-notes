import pool from '../config/database';
import { Report, ReportWithTeam, Attachment } from '../models/types';

export async function createReport(
  userId: number,
  reportDate: string,
  contentHtml: string,
  overrideTeamId?: number
): Promise<Report> {
  let teamId: number;
  let departmentId: number;

  if (overrideTeamId) {
    // 지정된 팀 사용
    const { rows: teamRows } = await pool.query(`SELECT id, department_id FROM teams WHERE id = $1`, [overrideTeamId]);
    if (teamRows.length === 0) throw new Error('Team not found');
    teamId = teamRows[0].id;
    departmentId = teamRows[0].department_id;
  } else {
    // user의 team_id, department_id 조회
    const { rows: userRows } = await pool.query(`SELECT u.team_id, t.department_id
       FROM users u JOIN teams t ON u.team_id = t.id
       WHERE u.id = $1`, [userId]);
    if (userRows.length === 0) throw new Error('User not found');
    teamId = userRows[0].team_id;
    departmentId = userRows[0].department_id;
  }

  const result = await pool.query(`INSERT INTO reports (user_id, team_id, department_id, report_date, content_html)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`, [userId, teamId, departmentId, reportDate, contentHtml]);
  const insertedId = result.rows[0].id;
  const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [insertedId]);
  return rows[0] as Report;
}

export async function findDuplicateReport(
  userId: number,
  reportDate: string,
  teamId?: number
): Promise<{ id: number } | null> {
  let sql = `SELECT id FROM reports WHERE user_id = $1 AND report_date = $2`;
  const params: any[] = [userId, reportDate];

  if (teamId) {
    sql += ` AND team_id = $${params.length + 1}`;
    params.push(teamId);
  }

  sql += ` LIMIT 1`;

  const { rows } = await pool.query(sql, params);
  return rows.length > 0 ? { id: rows[0].id } : null;
}

export async function getReportById(id: number): Promise<ReportWithTeam | null> {
  const { rows } = await pool.query(`SELECT r.id, r.user_id, r.team_id, r.department_id, to_char(r.report_date, 'YYYY-MM-DD') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name,
            d.name AS department_name, d.color AS department_color,
            t.color AS team_color,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     LEFT JOIN departments d ON r.department_id = d.id
     JOIN users u ON r.user_id = u.id
     WHERE r.id = $1`, [id]);
  return (rows[0] as ReportWithTeam) || null;
}

export async function getReportsByUserId(userId: number): Promise<ReportWithTeam[]> {
  const { rows } = await pool.query(`SELECT r.id, r.user_id, r.team_id, r.department_id, to_char(r.report_date, 'YYYY-MM-DD') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name,
            d.name AS department_name, d.color AS department_color,
            t.color AS team_color,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     LEFT JOIN departments d ON r.department_id = d.id
     JOIN users u ON r.user_id = u.id
     WHERE r.user_id = $1
     ORDER BY r.report_date DESC, r.created_at DESC`, [userId]);
  return rows as ReportWithTeam[];
}

export async function getAllReports(): Promise<ReportWithTeam[]> {
  const { rows } = await pool.query(`SELECT r.id, r.user_id, r.team_id, r.department_id, to_char(r.report_date, 'YYYY-MM-DD') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name,
            d.name AS department_name, d.color AS department_color,
            t.color AS team_color,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     LEFT JOIN departments d ON r.department_id = d.id
     JOIN users u ON r.user_id = u.id
     ORDER BY r.report_date DESC, r.created_at DESC`);
  return rows as ReportWithTeam[];
}

export async function updateReport(
  id: number,
  contentHtml: string,
  reportDate: string,
  overrideTeamId?: number
): Promise<Report | null> {
  if (overrideTeamId) {
    const { rows: teamRows } = await pool.query(`SELECT id, department_id FROM teams WHERE id = $1`, [overrideTeamId]);
    if (teamRows.length > 0) {
      await pool.query(`UPDATE reports SET content_html = $1, report_date = $2, team_id = $3, department_id = $4 WHERE id = $5`, [contentHtml, reportDate, overrideTeamId, teamRows[0].department_id, id]);
    } else {
      await pool.query(`UPDATE reports SET content_html = $1, report_date = $2 WHERE id = $3`, [contentHtml, reportDate, id]);
    }
  } else {
    await pool.query(`UPDATE reports SET content_html = $1, report_date = $2 WHERE id = $3`, [contentHtml, reportDate, id]);
  }
  const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
  return (rows[0] as Report) || null;
}

export async function deleteReport(id: number): Promise<{ report_date: string } | null> {
  const { rows } = await pool.query(`SELECT to_char(report_date, 'YYYY-MM-DD') AS report_date FROM reports WHERE id = $1`, [id]);
  if (rows.length === 0) return null;
  const reportDate = rows[0].report_date;
  await pool.query('DELETE FROM reports WHERE id = $1', [id]);
  return { report_date: reportDate };
}

export async function getPreviousWeekReport(userId: number, reportDate: string, teamId?: number): Promise<ReportWithTeam | null> {
  // 현재 날짜보다 이전이면서 가장 가까운 보고서 조회
  let sql = `SELECT r.id, r.user_id, r.team_id, r.department_id, to_char(r.report_date, 'YYYY-MM-DD') AS report_date,
            r.content_html, r.created_at, r.updated_at,
            t.code AS team_code, t.name AS team_name,
            d.name AS department_name, d.color AS department_color,
            t.color AS team_color,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     LEFT JOIN departments d ON r.department_id = d.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date < $1`;
  const params: any[] = [reportDate];

  sql += ` AND r.user_id = $${params.length + 1}`;
  params.push(userId);

  if (teamId) {
    sql += ` AND r.team_id = $${params.length + 1}`;
    params.push(teamId);
  }

  sql += ` ORDER BY r.report_date DESC LIMIT 1`;

  const { rows } = await pool.query(sql, params);
  return (rows[0] as ReportWithTeam) || null;
}

export async function getReportsByDate(reportDate: string): Promise<ReportWithTeam[]> {
  const { rows } = await pool.query(`SELECT r.*, t.code AS team_code, t.name AS team_name, u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date = $1
     ORDER BY t.code, r.created_at`, [reportDate]);
  return rows as ReportWithTeam[];
}

export async function getAttachmentsByReportId(reportId: number): Promise<Attachment[]> {
  const { rows } = await pool.query(`SELECT * FROM attachments WHERE report_id = $1 ORDER BY created_at`, [reportId]);
  return rows as Attachment[];
}

export async function hasOtherTeamReportsOnDate(
  reportDate: string,
  excludeTeamId: number
): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM reports WHERE report_date = $1 AND team_id != $2 LIMIT 1`, [reportDate, excludeTeamId]);
  return rows.length > 0;
}
