import { Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../config/database';
export async function getMeetingNotes(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT m.id, to_char(m.report_date, 'YYYY-MM-DD') AS report_date,
              m.user_id, m.team_id, m.department_id, m.content_html, m.tag_signature,
              m.created_at, m.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color,
              u.display_name AS user_display_name
       FROM meeting_notes m
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN teams t ON m.team_id = t.id
       LEFT JOIN users u ON m.user_id = u.id
       ORDER BY m.report_date DESC, m.created_at DESC`);

    // 태그 이름 일괄 조회
    const allTagIds = new Set<number>();
    for (const row of rows) {
      if (row.tag_signature) {
        for (const tid of row.tag_signature.split(',')) allTagIds.add(parseInt(tid, 10));
      }
    }
    const tagNameMap = new Map<number, string>();
    if (allTagIds.size > 0) {
      const { rows: tagRows } = await pool.query('SELECT id, name FROM report_tags WHERE id = ANY($1::int[])', [[...allTagIds]]);
      for (const tr of tagRows) tagNameMap.set(tr.id, tr.name);
    }

    const result = rows.map((row: any) => {
      const tagNames = row.tag_signature
        ? row.tag_signature.split(',').map((id: string) => tagNameMap.get(parseInt(id, 10)) || id).filter(Boolean)
        : [];
      return { ...row, tag_names: tagNames };
    });

    res.json(result);
  } catch (error) {
    console.error('[meetingNoteController] getMeetingNotes error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
}

export async function getMeetingNoteById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

    const { rows } = await pool.query(`SELECT m.id, to_char(m.report_date, 'YYYY-MM-DD') AS report_date,
              m.user_id, m.team_id, m.department_id, m.content_html, m.tag_signature,
              m.created_at, m.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color,
              u.display_name AS user_display_name
       FROM meeting_notes m
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN teams t ON m.team_id = t.id
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.id = $1`, [id]);

    if (rows.length === 0) { res.status(404).json({ error: 'Meeting note not found' }); return; }
    res.json(rows[0]);
  } catch (error) {
    console.error('[meetingNoteController] getMeetingNoteById error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting note' });
  }
}

export async function createMeetingNote(req: Request, res: Response): Promise<void> {
  try {
    const { report_date, department_id, team_id, content_html, user_id, tag_signature } = req.body;

    if (!report_date || !department_id || !content_html || !user_id) {
      res.status(400).json({ error: 'report_date, department_id, content_html, user_id are required' });
      return;
    }

    const result = await pool.query(`INSERT INTO meeting_notes (user_id, team_id, department_id, report_date, content_html, tag_signature)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [user_id, team_id || null, department_id, report_date, content_html, tag_signature || '']);

    res.status(201).json({ id: result.rows[0].id, message: '회의록이 저장되었습니다.' });
  } catch (error) {
    console.error('[meetingNoteController] createMeetingNote error:', error);
    res.status(500).json({ error: '회의록 저장에 실패했습니다.' });
  }
}

export async function updateMeetingNote(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

    const { content_html, report_date, team_id, department_id, tag_signature } = req.body;

    if (!content_html || !report_date) {
      res.status(400).json({ error: 'content_html and report_date are required' });
      return;
    }

    await pool.query(`UPDATE meeting_notes SET content_html = $1, report_date = $2, team_id = $3, department_id = $4, tag_signature = $5 WHERE id = $6`, [content_html, report_date, team_id || null, department_id, tag_signature || '', id]);

    res.json({ message: '회의록이 수정되었습니다.' });
  } catch (error) {
    console.error('[meetingNoteController] updateMeetingNote error:', error);
    res.status(500).json({ error: '회의록 수정에 실패했습니다.' });
  }
}

export async function deleteMeetingNote(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

    const result = await pool.query('DELETE FROM meeting_notes WHERE id = $1', [id]);
    if (result.rowCount === 0) { res.status(404).json({ error: 'Meeting note not found' }); return; }

    res.json({ message: '회의록이 삭제되었습니다.' });
  } catch (error) {
    console.error('[meetingNoteController] deleteMeetingNote error:', error);
    res.status(500).json({ error: '회의록 삭제에 실패했습니다.' });
  }
}

export async function generateNoteShareLink(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

    const { rows: existing } = await pool.query('SELECT share_token FROM meeting_notes WHERE id = $1', [id]);
    if (existing.length === 0) { res.status(404).json({ error: 'Meeting note not found' }); return; }

    let token = existing[0].share_token;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE meeting_notes SET share_token = $1 WHERE id = $2', [token, id]);
    }

    const basePath = process.env.BASE_PATH || '';
    const shareUrl = `${basePath}/notes/${id}/edit?token=${token}`;
    res.json({ share_url: shareUrl, share_token: token });
  } catch (error) {
    console.error('[meetingNoteController] generateNoteShareLink error:', error);
    res.status(500).json({ error: '공유 링크 생성에 실패했습니다.' });
  }
}

export async function getSharedMeetingNote(req: Request, res: Response): Promise<void> {
  try {
    const token = req.params.token;
    if (!token) { res.status(400).json({ error: 'Token is required' }); return; }

    const { rows } = await pool.query(`SELECT m.id, to_char(m.report_date, 'YYYY-MM-DD') AS report_date,
              m.user_id, m.team_id, m.department_id, m.content_html, m.tag_signature,
              m.created_at, m.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color,
              u.display_name AS user_display_name
       FROM meeting_notes m
       LEFT JOIN departments d ON m.department_id = d.id
       LEFT JOIN teams t ON m.team_id = t.id
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.share_token = $1`, [token]);

    if (rows.length === 0) { res.status(404).json({ error: '공유된 회의록을 찾을 수 없습니다.' }); return; }
    res.json(rows[0]);
  } catch (error) {
    console.error('[meetingNoteController] getSharedMeetingNote error:', error);
    res.status(500).json({ error: 'Failed to fetch shared meeting note' });
  }
}

export async function sendNoteShareEmail(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

    const { recipients } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: '수신자 이메일을 입력해주세요.' });
      return;
    }

    const { rows } = await pool.query(`SELECT id, to_char(report_date, 'YYYY-MM-DD') AS report_date, share_token FROM meeting_notes WHERE id = $1`, [id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Meeting note not found' }); return; }

    let token = rows[0].share_token;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE meeting_notes SET share_token = $1 WHERE id = $2', [token, id]);
    }

    const reportDate = rows[0].report_date;
    const shareUrl = `https://meeting.kaflix.com/notes/${id}/edit?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtps.hiworks.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'alpha@kaflix.com',
        pass: process.env.SMTP_PASS || '3241279Ji@',
      },
    });

    await transporter.sendMail({
      from: `"보고또보고서" <${process.env.SMTP_USER || 'alpha@kaflix.com'}>`,
      to: recipients.join(', '),
      subject: `회의록 ${reportDate}`,
      html: `<p>안녕하세요.</p>
<br/>
<p>회의록 링크를 보내 드립니다.</p>
<br/>
<p><a href="${shareUrl}">${shareUrl}</a></p>
<br/>
<br/>
<p>감사합니다.</p>`,
    });

    res.json({ message: '메일이 발송되었습니다.', share_url: shareUrl });
  } catch (error) {
    console.error('[meetingNoteController] sendNoteShareEmail error:', error);
    res.status(500).json({ error: '메일 발송에 실패했습니다.' });
  }
}
