import { Request, Response } from 'express';
import * as tagService from '../services/tagService';

export async function getTags(req: Request, res: Response): Promise<void> {
  try {
    const departmentId = parseInt(req.query.department_id as string, 10);
    const teamId = parseInt(req.query.team_id as string, 10);
    if (isNaN(departmentId) || isNaN(teamId)) {
      res.status(400).json({ error: 'department_id and team_id are required' });
      return;
    }
    const tags = await tagService.getTagsByDeptAndTeam(departmentId, teamId);
    res.json(tags);
  } catch (error) {
    console.error('[tagController] getTags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
}

export async function createTag(req: Request, res: Response): Promise<void> {
  try {
    const { name, team_id, department_id } = req.body;
    if (!name || !team_id || !department_id) {
      res.status(400).json({ error: 'name, team_id, department_id are required' });
      return;
    }
    const tag = await tagService.createTag(name, team_id, department_id);
    res.status(201).json(tag);
  } catch (error) {
    console.error('[tagController] createTag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
}

export async function deleteTag(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid tag ID' }); return; }
    const deleted = await tagService.deleteTag(id);
    if (!deleted) { res.status(404).json({ error: 'Tag not found' }); return; }
    res.json({ message: '태그가 삭제되었습니다.' });
  } catch (error) {
    console.error('[tagController] deleteTag error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
}

export async function getReportTags(req: Request, res: Response): Promise<void> {
  try {
    const reportId = parseInt(req.params.reportId as string, 10);
    if (isNaN(reportId)) { res.status(400).json({ error: 'Invalid report ID' }); return; }
    const tags = await tagService.getTagsByReportId(reportId);
    res.json(tags);
  } catch (error) {
    console.error('[tagController] getReportTags error:', error);
    res.status(500).json({ error: 'Failed to fetch report tags' });
  }
}

export async function setReportTags(req: Request, res: Response): Promise<void> {
  try {
    const reportId = parseInt(req.params.reportId as string, 10);
    if (isNaN(reportId)) { res.status(400).json({ error: 'Invalid report ID' }); return; }
    const { tag_ids } = req.body;
    await tagService.setReportTags(reportId, Array.isArray(tag_ids) ? tag_ids : []);
    res.json({ message: '태그가 설정되었습니다.' });
  } catch (error) {
    console.error('[tagController] setReportTags error:', error);
    res.status(500).json({ error: 'Failed to set report tags' });
  }
}
