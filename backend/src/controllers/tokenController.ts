import { Request, Response } from 'express';
import { issueToken, listTokens, revokeToken } from '../services/tokenService';

// 이 앱은 별도 세션/인증 미들웨어가 없고 클라이언트가 user_id 를 전달하는 기존 패턴을 따른다.
function parseUserId(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN;
  return Number.isNaN(n) ? null : n;
}

export async function getTokens(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseUserId(req.query.user_id);
    if (userId === null) {
      res.status(400).json({ error: 'user_id가 필요합니다.' });
      return;
    }
    const tokens = await listTokens(userId);
    res.json(tokens);
  } catch (error) {
    console.error('[tokenController] getTokens error:', error);
    res.status(500).json({ error: '토큰 목록 조회에 실패했습니다.' });
  }
}

export async function createToken(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseUserId(req.body?.user_id);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (userId === null) {
      res.status(400).json({ error: 'user_id가 필요합니다.' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: '토큰 용도(이름)를 입력해주세요.' });
      return;
    }
    if (name.length > 100) {
      res.status(400).json({ error: '토큰 이름은 100자 이하여야 합니다.' });
      return;
    }

    const { token, record } = await issueToken(userId, name);
    // 원문 토큰은 이 응답에서만 1회 노출된다.
    res.status(201).json({ token, ...record });
  } catch (error) {
    console.error('[tokenController] createToken error:', error);
    res.status(500).json({ error: '토큰 발급에 실패했습니다.' });
  }
}

export async function deleteToken(req: Request, res: Response): Promise<void> {
  try {
    const tokenId = parseInt(req.params.id as string, 10);
    const userId = parseUserId(req.body?.user_id ?? req.query.user_id);

    if (Number.isNaN(tokenId) || userId === null) {
      res.status(400).json({ error: 'user_id와 유효한 토큰 ID가 필요합니다.' });
      return;
    }

    const ok = await revokeToken(userId, tokenId);
    if (!ok) {
      res.status(404).json({ error: '토큰을 찾을 수 없거나 이미 폐기되었습니다.' });
      return;
    }
    res.json({ message: '토큰이 폐기되었습니다.' });
  } catch (error) {
    console.error('[tokenController] deleteToken error:', error);
    res.status(500).json({ error: '토큰 폐기에 실패했습니다.' });
  }
}
