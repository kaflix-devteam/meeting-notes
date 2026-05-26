import { Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../config/database';
// 공유 토큰 생성
export async function generateShareLink(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    // 이미 토큰이 있으면 재사용
    const { rows: existing } = await pool.query('SELECT share_token FROM final_reports WHERE id = $1', [id]);
    if (existing.length === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    let token = existing[0].share_token;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE final_reports SET share_token = $1 WHERE id = $2', [token, id]);
    }

    // 기존 최종보고서 상세 페이지에 토큰 파라미터 추가
    const basePath = process.env.BASE_PATH || '';
    const shareUrl = `${basePath}/meetings/${id}?token=${token}`;

    res.json({ share_url: shareUrl, share_token: token });
  } catch (error) {
    console.error('[shareController] generateShareLink error:', error);
    res.status(500).json({ error: '공유 링크 생성에 실패했습니다.' });
  }
}

// 공유 토큰으로 보고서 조회 (인증 불필요)
export async function getSharedReport(req: Request, res: Response): Promise<void> {
  try {
    const token = req.params.token;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const { rows } = await pool.query(`SELECT f.id, to_char(f.report_date, 'YYYY-MM-DD') AS report_date, f.content_html, f.team_summary, f.analysis_html, f.meeting_notes,
              f.department_id, f.team_id, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       WHERE f.share_token = $1`, [token]);

    if (rows.length === 0) {
      res.status(404).json({ error: '공유된 보고서를 찾을 수 없습니다.' });
      return;
    }

    const row = rows[0];
    const summary = typeof row.team_summary === 'string'
      ? JSON.parse(row.team_summary)
      : row.team_summary;

    res.json({
      ...row,
      team_summary: summary,
    });
  } catch (error) {
    console.error('[shareController] getSharedReport error:', error);
    res.status(500).json({ error: 'Failed to fetch shared report' });
  }
}

// 메일 발송
export async function sendShareEmail(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    const { recipients } = req.body; // ["email1@test.com", "email2@test.com"]
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: '수신자 이메일을 입력해주세요.' });
      return;
    }

    // 보고서 조회 + 공유 토큰 확보
    const { rows } = await pool.query(`SELECT id, to_char(report_date, 'YYYY-MM-DD') AS report_date, share_token FROM final_reports WHERE id = $1`, [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    let token = rows[0].share_token;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE final_reports SET share_token = $1 WHERE id = $2', [token, id]);
    }

    const reportDate = rows[0].report_date;
    const shareUrl = `https://meeting.kaflix.com/meetings/${id}?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtps.hiworks.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'alpha@kaflix.com',
        pass: process.env.SMTP_PASS || '3241279Ji@',
      },
    });

    const mailOptions = {
      from: `"보고또보고서" <${process.env.SMTP_USER || 'alpha@kaflix.com'}>`,
      to: recipients.join(', '),
      subject: `주간업무보고서 ${reportDate}`,
      html: `<p>안녕하세요.</p>
<br/>
<p>금주 업무보고서 링크를 보내 드립니다.</p>
<br/>
<p><a href="${shareUrl}">${shareUrl}</a></p>
<br/>
<br/>
<p>감사합니다.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: '메일이 발송되었습니다.', share_url: shareUrl });
  } catch (error) {
    console.error('[shareController] sendShareEmail error:', error);
    res.status(500).json({ error: '메일 발송에 실패했습니다.' });
  }
}
