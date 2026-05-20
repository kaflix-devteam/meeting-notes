import pool from '../config/database';
export interface ReportTag {
  id: number;
  name: string;
  team_id: number;
  department_id: number;
}

export async function getTagsByDeptAndTeam(departmentId: number, teamId: number): Promise<ReportTag[]> {
  const { rows } = await pool.query('SELECT id, name, team_id, department_id FROM report_tags WHERE department_id = $1 AND team_id = $2 ORDER BY name', [departmentId, teamId]);
  return rows as ReportTag[];
}

export async function createTag(name: string, teamId: number, departmentId: number): Promise<ReportTag> {
  await pool.query('INSERT INTO report_tags (name, team_id, department_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [name.trim(), teamId, departmentId]);
  const { rows } = await pool.query('SELECT id, name, team_id, department_id FROM report_tags WHERE name = $1 AND team_id = $2 AND department_id = $3', [name.trim(), teamId, departmentId]);
  return rows[0] as ReportTag;
}

export async function deleteTag(tagId: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM report_tags WHERE id = $1', [tagId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getTagsByReportId(reportId: number): Promise<ReportTag[]> {
  const { rows } = await pool.query(`SELECT rt.id, rt.name, rt.team_id, rt.department_id
     FROM report_tag_map rtm
     JOIN report_tags rt ON rtm.tag_id = rt.id
     WHERE rtm.report_id = $1
     ORDER BY rt.name`, [reportId]);
  return rows as ReportTag[];
}

export async function setReportTags(reportId: number, tagIds: number[]): Promise<void> {
  await pool.query('DELETE FROM report_tag_map WHERE report_id = $1', [reportId]);
  if (tagIds.length > 0) {
    await pool.query(
      'INSERT INTO report_tag_map (report_id, tag_id) SELECT $1, UNNEST($2::int[])',
      [reportId, tagIds]
    );
  }
}

// 태그 시그니처 (정렬된 태그 ID 문자열) 기준으로 보고서 그룹핑
export async function getTagSignaturesForReports(reportIds: number[]): Promise<Map<number, string>> {
  if (reportIds.length === 0) return new Map();
  const { rows } = await pool.query(`SELECT report_id, string_agg(tag_id::text, ',' ORDER BY tag_id) AS tag_sig
     FROM report_tag_map
     WHERE report_id = ANY($1::int[])
     GROUP BY report_id`, [reportIds]);
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
