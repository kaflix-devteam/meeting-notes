import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ReportWithTeam } from '../models/types';
import { embedReport } from './ragService';
import { standardizeForMerge } from './aiService';
import { getTagSignaturesForReports } from './tagService';

/**
 * 수동 병합: 날짜 + 소속 기준으로 최종보고서 병합.
 * 태그가 있는 보고서는 같은 태그 조합끼리 별도 최종보고서로 생성.
 * 태그 없는 보고서는 하나의 최종보고서로 병합.
 */
export async function mergeReportsManual(
  reportDate: string,
  departmentId: number
): Promise<number> {
  // 1. 해당 날짜 + 소속의 모든 보고서 수집
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, t.code AS team_code, t.name AS team_name,
            d.name AS department_name,
            u.display_name AS user_display_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     JOIN departments d ON t.department_id = d.id
     JOIN users u ON r.user_id = u.id
     WHERE r.report_date = ? AND t.department_id = ?
     ORDER BY t.name, u.display_name, r.created_at`,
    [reportDate, departmentId]
  );
  const reports = rows as ReportWithTeam[];

  if (reports.length === 0) {
    console.log(`[mergeService] No reports found for date=${reportDate}, dept=${departmentId}`);
    return 0;
  }

  // 2. 태그 시그니처 조회
  const reportIds = reports.map(r => r.id);
  const tagSigMap = await getTagSignaturesForReports(reportIds);

  // 3. 태그 시그니처별 그룹핑
  const sigGroups = new Map<string, ReportWithTeam[]>();
  for (const report of reports) {
    const sig = tagSigMap.get(report.id) || '';
    const existing = sigGroups.get(sig) || [];
    existing.push(report);
    sigGroups.set(sig, existing);
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

  // 5. 태그 이름 조회
  const tagNameMap = new Map<number, string>();
  for (const [sig] of sigGroups) {
    if (!sig) continue;
    for (const tidStr of sig.split(',')) {
      const tid = parseInt(tidStr, 10);
      if (!tagNameMap.has(tid)) {
        const [tagRows] = await pool.query<RowDataPacket[]>('SELECT name FROM report_tags WHERE id = ?', [tid]);
        if (tagRows.length > 0) tagNameMap.set(tid, tagRows[0].name);
      }
    }
  }

  // 6. 각 태그 그룹별로 별도 final_report 생성
  for (const [sig, groupReports] of sigGroups) {
    // 팀별 그룹핑
    const teamGroups = new Map<number, ReportWithTeam[]>();
    for (const report of groupReports) {
      const existing = teamGroups.get(report.team_id) || [];
      existing.push(report);
      teamGroups.set(report.team_id, existing);
    }

    const teamsMeta: { id: number; code: string; count: number; reports: ReportWithTeam[] }[] = [];
    for (const [teamId, teamReports] of teamGroups) {
      const first = teamReports[0];
      teamsMeta.push({ id: teamId, code: first.team_code, count: teamReports.length, reports: teamReports });
    }

    const totalMembers = groupReports.length;
    const teamCount = teamsMeta.length;

    // 태그 헤더
    let tagHeader = '';
    if (sig) {
      const tagIds = sig.split(',').map(Number);
      const tagNames = tagIds.map(id => tagNameMap.get(id) || String(id));
      tagHeader = `<div class="fr-tag-group__header">${tagNames.map(n => `<span class="fr-tag">${n}</span>`).join(' ')}</div>`;
    }

    const teamSections = teamsMeta.map((team) => {
      const memberRows = team.reports.map((r) => {
        const userName = (r as any).user_display_name || '';
        const content = standardizedMap.get(r.id) || r.content_html;
        return `<div class="fr-member">
          <div class="fr-member__name">${userName}</div>
          <div class="fr-member__content">${content}</div>
        </div>`;
      }).join('\n');

      return `<section class="fr-team" data-team-id="${team.id}">
      <div class="fr-team__header">
        <h3 data-team-id="${team.id}"></h3>
        <span class="fr-team__count">${team.count}명</span>
      </div>
      <div class="fr-team__members">
        ${memberRows}
      </div>
    </section>`;
    }).join('\n');

    const allTeamIdArr = teamsMeta.map(t => t.id);

    const mergedHtml = `<div class="final-report">
  <div class="fr-header">
    <h1>주간 업무보고서</h1>
    ${tagHeader}
    <table class="fr-meta">
      <tr><th>보고일자</th><td>${reportDate}</td></tr>
      <tr><th>소속</th><td data-dept-id="${departmentId}"></td></tr>
      <tr><th>참여팀</th><td data-teams-meta="${allTeamIdArr.join(',')}"></td></tr>
      <tr><th>보고인원</th><td>${totalMembers}명 (${teamCount}개 팀)</td></tr>
    </table>
  </div>
  <div class="fr-body">
    ${teamSections}
  </div>
</div>`;

    // team_summary JSON
    const teamSummary: Record<string, unknown> = {};
    for (const team of teamsMeta) {
      teamSummary[team.code] = {
        teamId: team.id,
        departmentId: departmentId,
        reportCount: team.reports.length,
      };
    }

    // UPSERT (날짜+소속+태그시그니처 기준)
    await pool.query<ResultSetHeader>(
      `INSERT INTO final_reports (report_date, department_id, team_id, content_html, team_summary, tag_signature)
       VALUES (?, ?, NULL, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content_html = VALUES(content_html),
         team_summary = VALUES(team_summary)`,
      [reportDate, departmentId, mergedHtml, JSON.stringify(teamSummary), sig]
    );

    console.log(
      `[mergeService] Final report for ${reportDate} dept=${departmentId} tag="${sig}" merged with ${teamCount} team(s), ${totalMembers} report(s)`
    );
  }

  // 7. 비동기 임베딩
  for (const report of reports) {
    embedReport(report.id, report.content_html).catch((err) => {
      console.error(`[mergeService] Background embedding failed for report ${report.id}:`, err);
    });
  }

  return reports.length;
}
