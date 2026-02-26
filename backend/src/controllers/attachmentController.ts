import { Request, Response } from 'express';
import pool from '../config/database';

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const reportId = parseInt(req.params.id as string, 10);
    if (isNaN(reportId)) {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }

    // Verify report exists
    const reportCheck = await pool.query('SELECT id FROM reports WHERE id = $1', [reportId]);
    if (reportCheck.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO attachments (report_id, original_name, stored_name, file_type, file_size, file_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        reportId,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size,
        file.path,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[attachmentController] uploadAttachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
}
