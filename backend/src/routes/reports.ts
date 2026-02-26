import { Router } from 'express';
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
} from '../controllers/reportController';
import { uploadAttachment } from '../controllers/attachmentController';
import upload from '../middleware/upload';

const router = Router();

router.post('/', createReport);
router.get('/', getReports);
router.get('/:id', getReportById);
router.put('/:id', updateReport);
router.delete('/:id', deleteReport);
router.post('/:id/attachments', upload.single('file'), uploadAttachment);

export default router;
