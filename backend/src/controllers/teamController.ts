import { Request, Response } from 'express';
import pool from '../config/database';

export async function getTeams(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('[teamController] getTeams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}
