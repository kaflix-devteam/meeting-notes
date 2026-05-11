import { Router } from 'express';
import { getTags, createTag, deleteTag, getReportTags, setReportTags } from '../controllers/tagController';

const router = Router();

router.get('/', getTags);
router.post('/', createTag);
router.get('/report/:reportId', getReportTags);
router.put('/report/:reportId', setReportTags);
router.delete('/:id', deleteTag);

export default router;
