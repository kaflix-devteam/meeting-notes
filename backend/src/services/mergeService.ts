import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ReportWithTeam } from '../models/types';
import { embedReport } from './ragService';
import { standardizeForMerge } from './aiService';

/**
 * 수동 병합: 날짜 + 소속 기준으로 최종보고서 병합.
 * 같은 소속 내 여러 팀의 보고서를 팀별로 그룹핑하여 1개로 합친다.
 */
export async function mergeReportsManual(
  reportDate: string,
  departmentId: number
): Promise<number> {
  // 1. 해당 날짜 + 소속의 모든 보고서 수집 (팀의 현재 소속 기준)
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, t.code AS team_code, t.name AS team_name,
            d.name AS department_name,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN departments d ON t.department_id = d.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date = ? AND t.department_id = ?
     ORDER BY t.name, r.created_at`,
    [reportDate, departmentId]
  );
  const reports = rows as ReportWithTeam[];

  if (reports.length === 0) {
    console.log(`[mergeService] No reports found for date=${reportDate}, dept=${departmentId}`);
    return 0;
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

  // 4. AI로 개별 보고서 양식 통일
  console.log(`[mergeService] Standardizing ${reports.length} report(s)...`);
  const standardizedMap = new Map<number, string>();
  await Promise.all(
    reports.map(async (r) => {
      const userName = (r as any).user_display_name || '';
      const standardized = await standardizeForMerge(r.content_html, userName);
      standardizedMap.set(r.id, standardized);
    })
  );

  // 5. HTML 조립 — 통일 양식
  const totalMembers = reports.length;
  const teamCount = teamsMeta.length;

  const teamSections = teamsMeta
    .map((team) => {
      const memberRows = team.reports
        .map((r) => {
          const userName = (r as any).user_display_name || '';
          const content = standardizedMap.get(r.id) || r.content_html;
          return `<div class="fr-member">
          <div class="fr-member__name">${userName}</div>
          <div class="fr-member__content">${content}</div>
        </div>`;
        })
        .join('\n');

      return `<section class="fr-team" data-team="${team.code}">
      <div class="fr-team__header">
        <h3>${team.name}</h3>
        <span class="fr-team__count">${team.count}명</span>
      </div>
      <div class="fr-team__members">
        ${memberRows}
      </div>
    </section>`;
    })
    .join('\n');

  const mergedHtml = `<div class="final-report">
  <div class="fr-header">
    <h1>주간 업무보고서</h1>
    <table class="fr-meta">
      <tr><th>보고일자</th><td>${reportDate}</td></tr>
      <tr><th>소속</th><td>${deptName}</td></tr>
      <tr><th>참여팀</th><td>${teamsMeta.map(t => t.name).join(', ')}</td></tr>
      <tr><th>보고인원</th><td>${totalMembers}명 (${teamCount}개 팀)</td></tr>
    </table>
  </div>

  <div class="fr-body">
    ${teamSections}
  </div>
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

  return reports.length;
}
