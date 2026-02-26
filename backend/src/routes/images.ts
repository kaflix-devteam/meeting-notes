import { Router } from 'express';
import { uploadImage } from '../controllers/imageController';
import imageUpload from '../middleware/imageUpload';

const router = Router();

router.post('/', imageUpload.single('image'), uploadImage);

export default router;
