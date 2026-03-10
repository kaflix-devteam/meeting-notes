import { Router } from 'express';
import {
  getFinalReports,
  getFinalReportById,
  deleteFinalReport,
  mergeFinalReport,
  getPreviousFinalReport,
  analyzeWeeklyComparison,
} from '../controllers/finalReportController';

const router = Router();

router.post('/merge', mergeFinalReport);
router.post('/analyze', analyzeWeeklyComparison);
router.get('/previous', getPreviousFinalReport);
router.get('/', getFinalReports);
router.get('/:id', getFinalReportById);
router.delete('/:id', deleteFinalReport);

export default router;
