import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ReportTag {
  id: number;
  name: string;
  team_id: number;
  department_id: number;
}

export async function getTagsByDeptAndTeam(departmentId: number, teamId: number): Promise<ReportTag[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, team_id, department_id FROM report_tags WHERE department_id = ? AND team_id = ? ORDER BY name',
    [departmentId, teamId]
  );
  return rows as ReportTag[];
}

export async function createTag(name: string, teamId: number, departmentId: number): Promise<ReportTag> {
  await pool.query<ResultSetHeader>(
    'INSERT IGNORE INTO report_tags (name, team_id, department_id) VALUES (?, ?, ?)',
    [name.trim(), teamId, departmentId]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, team_id, department_id FROM report_tags WHERE name = ? AND team_id = ? AND department_id = ?',
    [name.trim(), teamId, departmentId]
  );
  return rows[0] as ReportTag;
}

export async function deleteTag(tagId: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM report_tags WHERE id = ?', [tagId]);
  return result.affectedRows > 0;
}

export async function getTagsByReportId(reportId: number): Promise<ReportTag[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rt.id, rt.name, rt.team_id, rt.department_id
     FROM report_tag_map rtm
     JOIN report_tags rt ON rtm.tag_id = rt.id
     WHERE rtm.report_id = ?
     ORDER BY rt.name`,
    [reportId]
  );
  return rows as ReportTag[];
}

export async function setReportTags(reportId: number, tagIds: number[]): Promise<void> {
  await pool.query('DELETE FROM report_tag_map WHERE report_id = ?', [reportId]);
  if (tagIds.length > 0) {
    const values = tagIds.map(tid => [reportId, tid]);
    await pool.query('INSERT INTO report_tag_map (report_id, tag_id) VALUES ?', [values]);
  }
}

// 태그 시그니처 (정렬된 태그 ID 문자열) 기준으로 보고서 그룹핑
export async function getTagSignaturesForReports(reportIds: number[]): Promise<Map<number, string>> {
  if (reportIds.length === 0) return new Map();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT report_id, GROUP_CONCAT(tag_id ORDER BY tag_id) as tag_sig
     FROM report_tag_map
     WHERE report_id IN (?)
     GROUP BY report_id`,
    [reportIds]
  );
  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(row.report_id, row.tag_sig || '');
  }
  // 태그 없는 보고서는 빈 문자열
  for (const id of reportIds) {
    if (!map.has(id)) map.set(id, '');
  }
  return map;
}
