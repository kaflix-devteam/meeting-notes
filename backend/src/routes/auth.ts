import { Router } from 'express';
import {
  signup,
  login,
  getUsers,
  updateUserTeam,
  deleteUser,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from '../controllers/authController';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/users', getUsers);
router.put('/users/:id', updateUserTeam);
router.delete('/users/:id', deleteUser);

// 비밀번호 찾기
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/verify', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
