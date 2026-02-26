import { Request, Response } from 'express';
import pool from '../config/database';

export async function getFinalReports(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, TO_CHAR(report_date, 'YYYY-MM-DD') AS report_date, team_summary, created_at, updated_at
       FROM final_reports
       ORDER BY report_date DESC`
    );
    const rows = result.rows.map((row: any) => ({
      ...row,
      teams: row.team_summary ? Object.values(row.team_summary).map((t: any) => t.teamName) : [],
    }));
    res.json(rows);
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

    const result = await pool.query(
      `SELECT id, TO_CHAR(report_date, 'YYYY-MM-DD') AS report_date, content_html, team_summary, created_at, updated_at
       FROM final_reports WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      ...row,
      teams: row.team_summary ? Object.values(row.team_summary).map((t: any) => t.teamName) : [],
    });
  } catch (error) {
    console.error('[finalReportController] getFinalReportById error:', error);
    res.status(500).json({ error: 'Failed to fetch final report' });
  }
}
