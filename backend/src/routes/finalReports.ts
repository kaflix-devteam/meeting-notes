import { Router } from 'express';
import {
  getFinalReports,
  getFinalReportById,
} from '../controllers/finalReportController';

const router = Router();

router.get('/', getFinalReports);
router.get('/:id', getFinalReportById);

export default router;
