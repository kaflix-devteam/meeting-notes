import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const reportId = parseInt(req.params.id as string, 10);
    if (isNaN(reportId)) {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }

    // Verify report exists
    const [reportRows] = await pool.query<RowDataPacket[]>('SELECT id FROM reports WHERE id = ?', [reportId]);
    if (reportRows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO attachments (report_id, original_name, stored_name, file_type, file_size, file_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reportId, file.originalname, file.filename, file.mimetype, file.size, file.path]
    );

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM attachments WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[attachmentController] uploadAttachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
}
