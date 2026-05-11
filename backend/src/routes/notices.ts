import { Router } from 'express';
import {
  getNotices, getUnreadNotices, createNotice, updateNotice, deleteNotice,
  markAsRead, markAllAsRead,
} from '../controllers/noticeController';

const router = Router();

router.get('/', getNotices);
router.get('/unread', getUnreadNotices);
router.post('/', createNotice);
router.put('/:id', updateNotice);
router.delete('/:id', deleteNotice);
router.post('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);

export default router;
