import { Router } from 'express';
import path from 'path';
import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

const router = Router();

// GET /api/attachments/:id/download - download attachment file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid attachment ID' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM attachments WHERE id = ?', [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const attachment = rows[0];
    const filePath = path.resolve(attachment.file_path);

    res.download(filePath, attachment.original_name);
  } catch (error) {
    console.error('[attachments] download error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

export default router;
