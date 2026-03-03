import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

export async function getFinalReports(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, team_summary, created_at, updated_at
       FROM final_reports
       ORDER BY report_date DESC`
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
      `SELECT id, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, content_html, team_summary, created_at, updated_at
       FROM final_reports WHERE id = ?`,
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
