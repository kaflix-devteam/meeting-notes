import { Request, Response } from 'express';
import * as reportService from '../services/reportService';
import { mergeReports } from '../services/mergeService';
import { polishReport as polishReportAI } from '../services/aiService';

export async function createReport(req: Request, res: Response): Promise<void> {
  try {
    const { team_id, report_date, content_html, user_id } = req.body;

    if (!team_id || !report_date || !content_html || !user_id) {
      res.status(400).json({ error: 'Missing required fields: team_id, report_date, content_html, user_id' });
      return;
    }

    const report = await reportService.createReport(user_id, team_id, report_date, content_html);

    // Always generate/update final report for this date
    mergeReports(report_date).catch((err) => {
      console.error('[reportController] merge failed:', err);
    });

    res.status(201).json(report);
  } catch (error: any) {
    console.error('[reportController] createReport error:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'A report already exists for this team/date/user combination' });
      return;
    }
    res.status(500).json({ error: 'Failed to create report' });
  }
}

export async function getReports(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.query.user_id as string, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'user_id query parameter is required' });
      return;
    }

    const reports = await reportService.getReportsByUserId(userId);
    res.json(reports);
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

    // Re-merge remaining reports for the date
    mergeReports(deleted.report_date).catch((err) => {
      console.error('[reportController] merge after delete failed:', err);
    });

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

    const { content_html, team_id, report_date } = req.body;
    if (!content_html || !team_id || !report_date) {
      res.status(400).json({ error: 'Missing required fields: content_html, team_id, report_date' });
      return;
    }

    // Get the old report date before updating (for re-merge if date changed)
    const oldReport = await reportService.getReportById(id);
    const oldDate = oldReport?.report_date as unknown as string;

    const updated = await reportService.updateReport(id, content_html, team_id, report_date);
    if (!updated) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Re-merge for the new report date
    mergeReports(report_date).catch((err) => {
      console.error('[reportController] merge after update failed:', err);
    });

    // If date changed, also re-merge the old date
    if (oldDate && oldDate !== report_date) {
      mergeReports(oldDate).catch((err) => {
        console.error('[reportController] merge old date after update failed:', err);
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('[reportController] updateReport error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
}

export async function polishReport(req: Request, res: Response): Promise<void> {
  try {
    const { content_html } = req.body;

    if (!content_html || content_html === '<p></p>') {
      res.status(400).json({ error: '다듬을 내용이 없습니다.' });
      return;
    }

    const polished = await polishReportAI(content_html);
    res.json({ content_html: polished });
  } catch (error) {
    console.error('[reportController] polishReport error:', error);
    res.status(500).json({ error: 'AI 다듬기에 실패했습니다.' });
  }
}
