import { Router } from 'express';
import { signup, login, getUsers, updateUserTeam, deleteUser } from '../controllers/authController';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/users', getUsers);
router.put('/users/:id', updateUserTeam);
router.delete('/users/:id', deleteUser);

export default router;
