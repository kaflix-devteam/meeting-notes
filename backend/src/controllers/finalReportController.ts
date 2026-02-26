import { Request, Response } from 'express';
import pool from '../config/database';

export async function getFinalReports(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, report_date, team_summary, created_at, updated_at
       FROM final_reports
       ORDER BY report_date DESC`
    );
    res.json(result.rows);
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
      'SELECT * FROM final_reports WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[finalReportController] getFinalReportById error:', error);
    res.status(500).json({ error: 'Failed to fetch final report' });
  }
}
