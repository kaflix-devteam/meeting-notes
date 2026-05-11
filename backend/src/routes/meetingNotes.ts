import { Router } from 'express';
import {
  getMeetingNotes,
  getMeetingNoteById,
  createMeetingNote,
  updateMeetingNote,
  deleteMeetingNote,
  generateNoteShareLink,
  getSharedMeetingNote,
  sendNoteShareEmail,
} from '../controllers/meetingNoteController';

const router = Router();

router.get('/', getMeetingNotes);
router.post('/', createMeetingNote);
router.get('/shared/:token', getSharedMeetingNote);
router.get('/:id', getMeetingNoteById);
router.put('/:id', updateMeetingNote);
router.post('/:id/share', generateNoteShareLink);
router.post('/:id/send-email', sendNoteShareEmail);
router.delete('/:id', deleteMeetingNote);

export default router;
