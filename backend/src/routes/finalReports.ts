import { Router } from 'express';
import {
  getFinalReports,
  getFinalReportById,
  deleteFinalReport,
  mergeFinalReport,
} from '../controllers/finalReportController';

const router = Router();

router.post('/merge', mergeFinalReport);
router.get('/', getFinalReports);
router.get('/:id', getFinalReportById);
router.delete('/:id', deleteFinalReport);

export default router;
