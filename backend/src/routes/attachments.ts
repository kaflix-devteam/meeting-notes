import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import pool from '../config/database';
const router = Router();

// GET /api/attachments/:id/download - download attachment file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid attachment ID' });
      return;
    }

    const { rows } = await pool.query('SELECT * FROM attachments WHERE id = $1', [id]);
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

// DELETE /api/attachments/:id - 첨부 삭제 (DB 행 + 디스크 파일)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid attachment ID' });
      return;
    }

    const { rows } = await pool.query('SELECT file_path FROM attachments WHERE id = $1', [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    await pool.query('DELETE FROM attachments WHERE id = $1', [id]);

    const filePath = rows[0].file_path;
    if (filePath) {
      fs.unlink(path.resolve(filePath), () => { /* 파일이 없어도 무시 */ });
    }

    res.json({ message: '삭제되었습니다.' });
  } catch (error) {
    console.error('[attachments] delete error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
