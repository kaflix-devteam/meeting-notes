import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mergeReportsManual } from '../services/mergeService';

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

export async function mergeFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const { report_date, department_id } = req.body;

    if (!report_date || !department_id) {
      res.status(400).json({ error: 'report_date, department_id are required' });
      return;
    }

    await mergeReportsManual(report_date, department_id);
    res.json({ message: '최종보고서에 병합되었습니다.' });
  } catch (error) {
    console.error('[finalReportController] mergeFinalReport error:', error);
    res.status(500).json({ error: '최종보고서 병합에 실패했습니다.' });
  }
}
