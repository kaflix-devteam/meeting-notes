import crypto from 'crypto';
import pool from '../config/database';

// 토큰 형식: mnt_<48 hex chars>. DB에는 sha256 해시만 저장하고 원문은 발급 시 1회만 반환한다.
const TOKEN_PREFIX = 'mnt_';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export interface TokenRecord {
  id: number;
  name: string;
  token_prefix: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

export interface VerifiedToken {
  tokenId: number;
  userId: number;
}

/** 새 개인 토큰 발급. 원문 토큰(평문)은 이 반환값에서만 확인 가능. */
export async function issueToken(
  userId: number,
  name: string,
): Promise<{ token: string; record: TokenRecord }> {
  const raw = TOKEN_PREFIX + crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(raw);
  const tokenPrefix = raw.slice(0, 12); // mnt_xxxxxxx (표시용)

  const { rows } = await pool.query(
    `INSERT INTO mcp_tokens (user_id, name, token_hash, token_prefix)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, token_prefix, created_at, last_used_at, revoked_at`,
    [userId, name, tokenHash, tokenPrefix],
  );

  return { token: raw, record: rows[0] as TokenRecord };
}

/** 토큰 원문을 검증하고 (유효하면) 소유자 정보를 반환. last_used_at 갱신. */
export async function verifyToken(raw: string): Promise<VerifiedToken | null> {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;
  const tokenHash = hashToken(raw);

  const { rows } = await pool.query(
    `SELECT id, user_id FROM mcp_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
  if (rows.length === 0) return null;

  // 마지막 사용 시각 갱신 (실패해도 인증 자체는 통과)
  pool
    .query('UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = $1', [rows[0].id])
    .catch(() => undefined);

  return { tokenId: rows[0].id, userId: rows[0].user_id };
}

/** 특정 유저의 토큰 목록 (해시 제외, 표시용 메타데이터만). */
export async function listTokens(userId: number): Promise<TokenRecord[]> {
  const { rows } = await pool.query(
    `SELECT id, name, token_prefix, created_at, last_used_at, revoked_at
       FROM mcp_tokens
      WHERE user_id = $1
      ORDER BY revoked_at IS NOT NULL, created_at DESC`,
    [userId],
  );
  return rows as TokenRecord[];
}

/** 토큰 폐기 (soft delete). 소유자 본인만 가능. */
export async function revokeToken(userId: number, tokenId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE mcp_tokens SET revoked_at = NOW()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tokenId, userId],
  );
  return (rowCount ?? 0) > 0;
}
