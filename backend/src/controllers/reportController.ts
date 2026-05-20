import { Request, Response } from 'express';
import pool from '../config/database';
import * as reportService from '../services/reportService';
import * as tagService from '../services/tagService';
import { polishReport as polishReportAI } from '../services/aiService';

export async function createReport(req: Request, res: Response): Promise<void> {
  try {
    const { report_date, content_html, user_id, team_id, tag_ids } = req.body;

    if (!report_date || !content_html || !user_id) {
      res.status(400).json({ error: 'Missing required fields: report_date, content_html, user_id' });
      return;
    }

    const report = await reportService.createReport(user_id, report_date, content_html, team_id || undefined);

    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      await tagService.setReportTags(report.id, tag_ids);
    }

    res.status(201).json(report);
  } catch (error: any) {
    console.error('[reportController] createReport error:', error);
    if (error.code === '23505' || error.errno === 1062) {
      res.status(409).json({ error: '이 날짜에 이미 보고서가 존재합니다.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create report' });
  }
}

async function attachTagsToReports(reports: any[]): Promise<any[]> {
  if (reports.length === 0) return reports;
  const ids = reports.map(r => r.id);
  const { rows: tagRows } = await pool.query(`SELECT rtm.report_id, rt.id as tag_id, rt.name as tag_name
     FROM report_tag_map rtm
     JOIN report_tags rt ON rtm.tag_id = rt.id
     WHERE rtm.report_id = ANY($1::int[])
     ORDER BY rt.name`, [ids]);
  const tagMap = new Map<number, { id: number; name: string }[]>();
  for (const row of tagRows) {
    const list = tagMap.get(row.report_id) || [];
    list.push({ id: row.tag_id, name: row.tag_name });
    tagMap.set(row.report_id, list);
  }
  return reports.map(r => ({ ...r, tags: tagMap.get(r.id) || [] }));
}

export async function getReports(req: Request, res: Response): Promise<void> {
  try {
    const all = req.query.all === 'true';
    if (all) {
      const reports = await reportService.getAllReports();
      res.json(await attachTagsToReports(reports));
      return;
    }

    const userId = parseInt(req.query.user_id as string, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'user_id query parameter is required' });
      return;
    }

    const reports = await reportService.getReportsByUserId(userId);
    res.json(await attachTagsToReports(reports));
  } catch (error) {
    console.error('[reportController] getReports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
}

export async function getReportById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }

    const report = await reportService.getReportById(id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const attachments = await reportService.getAttachmentsByReportId(id);
    res.json({ ...report, attachments });
  } catch (error) {
    console.error('[reportController] getReportById error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
}

export async function deleteReport(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }

    const deleted = await reportService.deleteReport(id);
    if (!deleted) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json({ message: 'Report deleted' });
  } catch (error) {
    console.error('[reportController] deleteReport error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
}

export async function updateReport(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }

    const { content_html, report_date, team_id, tag_ids } = req.body;
    if (!content_html || !report_date) {
      res.status(400).json({ error: 'Missing required fields: content_html, report_date' });
      return;
    }

    const updated = await reportService.updateReport(id, content_html, report_date, team_id || undefined);
    if (!updated) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (Array.isArray(tag_ids)) {
      await tagService.setReportTags(id, tag_ids);
    }

    res.json(updated);
  } catch (error) {
    console.error('[reportController] updateReport error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
}

export async function getPreviousWeekReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.query.user_id as string, 10);
    const reportDate = req.query.report_date as string;
    const teamId = req.query.team_id ? parseInt(req.query.team_id as string, 10) : undefined;

    if (isNaN(userId) || !reportDate) {
      res.status(400).json({ error: 'user_id and report_date are required' });
      return;
    }

    const report = await reportService.getPreviousWeekReport(userId, reportDate, teamId);
    res.json(report);
  } catch (error) {
    console.error('[reportController] getPreviousWeekReport error:', error);
    res.status(500).json({ error: 'Failed to fetch previous week report' });
  }
}

export async function checkDuplicate(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.query.user_id as string, 10);
    const reportDate = req.query.report_date as string;
    const teamId = req.query.team_id ? parseInt(req.query.team_id as string, 10) : undefined;

    if (isNaN(userId) || !reportDate) {
      res.status(400).json({ error: 'user_id and report_date are required' });
      return;
    }

    const report = await reportService.findDuplicateReport(userId, reportDate, teamId);
    res.json(report);
  } catch (error) {
    console.error('[reportController] checkDuplicate error:', error);
    res.status(500).json({ error: 'Failed to check duplicate' });
  }
}

export async function polishReport(req: Request, res: Response): Promise<void> {
  try {
    const { content_html, previous_content_html } = req.body;

    if (!content_html || content_html === '<p></p>') {
      res.status(400).json({ error: '다듬을 내용이 없습니다.' });
      return;
    }

    const polished = await polishReportAI(content_html, previous_content_html || undefined);
    res.json({ content_html: polished });
  } catch (error) {
    console.error('[reportController] polishReport error:', error);
    res.status(500).json({ error: 'AI 다듬기에 실패했습니다.' });
  }
}
