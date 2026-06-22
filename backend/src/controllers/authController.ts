import { Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../config/database';
import {
  getClient,
  buildAuthUrl,
  buildLogoutUrl,
  consumeState,
  storeSsoToken,
  consumeSsoToken,
  provisionUser,
} from '../services/oidcService';

// 비밀번호 재설정 토큰 유효 시간 (1시간)
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function createMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtps.hiworks.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'alpha@kaflix.com',
      pass: process.env.SMTP_PASS || '3241279Ji@',
    },
  });
}

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { username, password, display_name, team_id, email } = req.body;

    if (!username || !password || !display_name || !team_id) {
      res.status(400).json({ error: '모든 필드를 입력해주세요.' });
      return;
    }

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.length > 0) {
      res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
      return;
    }

    const { rows: teams } = await pool.query('SELECT id FROM teams WHERE id = $1', [team_id]);
    if (teams.length === 0) {
      res.status(400).json({ error: '존재하지 않는 팀입니다.' });
      return;
    }

    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;

    const result = await pool.query(
      'INSERT INTO users (username, password, display_name, team_id, email) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, password, display_name, team_id, normalizedEmail]
    );

    res.status(201).json({
      id: result.rows[0].id,
      username,
      display_name,
      team_id,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('[authController] signup error:', error);
    res.status(500).json({ error: '회원가입에 실패했습니다.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '아이디와 패스워드를 입력해주세요.' });
      return;
    }

    const { rows } = await pool.query(`SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id, t.name as team_name, t.color as team_color, d.id as department_id, d.name as department_name, d.color as department_color
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
       WHERE u.username = $1 AND u.password = $2`, [username, password]);

    if (rows.length === 0) {
      res.status(401).json({ error: '아이디 또는 패스워드가 올바르지 않습니다.' });
      return;
    }

    const user = rows[0];
    res.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      is_admin: !!user.is_admin,
      team_id: user.team_id,
      team_name: user.team_name,
      team_color: user.team_color,
      department_id: user.department_id,
      department_name: user.department_name,
      department_color: user.department_color,
    });
  } catch (error) {
    console.error('[authController] login error:', error);
    res.status(500).json({ error: '로그인에 실패했습니다.' });
  }
}

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id, u.email, t.name as team_name, d.id as department_id, d.name as department_name
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
       ORDER BY u.id`);
    res.json(rows.map((r: any) => ({ ...r, is_admin: !!r.is_admin })));
  } catch (error) {
    console.error('[authController] getUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function updateUserTeam(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { team_id, display_name } = req.body;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'user id가 필요합니다.' });
      return;
    }

    // 팀 변경
    if (team_id) {
      const { rows: teams } = await pool.query('SELECT id FROM teams WHERE id = $1', [team_id]);
      if (teams.length === 0) {
        res.status(400).json({ error: '존재하지 않는 팀입니다.' });
        return;
      }
      await pool.query('UPDATE users SET team_id = $1 WHERE id = $2', [team_id, userId]);
    }

    // 이름 변경
    if (display_name && display_name.trim()) {
      await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [display_name.trim(), userId]);
    }

    const { rows } = await pool.query(`SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id, t.name as team_name, d.id as department_id, d.name as department_name
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
       WHERE u.id = $1`, [userId]);

    if (rows.length === 0) {
      res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
      return;
    }

    res.json({ ...rows[0], is_admin: !!rows[0].is_admin });
  } catch (error) {
    console.error('[authController] updateUserTeam error:', error);
    res.status(500).json({ error: '유저 정보 변경에 실패했습니다.' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.params.id as string, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: '유효하지 않은 유저 ID입니다.' });
      return;
    }

    // admin 계정은 삭제 불가
    const { rows: users } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (users.length === 0) {
      res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
      return;
    }
    if (users[0].is_admin) {
      res.status(403).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
      return;
    }

    // 유저의 보고서도 함께 삭제
    await pool.query('DELETE FROM reports WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: '유저가 삭제되었습니다.' });
  } catch (error) {
    console.error('[authController] deleteUser error:', error);
    res.status(500).json({ error: '유저 삭제에 실패했습니다.' });
  }
}

// ============================================================
// 비밀번호 찾기 (이메일로 리셋 링크 발송)
// ============================================================
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!rawEmail) {
      res.status(400).json({ error: '이메일을 입력해주세요.' });
      return;
    }

    const email = rawEmail.toLowerCase();

    // 이메일 컬럼에 매핑된 유저, 없으면 username 이 이메일 형식인 케이스도 허용
    const { rows } = await pool.query(
      `SELECT id, username, display_name, email
         FROM users
        WHERE LOWER(email) = $1 OR LOWER(username) = $1
        LIMIT 1`,
      [email]
    );

    // 보안: 유저가 없어도 동일한 성공 응답을 돌려준다 (이메일 enumeration 방지)
    const genericResponse = { message: '입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해 주세요.' };

    if (rows.length === 0) {
      res.json(genericResponse);
      return;
    }

    const user = rows[0];
    const deliveryEmail = user.email || (user.username && user.username.includes('@') ? user.username : null);

    if (!deliveryEmail) {
      // 메일 주소가 없으면 보낼 수 없으니 명시적으로 알린다 (보안보다 사용성을 우선)
      res.status(400).json({ error: '해당 계정에 등록된 이메일이 없습니다. 관리자에게 문의해 주세요.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const resetUrl = `https://meeting.kaflix.com/reset-password?token=${token}`;

    const transporter = createMailTransporter();
    await transporter.sendMail({
      from: `"보고또보고서" <${process.env.SMTP_USER || 'alpha@kaflix.com'}>`,
      to: deliveryEmail,
      subject: '[보고또보고서] 비밀번호 재설정 안내',
      html: `<p>안녕하세요, ${user.display_name || user.username}님.</p>
<p>아래 링크를 눌러 새 비밀번호를 설정해 주세요. 링크는 1시간 동안만 유효합니다.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>본인이 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
<br/>
<p>감사합니다.</p>`,
    });

    res.json(genericResponse);
  } catch (error) {
    console.error('[authController] forgotPassword error:', error);
    res.status(500).json({ error: '비밀번호 재설정 메일 발송에 실패했습니다.' });
  }
}

// 토큰 유효성 확인 (프론트에서 페이지 진입 시 사전 검증)
export async function verifyResetToken(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      res.status(400).json({ valid: false, error: '토큰이 필요합니다.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT pr.id, pr.expires_at, pr.used_at, u.username, u.display_name
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
        WHERE pr.token = $1
        LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      res.status(404).json({ valid: false, error: '유효하지 않은 링크입니다.' });
      return;
    }

    const row = rows[0];
    if (row.used_at) {
      res.status(410).json({ valid: false, error: '이미 사용된 링크입니다.' });
      return;
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      res.status(410).json({ valid: false, error: '만료된 링크입니다. 비밀번호 찾기를 다시 진행해 주세요.' });
      return;
    }

    res.json({ valid: true, username: row.username, display_name: row.display_name });
  } catch (error) {
    console.error('[authController] verifyResetToken error:', error);
    res.status(500).json({ valid: false, error: '토큰 검증에 실패했습니다.' });
  }
}

// ============================================================
// SSO (Keycloak OIDC)
// ============================================================

export async function ssoLogin(_req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient();
    const { url } = buildAuthUrl(client);
    res.redirect(url);
  } catch (error) {
    console.error('[authController] ssoLogin error:', error);
    res.status(500).json({ error: 'SSO 로그인 초기화에 실패했습니다.' });
  }
}

export async function ssoLogout(_req: Request, res: Response): Promise<void> {
  try {
    const url = await buildLogoutUrl();
    res.redirect(url);
  } catch (error) {
    console.error('[authController] ssoLogout error:', error);
    res.redirect('/login?loggedout=1');
  }
}

export async function ssoCallback(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);

    if (!params.state) {
      res.redirect('/login?sso_error=invalid_state');
      return;
    }

    const pending = consumeState(params.state);
    if (!pending) {
      res.redirect('/login?sso_error=expired_state');
      return;
    }

    const redirectUri = `${process.env.EXTERNAL_URL || 'https://meeting.kaflix.com'}/api/auth/callback/keycloak`;

    const tokenSet = await client.callback(redirectUri, params, {
      state: params.state,
      nonce: pending.nonce,
      code_verifier: pending.codeVerifier,
    });

    const claims = tokenSet.claims();
    const userinfo = await client.userinfo(tokenSet.access_token!);

    const user = await provisionUser({
      sub: claims.sub,
      email: (userinfo.email as string) || undefined,
      name: (userinfo.name as string) || undefined,
      preferred_username: (userinfo.preferred_username as string) || undefined,
      groups: (userinfo.groups as string[]) || undefined,
    });

    const ssoToken = storeSsoToken({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      is_admin: !!user.is_admin,
      team_id: user.team_id,
      team_name: user.team_name,
      team_color: user.team_color,
      department_id: user.department_id,
      department_name: user.department_name,
      department_color: user.department_color,
    });

    res.redirect(`/login?sso_token=${ssoToken}`);
  } catch (error) {
    console.error('[authController] ssoCallback error:', error);
    res.redirect('/login?sso_error=callback_failed');
  }
}

export async function ssoVerify(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      res.status(400).json({ error: '토큰이 필요합니다.' });
      return;
    }

    const user = consumeSsoToken(token);
    if (!user) {
      res.status(401).json({ error: '유효하지 않거나 만료된 SSO 토큰입니다.' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('[authController] ssoVerify error:', error);
    res.status(500).json({ error: 'SSO 인증 확인에 실패했습니다.' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

    if (!token || !newPassword) {
      res.status(400).json({ error: '토큰과 새 비밀번호가 필요합니다.' });
      return;
    }
    if (newPassword.length < 4) {
      res.status(400).json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' });
      return;
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, user_id, expires_at, used_at
         FROM password_resets
        WHERE token = $1
        FOR UPDATE`,
      [token]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: '유효하지 않은 링크입니다.' });
      return;
    }

    const reset = rows[0];
    if (reset.used_at) {
      await client.query('ROLLBACK');
      res.status(410).json({ error: '이미 사용된 링크입니다.' });
      return;
    }
    if (new Date(reset.expires_at).getTime() < Date.now()) {
      await client.query('ROLLBACK');
      res.status(410).json({ error: '만료된 링크입니다. 비밀번호 찾기를 다시 진행해 주세요.' });
      return;
    }

    await client.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, reset.user_id]);
    await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);
    // 같은 유저의 다른 미사용 토큰도 무효화
    await client.query(
      `UPDATE password_resets SET used_at = NOW()
        WHERE user_id = $1 AND id <> $2 AND used_at IS NULL`,
      [reset.user_id, reset.id]
    );

    await client.query('COMMIT');
    res.json({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    console.error('[authController] resetPassword error:', error);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  } finally {
    client.release();
  }
}
