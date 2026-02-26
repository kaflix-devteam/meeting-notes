import pool from '../config/database';
import { ReportWithTeam } from '../models/types';
import { getReportsByDate } from './reportService';
import {
  analyzeReport,
  generateFinalReportHtml,
  TeamAnalysis,
} from './aiService';
import { embedReport } from './ragService';
import { executeMergeWorkflow } from './workflow';

/**
 * Merge reports using the LangGraph workflow.
 * Falls back to the direct merge implementation if LangGraph fails.
 */
export async function mergeReports(reportDate: string): Promise<void> {
  try {
    const result = await executeMergeWorkflow(reportDate);

    if (!result.success) {
      console.warn(
        `[mergeService] LangGraph workflow failed: ${result.error}. Falling back to direct merge.`
      );
      await mergeReportsDirect(reportDate);
    }
  } catch (error) {
    console.error(
      '[mergeService] LangGraph workflow threw exception, falling back to direct merge:',
      error
    );
    await mergeReportsDirect(reportDate);
  }
}

/**
 * Direct merge implementation (fallback when LangGraph is unavailable).
 */
async function mergeReportsDirect(reportDate: string): Promise<void> {
  // 1. Fetch all reports for the given date with team info
  const reports = await getReportsByDate(reportDate);

  if (reports.length === 0) {
    console.log(`[mergeService] No reports found for date ${reportDate}`);
    return;
  }

  // 2. Group by team
  const teamGroups = new Map<number, ReportWithTeam[]>();
  for (const report of reports) {
    const existing = teamGroups.get(report.team_id) || [];
    existing.push(report);
    teamGroups.set(report.team_id, existing);
  }

  // 3. Analyze each team's reports with Claude API
  const teamAnalyses: TeamAnalysis[] = [];
  for (const [, teamReports] of teamGroups) {
    const firstReport = teamReports[0];
    const combinedContent = teamReports
      .map((r) => r.content_html)
      .join('\n<hr/>\n');

    const analysis = await analyzeReport(combinedContent, firstReport.team_name);

    teamAnalyses.push({
      teamCode: firstReport.team_code,
      teamName: firstReport.team_name,
      reportContents: teamReports.map((r) => r.content_html),
      analysis,
    });
  }

  // Build team_summary JSON
  const teamSummary: Record<string, unknown> = {};
  for (const ta of teamAnalyses) {
    teamSummary[ta.teamCode] = {
      teamName: ta.teamName,
      summary: ta.analysis.summary,
      keyPoints: ta.analysis.keyPoints,
      opinions: ta.analysis.opinions,
      suggestions: ta.analysis.suggestions,
    };
  }

  // 4. Generate final merged HTML via Claude API
  const mergedHtml = await generateFinalReportHtml(teamAnalyses, reportDate);

  // 5. UPSERT into final_reports
  await pool.query(
    `INSERT INTO final_reports (report_date, content_html, team_summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (report_date)
     DO UPDATE SET content_html = EXCLUDED.content_html,
                   team_summary = EXCLUDED.team_summary,
                   updated_at = NOW()`,
    [reportDate, mergedHtml, JSON.stringify(teamSummary)]
  );

  console.log(
    `[mergeService] Final report for ${reportDate} created/updated with ${teamAnalyses.length} team(s)`
  );

  // 6. Trigger async embedding for each report
  for (const report of reports) {
    embedReport(report.id, report.content_html).catch((err) => {
      console.error(
        `[mergeService] Background embedding failed for report ${report.id}:`,
        err
      );
    });
  }
}
