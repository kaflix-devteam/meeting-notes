import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 전체 공지 목록 (읽음 여부 포함)
export async function getNotices(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.query.user_id ? parseInt(req.query.user_id as string, 10) : null;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT n.id, n.title, n.content, n.created_at,
              CASE WHEN nr.user_id IS NULL THEN 0 ELSE 1 END AS is_read
       FROM notices n
       LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ?
       ORDER BY n.created_at DESC`,
      [userId]
    );

    res.json(rows.map((r: any) => ({ ...r, is_read: !!r.is_read })));
  } catch (error) {
    console.error('[noticeController] getNotices error:', error);
    res.status(500).json({ error: '공지 조회에 실패했습니다.' });
  }
}

// 안읽은 공지 조회
export async function getUnreadNotices(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.query.user_id as string, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'user_id is required' }); return; }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT n.id, n.title, n.content, n.created_at
       FROM notices n
       LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ?
       WHERE nr.user_id IS NULL
       ORDER BY n.created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('[noticeController] getUnreadNotices error:', error);
    res.status(500).json({ error: '공지 조회에 실패했습니다.' });
  }
}

// 공지 작성 (관리자)
export async function createNotice(req: Request, res: Response): Promise<void> {
  try {
    const { title, content } = req.body;
    if (!title || !content) { res.status(400).json({ error: 'title과 content가 필요합니다.' }); return; }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO notices (title, content) VALUES (?, ?)',
      [title, content]
    );
    res.status(201).json({ id: result.insertId, message: '공지가 등록되었습니다.' });
  } catch (error) {
    console.error('[noticeController] createNotice error:', error);
    res.status(500).json({ error: '공지 등록에 실패했습니다.' });
  }
}

// 공지 수정 (관리자)
export async function updateNotice(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { title, content } = req.body;
    if (isNaN(id) || !title || !content) { res.status(400).json({ error: '잘못된 요청' }); return; }

    await pool.query('UPDATE notices SET title = ?, content = ? WHERE id = ?', [title, content, id]);
    res.json({ message: '공지가 수정되었습니다.' });
  } catch (error) {
    console.error('[noticeController] updateNotice error:', error);
    res.status(500).json({ error: '공지 수정에 실패했습니다.' });
  }
}

// 공지 삭제 (관리자)
export async function deleteNotice(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

    await pool.query('DELETE FROM notices WHERE id = ?', [id]);
    res.json({ message: '공지가 삭제되었습니다.' });
  } catch (error) {
    console.error('[noticeController] deleteNotice error:', error);
    res.status(500).json({ error: '공지 삭제에 실패했습니다.' });
  }
}

// 공지 읽음 처리
export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { user_id } = req.body;
    if (isNaN(id) || !user_id) { res.status(400).json({ error: '잘못된 요청' }); return; }

    await pool.query(
      'INSERT IGNORE INTO notice_reads (user_id, notice_id) VALUES (?, ?)',
      [user_id, id]
    );
    res.json({ message: '읽음 처리되었습니다.' });
  } catch (error) {
    console.error('[noticeController] markAsRead error:', error);
    res.status(500).json({ error: '읽음 처리에 실패했습니다.' });
  }
}

// 전체 읽음 처리
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { user_id } = req.body;
    if (!user_id) { res.status(400).json({ error: 'user_id가 필요합니다.' }); return; }

    await pool.query(
      `INSERT IGNORE INTO notice_reads (user_id, notice_id)
       SELECT ?, id FROM notices`,
      [user_id]
    );
    res.json({ message: '모두 읽음 처리되었습니다.' });
  } catch (error) {
    console.error('[noticeController] markAllAsRead error:', error);
    res.status(500).json({ error: '읽음 처리에 실패했습니다.' });
  }
}
