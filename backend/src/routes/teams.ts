import { Router } from 'express';
import { getTeams, getDepartments, getTeamsWithDepartment, createTeam, updateTeam, deleteTeam } from '../controllers/teamController';

const router = Router();

router.get('/', getTeams);
router.get('/departments', getDepartments);
router.get('/all', getTeamsWithDepartment);
router.post('/', createTeam);
router.put('/:id', updateTeam);
router.delete('/:id', deleteTeam);

export default router;
