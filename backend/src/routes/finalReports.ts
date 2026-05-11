import { Router } from 'express';
import {
  getFinalReports,
  getFinalReportById,
  deleteFinalReport,
  mergeFinalReport,
  getPreviousFinalReport,
  analyzeWeeklyComparison,
  saveMeetingNotes,
} from '../controllers/finalReportController';
import {
  generateShareLink,
  getSharedReport,
  sendShareEmail,
} from '../controllers/shareController';

const router = Router();

router.post('/merge', mergeFinalReport);
router.post('/analyze', analyzeWeeklyComparison);
router.get('/previous', getPreviousFinalReport);
router.get('/shared/:token', getSharedReport);
router.get('/', getFinalReports);
router.get('/:id', getFinalReportById);
router.post('/:id/share', generateShareLink);
router.post('/:id/send-email', sendShareEmail);
router.put('/:id/meeting-notes', saveMeetingNotes);
router.delete('/:id', deleteFinalReport);

export default router;
