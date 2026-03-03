import { Router } from 'express';
import {
  getFinalReports,
  getFinalReportById,
  mergeFinalReport,
} from '../controllers/finalReportController';

const router = Router();

router.post('/merge', mergeFinalReport);
router.get('/', getFinalReports);
router.get('/:id', getFinalReportById);

export default router;
