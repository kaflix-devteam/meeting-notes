import { Router } from 'express';
import { getTokens, createToken, deleteToken } from '../controllers/tokenController';

const router = Router();

// 개인 MCP 토큰 발급/조회/폐기
router.get('/', getTokens);
router.post('/', createToken);
router.delete('/:id', deleteToken);

export default router;
