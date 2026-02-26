import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import pool from '../config/database';
import {
  analyzeReport,
  generateFinalReportHtml,
  type TeamAnalysis,
  type AnalysisResult,
} from './aiService';
import { embedReport } from './ragService';

// ============================================================
// Types
// ============================================================

export interface Report {
  id: number;
  userId: number;
  teamId: number;
  teamCode: string;
  teamName: string;
  reportDate: string;
  contentHtml: string;
}

export interface MergeResult {
  success: boolean;
  finalReportId?: number;
  reportDate: string;
  teamsIncluded: string[];
  error?: string;
}

// ============================================================
// LangGraph State Definition
// ============================================================

const MergeWorkflowState = Annotation.Root({
  reportDate: Annotation<string>,
  reports: Annotation<Report[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  teamReports: Annotation<Record<string, Report[]>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  analysisResults: Annotation<TeamAnalysis[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  mergedHtml: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  finalReportId: Annotation<number | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  teamSummary: Annotation<Record<string, unknown> | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  error: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

type MergeState = typeof MergeWorkflowState.State;

// ============================================================
// Workflow Nodes
// ============================================================

/**
 * Node 1: collectReports - 해당 날짜의 모든 팀 보고서 수집
 */
async function collectReports(state: MergeState): Promise<Partial<MergeState>> {
  console.log(`[workflow] Collecting reports for date: ${state.reportDate}`);

  const result = await pool.query(
    `SELECT r.id, r.user_id, r.team_id, r.report_date, r.content_html,
            t.code AS team_code, t.name AS team_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     WHERE r.report_date = $1
     ORDER BY t.code, r.id`,
    [state.reportDate]
  );

  const reports: Report[] = result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    teamCode: row.team_code,
    teamName: row.team_name,
    reportDate: row.report_date,
    contentHtml: row.content_html,
  }));

  console.log(`[workflow] Found ${reports.length} reports`);
  return { reports };
}

/**
 * Node 2: groupByTeam - 팀별로 그룹핑
 */
async function groupByTeam(state: MergeState): Promise<Partial<MergeState>> {
  console.log('[workflow] Grouping reports by team');

  const teamReports: Record<string, Report[]> = {};

  for (const report of state.reports) {
    if (!teamReports[report.teamCode]) {
      teamReports[report.teamCode] = [];
    }
    teamReports[report.teamCode].push(report);
  }

  console.log(`[workflow] Grouped into ${Object.keys(teamReports).length} teams`);
  return { teamReports };
}

/**
 * Node 3: analyzeReports - Claude API로 각 팀 보고서 분석
 */
async function analyzeReports(state: MergeState): Promise<Partial<MergeState>> {
  console.log('[workflow] Analyzing reports by team');

  const analysisResults: TeamAnalysis[] = [];

  for (const [teamCode, reports] of Object.entries(state.teamReports)) {
    if (reports.length === 0) continue;

    const teamName = reports[0].teamName;
    const combinedContent = reports.map((r) => r.contentHtml).join('\n---\n');

    const analysis: AnalysisResult = await analyzeReport(
      combinedContent,
      teamName
    );

    analysisResults.push({
      teamCode,
      teamName,
      reportContents: reports.map((r) => r.contentHtml),
      analysis,
    });
  }

  console.log(`[workflow] Analysis complete for ${analysisResults.length} teams`);
  return { analysisResults };
}

/**
 * Node 4: generateFinalReport - 최종보고서 HTML 생성
 */
async function generateFinalReport(
  state: MergeState
): Promise<Partial<MergeState>> {
  console.log('[workflow] Generating final report HTML');

  if (state.analysisResults.length === 0) {
    return {
      mergedHtml: '',
      error: 'No analysis results to generate report from',
    };
  }

  const mergedHtml = await generateFinalReportHtml(
    state.analysisResults,
    state.reportDate
  );

  // Build team summary JSON
  const teamSummary: Record<string, unknown> = {};
  for (const analysis of state.analysisResults) {
    teamSummary[analysis.teamCode] = {
      teamName: analysis.teamName,
      summary: analysis.analysis.summary,
      keyPoints: analysis.analysis.keyPoints,
      opinions: analysis.analysis.opinions,
      suggestions: analysis.analysis.suggestions,
      reportCount: analysis.reportContents.length,
    };
  }

  return { mergedHtml, teamSummary };
}

/**
 * Node 5: saveFinalReport - final_reports 테이블에 UPSERT
 */
async function saveFinalReport(
  state: MergeState
): Promise<Partial<MergeState>> {
  console.log('[workflow] Saving final report');

  if (!state.mergedHtml) {
    return { error: 'No merged HTML to save' };
  }

  const result = await pool.query(
    `INSERT INTO final_reports (report_date, content_html, team_summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (report_date)
     DO UPDATE SET
       content_html = EXCLUDED.content_html,
       team_summary = EXCLUDED.team_summary,
       updated_at = NOW()
     RETURNING id`,
    [state.reportDate, state.mergedHtml, JSON.stringify(state.teamSummary ?? {})]
  );

  const finalReportId = result.rows[0].id;
  console.log(`[workflow] Final report saved with id: ${finalReportId}`);

  return { finalReportId };
}

// ============================================================
// Conditional edge: skip if no reports found
// ============================================================

function shouldContinue(state: MergeState): string {
  if (state.reports.length === 0) {
    return 'end';
  }
  return 'groupByTeam';
}

// ============================================================
// createMergeWorkflow - 워크플로우 그래프 생성
// ============================================================

export function createMergeWorkflow() {
  const workflow = new StateGraph(MergeWorkflowState)
    .addNode('collectReports', collectReports)
    .addNode('groupByTeam', groupByTeam)
    .addNode('analyzeReports', analyzeReports)
    .addNode('generateFinalReport', generateFinalReport)
    .addNode('saveFinalReport', saveFinalReport)
    .addEdge(START, 'collectReports')
    .addConditionalEdges('collectReports', shouldContinue, {
      groupByTeam: 'groupByTeam',
      end: END,
    })
    .addEdge('groupByTeam', 'analyzeReports')
    .addEdge('analyzeReports', 'generateFinalReport')
    .addEdge('generateFinalReport', 'saveFinalReport')
    .addEdge('saveFinalReport', END);

  return workflow.compile();
}

// ============================================================
// executeMergeWorkflow - 워크플로우 실행
// ============================================================

export async function executeMergeWorkflow(
  reportDate: string
): Promise<MergeResult> {
  try {
    console.log(`[workflow] Starting merge workflow for date: ${reportDate}`);

    const graph = createMergeWorkflow();

    const finalState = await graph.invoke({
      reportDate,
      reports: [],
      teamReports: {},
      analysisResults: [],
      mergedHtml: '',
      finalReportId: undefined,
      teamSummary: undefined,
      error: undefined,
    });

    if (finalState.error) {
      console.error(`[workflow] Workflow error: ${finalState.error}`);
      return {
        success: false,
        reportDate,
        teamsIncluded: [],
        error: finalState.error,
      };
    }

    if (finalState.reports.length === 0) {
      return {
        success: true,
        reportDate,
        teamsIncluded: [],
      };
    }

    // Trigger async embedding for each report (fire and forget)
    for (const report of finalState.reports) {
      embedReport(report.id, report.contentHtml).catch((err) => {
        console.error(
          `[workflow] Background embedding failed for report ${report.id}:`,
          err
        );
      });
    }

    const teamsIncluded = Object.keys(finalState.teamReports);
    console.log(
      `[workflow] Merge workflow complete. Final report ID: ${finalState.finalReportId}`
    );

    return {
      success: true,
      finalReportId: finalState.finalReportId,
      reportDate,
      teamsIncluded,
    };
  } catch (error) {
    console.error('[workflow] Workflow execution failed:', error);
    return {
      success: false,
      reportDate,
      teamsIncluded: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
