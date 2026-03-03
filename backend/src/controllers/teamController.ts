import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

export async function getTeams(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM teams ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('[teamController] getTeams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}
