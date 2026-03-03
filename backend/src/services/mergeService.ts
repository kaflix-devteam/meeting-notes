import pool from '../config/database';
import { ResultSetHeader } from 'mysql2';
import { ReportWithTeam } from '../models/types';
import { getReportsByDate } from './reportService';
import { generateMergeSummary } from './aiService';
import { embedReport } from './ragService';

/**
 * 수동 병합: 사용자가 명시적으로 트리거하는 최종보고서 병합.
 * 원본 보고서 내용을 수정하지 않고 구조적 병합만 수행한다.
 */
export async function mergeReportsManual(reportDate: string): Promise<void> {
  // 1. 해당 날짜 보고서 수집
  const reports = await getReportsByDate(reportDate);

  if (reports.length === 0) {
    console.log(`[mergeService] No reports found for date ${reportDate}`);
    return;
  }

  // 2. 팀별 그룹핑
  const teamGroups = new Map<number, ReportWithTeam[]>();
  for (const report of reports) {
    const existing = teamGroups.get(report.team_id) || [];
    existing.push(report);
    teamGroups.set(report.team_id, existing);
  }

  // 3. 팀 메타데이터로 AI 요약문 생성 (토큰 최소화: 팀 이름+건수만 전달)
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

  const summary = await generateMergeSummary(
    teamsMeta.map((t) => ({ name: t.name, count: t.count })),
    reportDate
  );

  // 4. HTML 프로그래밍적 조립 (원본 내용 그대로 삽입)
  const teamSections = teamsMeta
    .map((team) => {
      const reportsHtml = team.reports
        .map((r) => r.content_html)
        .join('\n<hr/>\n');

      return `<section class="team-section" data-team="${team.code}">
    <h2>${team.name}</h2>
    <div class="report-content">${reportsHtml}</div>
  </section>`;
    })
    .join('\n\n  ');

  const mergedHtml = `<div class="final-report">
  <h1>업무보고서 - ${reportDate}</h1>
  <div class="overall-summary">
    <p>${summary}</p>
  </div>

  ${teamSections}
</div>`;

  // 5. team_summary JSON 구성
  const teamSummary: Record<string, unknown> = {};
  for (const team of teamsMeta) {
    teamSummary[team.code] = {
      teamName: team.name,
      reportCount: team.count,
    };
  }

  // 6. UPSERT final_reports
  await pool.query<ResultSetHeader>(
    `INSERT INTO final_reports (report_date, content_html, team_summary)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       content_html = VALUES(content_html),
       team_summary = VALUES(team_summary)`,
    [reportDate, mergedHtml, JSON.stringify(teamSummary)]
  );

  console.log(
    `[mergeService] Final report for ${reportDate} merged with ${teamsMeta.length} team(s), ${reports.length} report(s)`
  );

  // 7. 비동기 임베딩
  for (const report of reports) {
    embedReport(report.id, report.content_html).catch((err) => {
      console.error(
        `[mergeService] Background embedding failed for report ${report.id}:`,
        err
      );
    });
  }
}
