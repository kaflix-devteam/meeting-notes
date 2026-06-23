import { Request, Response } from 'express';
import pool from '../config/database';

// multer 는 multipart 파일명을 latin1 로 디코딩하므로 한글 등 UTF-8 파일명이 깨진다. 원래 문자열로 복원.
function decodeOriginalName(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const reportId = parseInt(req.params.id as string, 10);
    if (isNaN(reportId)) {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }

    // Verify report exists
    const { rows: reportRows } = await pool.query('SELECT id FROM reports WHERE id = $1', [reportId]);
    if (reportRows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const originalName = decodeOriginalName(file.originalname);
    const result = await pool.query(`INSERT INTO attachments (report_id, original_name, stored_name, file_type, file_size, file_path)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [reportId, originalName, file.filename, file.mimetype, file.size, file.path]);

    const { rows } = await pool.query('SELECT * FROM attachments WHERE id = $1', [result.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[attachmentController] uploadAttachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
}
