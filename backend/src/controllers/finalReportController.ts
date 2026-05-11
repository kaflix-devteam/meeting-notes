import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mergeReportsManual } from '../services/mergeService';
import { compareWeeklyReports } from '../services/aiService';

export async function getFinalReports(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, DATE_FORMAT(f.report_date, '%Y-%m-%d') AS report_date,
              f.department_id, f.team_id, f.team_summary, f.tag_signature, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       ORDER BY f.report_date DESC, d.name, t.name`
    );

    // 팀 ID → 이름/색상 일괄 조회
    const allTeamIds = new Set<number>();
    const allTagIds = new Set<number>();
    for (const row of rows) {
      const summary = typeof row.team_summary === 'string' ? JSON.parse(row.team_summary) : row.team_summary;
      if (summary) {
        for (const entry of Object.values(summary) as any[]) {
          if (entry.teamId) allTeamIds.add(entry.teamId);
        }
      }
      if (row.tag_signature) {
        for (const tid of row.tag_signature.split(',')) allTagIds.add(parseInt(tid, 10));
      }
    }

    const teamInfoMap = new Map<number, { name: string; color: string }>();
    if (allTeamIds.size > 0) {
      const [teamRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, color FROM teams WHERE id IN (?)', [[...allTeamIds]]
      );
      for (const tr of teamRows) teamInfoMap.set(tr.id, { name: tr.name, color: tr.color });
    }

    const tagNameMap = new Map<number, string>();
    if (allTagIds.size > 0) {
      const [tagRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name FROM report_tags WHERE id IN (?)', [[...allTagIds]]
      );
      for (const tr of tagRows) tagNameMap.set(tr.id, tr.name);
    }

    const result = rows.map((row: any) => {
      const summary = typeof row.team_summary === 'string'
        ? JSON.parse(row.team_summary)
        : row.team_summary;

      // 팀 이름 배열
      const teamBadges: { name: string; color: string }[] = [];
      if (summary) {
        for (const entry of Object.values(summary) as any[]) {
          if (entry.teamId && teamInfoMap.has(entry.teamId)) {
            const t = teamInfoMap.get(entry.teamId)!;
            teamBadges.push({ name: t.name, color: t.color || '#0078D4' });
          }
        }
      }

      // 태그 이름 배열
      const tagNames = row.tag_signature
        ? row.tag_signature.split(',').map((id: string) => tagNameMap.get(parseInt(id, 10)) || id).filter(Boolean)
        : [];

      return {
        ...row,
        team_summary: summary,
        team_badges: teamBadges,
        tag_names: tagNames,
      };
    });
    res.json(result);
  } catch (error) {
    console.error('[finalReportController] getFinalReports error:', error);
    res.status(500).json({ error: 'Failed to fetch final reports' });
  }
}

export async function getFinalReportById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, DATE_FORMAT(f.report_date, '%Y-%m-%d') AS report_date, f.content_html, f.team_summary, f.analysis_html, f.meeting_notes,
              f.department_id, f.team_id, f.tag_signature, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       WHERE f.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Final report not found' });
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
    console.error('[finalReportController] getFinalReportById error:', error);
    res.status(500).json({ error: 'Failed to fetch final report' });
  }
}

export async function deleteFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM final_reports WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Final report not found' });
      return;
    }

    res.json({ message: '최종보고서가 삭제되었습니다.' });
  } catch (error) {
    console.error('[finalReportController] deleteFinalReport error:', error);
    res.status(500).json({ error: '최종보고서 삭제에 실패했습니다.' });
  }
}

export async function getPreviousFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const reportDate = req.query.report_date as string;
    const departmentId = req.query.department_id as string;
    const tagSignature = (req.query.tag_signature as string) || '';

    if (!reportDate || !departmentId) {
      res.status(400).json({ error: 'report_date and department_id are required' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, DATE_FORMAT(f.report_date, '%Y-%m-%d') AS report_date, f.content_html, f.team_summary, f.analysis_html, f.meeting_notes,
              f.department_id, f.team_id, f.tag_signature, f.created_at, f.updated_at,
              d.name AS department_name, d.color AS department_color,
              t.name AS team_name, t.color AS team_color
       FROM final_reports f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN teams t ON f.team_id = t.id
       WHERE f.report_date < ? AND f.department_id = ? AND f.tag_signature = ?
       ORDER BY f.report_date DESC
       LIMIT 1`,
      [reportDate, departmentId, tagSignature]
    );

    if (rows.length === 0) {
      res.json(null);
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
    console.error('[finalReportController] getPreviousFinalReport error:', error);
    res.status(500).json({ error: 'Failed to fetch previous final report' });
  }
}

export async function createMeetingNote(req: Request, res: Response): Promise<void> {
  try {
    const { report_date, department_id, team_id, meeting_notes, tag_signature } = req.body;

    if (!report_date || !department_id) {
      res.status(400).json({ error: 'report_date and department_id are required' });
      return;
    }

    const tagSig = tag_signature || '';

    // team_summary 구성
    let teamSummary = '{}';
    if (team_id) {
      const [teamRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, code FROM teams WHERE id = ?', [team_id]
      );
      if (teamRows.length > 0) {
        const t = teamRows[0];
        teamSummary = JSON.stringify({
          [t.code]: { teamId: t.id, departmentId: department_id, reportCount: 0 }
        });
      }
    }

    // 기존 final_report가 있으면 meeting_notes만 업데이트, 없으면 새로 생성
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM final_reports WHERE report_date = ? AND department_id = ? AND tag_signature = ?`,
      [report_date, department_id, tagSig]
    );

    let finalReportId: number;

    if (existing.length > 0) {
      finalReportId = existing[0].id;
      await pool.query<ResultSetHeader>(
        'UPDATE final_reports SET meeting_notes = ?, team_summary = ? WHERE id = ?',
        [meeting_notes || null, teamSummary, finalReportId]
      );
    } else {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO final_reports (report_date, department_id, content_html, team_summary, meeting_notes, tag_signature)
         VALUES (?, ?, '', ?, ?, ?)`,
        [report_date, department_id, teamSummary, meeting_notes || null, tagSig]
      );
      finalReportId = result.insertId;
    }

    res.status(201).json({ id: finalReportId, message: '회의록이 저장되었습니다.' });
  } catch (error) {
    console.error('[finalReportController] createMeetingNote error:', error);
    res.status(500).json({ error: '회의록 저장에 실패했습니다.' });
  }
}

export async function saveMeetingNotes(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid final report ID' });
      return;
    }

    const { meeting_notes } = req.body;

    await pool.query<ResultSetHeader>(
      'UPDATE final_reports SET meeting_notes = ? WHERE id = ?',
      [meeting_notes || null, id]
    );

    res.json({ message: '회의록이 저장되었습니다.' });
  } catch (error) {
    console.error('[finalReportController] saveMeetingNotes error:', error);
    res.status(500).json({ error: '회의록 저장에 실패했습니다.' });
  }
}

export async function analyzeWeeklyComparison(req: Request, res: Response): Promise<void> {
  try {
    const { current_html, previous_html, current_date, previous_date, final_report_id } = req.body;

    if (!current_html || !previous_html) {
      res.status(400).json({ error: 'current_html and previous_html are required' });
      return;
    }

    const analysisHtml = await compareWeeklyReports(
      current_html,
      previous_html,
      current_date || '',
      previous_date || ''
    );

    // DB에 분석 결과 저장
    if (final_report_id) {
      await pool.query(
        'UPDATE final_reports SET analysis_html = ? WHERE id = ?',
        [analysisHtml, final_report_id]
      );
    }

    res.json({ analysis_html: analysisHtml });
  } catch (error) {
    console.error('[finalReportController] analyzeWeeklyComparison error:', error);
    res.status(500).json({ error: 'AI 분석에 실패했습니다.' });
  }
}

export async function mergeFinalReport(req: Request, res: Response): Promise<void> {
  try {
    const { report_date, department_id } = req.body;

    if (!report_date) {
      res.status(400).json({ error: 'report_date is required' });
      return;
    }

    if (department_id) {
      const count = await mergeReportsManual(report_date, department_id);
      if (count === 0) {
        res.status(404).json({ error: '해당 날짜에 병합할 보고서가 없습니다.' });
        return;
      }
      res.json({ message: `최종보고서에 병합되었습니다. (${count}건)` });
    } else {
      const [deptRows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT t.department_id
         FROM reports r
         JOIN teams t ON r.team_id = t.id
         WHERE r.report_date = ? AND t.department_id IS NOT NULL`,
        [report_date]
      );

      if (deptRows.length === 0) {
        res.status(404).json({ error: '해당 날짜에 병합할 보고서가 없습니다.' });
        return;
      }

      let totalCount = 0;
      for (const row of deptRows) {
        totalCount += await mergeReportsManual(report_date, row.department_id);
      }
      res.json({ message: `최종보고서에 병합되었습니다. (${totalCount}건)` });
    }
  } catch (error) {
    console.error('[finalReportController] mergeFinalReport error:', error);
    res.status(500).json({ error: '최종보고서 병합에 실패했습니다.' });
  }
}
