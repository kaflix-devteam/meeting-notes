import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ReportWithTeam } from '../models/types';
import { generateMergeSummary } from './aiService';
import { embedReport } from './ragService';

/**
 * 수동 병합: 날짜 + 소속 기준으로 최종보고서 병합.
 * 같은 소속 내 여러 팀의 보고서를 팀별로 그룹핑하여 1개로 합친다.
 */
export async function mergeReportsManual(
  reportDate: string,
  departmentId: number
): Promise<void> {
  // 1. 해당 날짜 + 소속의 모든 보고서 수집
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, t.code AS team_code, t.name AS team_name,
            d.name AS department_name,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     LEFT JOIN departments d ON r.department_id = d.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date = ? AND r.department_id = ?
     ORDER BY t.name, r.created_at`,
    [reportDate, departmentId]
  );
  const reports = rows as ReportWithTeam[];

  if (reports.length === 0) {
    console.log(`[mergeService] No reports found for date=${reportDate}, dept=${departmentId}`);
    return;
  }

  const deptName = (reports[0] as any).department_name || '';

  // 2. 팀별 그룹핑
  const teamGroups = new Map<number, ReportWithTeam[]>();
  for (const report of reports) {
    const existing = teamGroups.get(report.team_id) || [];
    existing.push(report);
    teamGroups.set(report.team_id, existing);
  }

  // 3. 팀 메타데이터
  const teamsMeta: { code: string; name: string; count: number; reports: ReportWithTeam[] }[] = [];
  for (const [, teamReports] of teamGroups) {
    const first = teamReports[0];
    teamsMeta.push({
      code: first.team_code,
      name: first.team_name,
      count: teamReports.length,
      reports: teamReports,
    });
  }

  // 4. AI 요약문 생성
  const summary = await generateMergeSummary(
    teamsMeta.map((t) => ({ name: t.name, count: t.count })),
    reportDate
  );

  // 5. HTML 조립 (팀별 섹션)
  const teamSections = teamsMeta
    .map((team) => {
      const reportsHtml = team.reports
        .map((r) => {
          const userName = (r as any).user_display_name || '';
          return `<div class="report-item">
      <p class="report-author"><strong>${userName}</strong></p>
      ${r.content_html}
    </div>`;
        })
        .join('\n<hr/>\n');

      return `<section class="team-section" data-team="${team.code}">
    <h2>${team.name}</h2>
    <div class="report-content">${reportsHtml}</div>
  </section>`;
    })
    .join('\n\n  ');

  const mergedHtml = `<div class="final-report">
  <h1>업무보고서 - ${reportDate}</h1>
  <h2>${deptName}</h2>
  <div class="overall-summary">
    <p>${summary}</p>
  </div>

  ${teamSections}
</div>`;

  // 6. team_summary JSON
  const teamSummary: Record<string, unknown> = {};
  for (const team of teamsMeta) {
    teamSummary[team.code] = {
      teamName: team.name,
      departmentName: deptName,
      reportCount: team.count,
    };
  }

  // 7. UPSERT final_reports (날짜+소속 기준)
  await pool.query<ResultSetHeader>(
    `INSERT INTO final_reports (report_date, department_id, team_id, content_html, team_summary)
     VALUES (?, ?, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       content_html = VALUES(content_html),
       team_summary = VALUES(team_summary)`,
    [reportDate, departmentId, mergedHtml, JSON.stringify(teamSummary)]
  );

  console.log(
    `[mergeService] Final report for ${reportDate} dept=${departmentId} merged with ${teamsMeta.length} team(s), ${reports.length} report(s)`
  );

  // 8. 비동기 임베딩
  for (const report of reports) {
    embedReport(report.id, report.content_html).catch((err) => {
      console.error(
        `[mergeService] Background embedding failed for report ${report.id}:`,
        err
      );
    });
  }
}
