import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mergeReportsManual } from '../services/mergeService';
import { compareWeeklyReports } from '../services/aiService';

export async function getFinalReports(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, DATE_FORMAT(f.report_date, '%Y-%m-%d') AS report_date,
              f.department_id, f.team_id, f.team_summary, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       ORDER BY f.report_date DESC, d.name, t.name`
    );
    const result = rows.map((row: any) => {
      const summary = typeof row.team_summary === 'string'
        ? JSON.parse(row.team_summary)
        : row.team_summary;
      return {
        ...row,
        team_summary: summary,
        teams: summary ? Object.values(summary).map((t: any) => t.teamName) : [],
      };
    });
    res.json(result);
  } catch (error) {
    console.error('[finalReportController] getFinalReports error:', error);
    res.status(500).json({ error: 'Failed to fetch final reports' });
  }
}

export async function getFinalReportById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, DATE_FORMAT(f.report_date, '%Y-%m-%d') AS report_date, f.content_html, f.team_summary,
              f.department_id, f.team_id, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       WHERE f.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    const row = rows[0];
    const summary = typeof row.team_summary === 'string'
      ? JSON.parse(row.team_summary)
      : row.team_summary;
    res.json({
      ...row,
      team_summary: summary,
      teams: summary ? Object.values(summary).map((t: any) => t.teamName) : [],
    });
  } catch (error) {
    console.error('[finalReportController] getFinalReportById error:', error);
    res.status(500).json({ error: 'Failed to fetch final report' });
  }
}

export async function deleteFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM final_reports WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    res.json({ message: '최종보고서가 삭제되었습니다.' });
  } catch (error) {
    console.error('[finalReportController] deleteFinalReport error:', error);
    res.status(500).json({ error: '최종보고서 삭제에 실패했습니다.' });
  }
}

export async function getPreviousFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const reportDate = req.query.report_date as string;
    const departmentId = req.query.department_id as string;

    if (!reportDate || !departmentId) {
      res.status(400).json({ error: 'report_date and department_id are required' });
      return;
    }

    const date = new Date(reportDate);
    date.setDate(date.getDate() - 7);
    const prevDate = date.toISOString().slice(0, 10);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, DATE_FORMAT(f.report_date, '%Y-%m-%d') AS report_date, f.content_html, f.team_summary,
              f.department_id, f.team_id, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       WHERE f.report_date = ? AND f.department_id = ?`,
      [prevDate, departmentId]
    );

    if (rows.length === 0) {
      res.json(null);
      return;
    }

    const row = rows[0];
    const summary = typeof row.team_summary === 'string'
      ? JSON.parse(row.team_summary)
      : row.team_summary;
    res.json({
      ...row,
      team_summary: summary,
      teams: summary ? Object.values(summary).map((t: any) => t.teamName) : [],
    });
  } catch (error) {
    console.error('[finalReportController] getPreviousFinalReport error:', error);
    res.status(500).json({ error: 'Failed to fetch previous final report' });
  }
}

export async function analyzeWeeklyComparison(req: Request, res: Response): Promise<void> {
  try {
    const { current_html, previous_html, current_date, previous_date } = req.body;

    if (!current_html || !previous_html) {
      res.status(400).json({ error: 'current_html and previous_html are required' });
      return;
    }

    const analysisHtml = await compareWeeklyReports(
      current_html,
      previous_html,
      current_date || '',
      previous_date || ''
    );
    res.json({ analysis_html: analysisHtml });
  } catch (error) {
    console.error('[finalReportController] analyzeWeeklyComparison error:', error);
    res.status(500).json({ error: 'AI 분석에 실패했습니다.' });
  }
}

export async function mergeFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const { report_date, department_id } = req.body;

    if (!report_date) {
      res.status(400).json({ error: 'report_date is required' });
      return;
    }

    if (department_id) {
      // department_id가 제공되면 해당 소속만 병합
      const count = await mergeReportsManual(report_date, department_id);
      if (count === 0) {
        res.status(404).json({ error: '해당 날짜에 병합할 보고서가 없습니다.' });
        return;
      }
      res.json({ message: `최종보고서에 병합되었습니다. (${count}건)` });
    } else {
      // department_id 없으면 해당 날짜의 모든 소속별로 병합
      const [deptRows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT t.department_id
         FROM reports r
         JOIN teams t ON r.team_id = t.id
         WHERE r.report_date = ? AND t.department_id IS NOT NULL`,
        [report_date]
      );

      if (deptRows.length === 0) {
        res.status(404).json({ error: '해당 날짜에 병합할 보고서가 없습니다.' });
        return;
      }

      let totalCount = 0;
      for (const row of deptRows) {
        totalCount += await mergeReportsManual(report_date, row.department_id);
      }
      res.json({ message: `최종보고서에 병합되었습니다. (${totalCount}건)` });
    }
  } catch (error) {
    console.error('[finalReportController] mergeFinalReport error:', error);
    res.status(500).json({ error: '최종보고서 병합에 실패했습니다.' });
  }
}
