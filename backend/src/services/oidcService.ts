import { Issuer, Client, generators } from 'openid-client';
import crypto from 'crypto';
import pool from '../config/database';

let oidcClient: Client;

const ISSUER_URL = 'https://auth.kaflix.com/realms/kaflix';
const CLIENT_ID = 'meetingnote';
const SCOPES = 'openid profile email groups';

interface PendingAuth {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
}

const pendingStates = new Map<string, PendingAuth>();
const ssoTokens = new Map<string, { user: any; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (now - v.createdAt > 5 * 60 * 1000) pendingStates.delete(k);
  }
  for (const [k, v] of ssoTokens) {
    if (now - v.createdAt > 60 * 1000) ssoTokens.delete(k);
  }
}, 60 * 1000);

export async function getClient(): Promise<Client> {
  if (oidcClient) return oidcClient;

  const issuer = await Issuer.discover(ISSUER_URL);
  const redirectUri = `${process.env.EXTERNAL_URL || 'https://meeting.kaflix.com'}/api/auth/callback/keycloak`;

  oidcClient = new issuer.Client({
    client_id: CLIENT_ID,
    client_secret: process.env.OIDC_CLIENT_SECRET,
    redirect_uris: [redirectUri],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  });

  return oidcClient;
}

export function buildAuthUrl(client: Client): { url: string; state: string } {
  const state = generators.state();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const nonce = generators.nonce();

  pendingStates.set(state, { codeVerifier, nonce, createdAt: Date.now() });

  const redirectUri = `${process.env.EXTERNAL_URL || 'https://meeting.kaflix.com'}/api/auth/callback/keycloak`;

  const url = client.authorizationUrl({
    scope: SCOPES,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
  });

  return { url, state };
}

export function consumeState(state: string): PendingAuth | null {
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  return entry;
}

export function storeSsoToken(user: any): string {
  const token = crypto.randomBytes(32).toString('hex');
  ssoTokens.set(token, { user, createdAt: Date.now() });
  return token;
}

export function consumeSsoToken(token: string): any | null {
  const entry = ssoTokens.get(token);
  if (!entry) return null;
  ssoTokens.delete(token);
  return entry.user;
}

export async function provisionUser(claims: {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
}): Promise<any> {
  const { sub, email, name, preferred_username, groups } = claims;
  const isAdmin = Array.isArray(groups) && groups.includes('leadership') ? 1 : 0;

  // keycloak_sub 로 기존 유저 검색
  const { rows: existing } = await pool.query(
    `SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id,
            t.name as team_name, t.color as team_color,
            d.id as department_id, d.name as department_name, d.color as department_color
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
      WHERE u.keycloak_sub = $1`,
    [sub],
  );

  if (existing.length > 0) {
    const u = existing[0];
    // 이름·관리자 동기화
    await pool.query(
      'UPDATE users SET display_name = COALESCE($1, display_name), is_admin = $2, email = COALESCE($3, email) WHERE id = $4',
      [name, isAdmin, email, u.id],
    );
    return { ...u, display_name: name || u.display_name, is_admin: isAdmin, email };
  }

  // 이메일로 기존 계정 연결 시도
  if (email) {
    const { rows: byEmail } = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id,
              t.name as team_name, t.color as team_color,
              d.id as department_id, d.name as department_name, d.color as department_color
         FROM users u
         JOIN teams t ON u.team_id = t.id
         JOIN departments d ON t.department_id = d.id
        WHERE LOWER(u.email) = LOWER($1)`,
      [email],
    );

    if (byEmail.length > 0) {
      const u = byEmail[0];
      await pool.query(
        'UPDATE users SET keycloak_sub = $1, display_name = COALESCE($2, display_name), is_admin = $3 WHERE id = $4',
        [sub, name, isAdmin, u.id],
      );
      return { ...u, display_name: name || u.display_name, is_admin: isAdmin };
    }
  }

  // 신규 유저 생성 — 첫 번째 팀을 기본값으로
  const { rows: defaultTeam } = await pool.query('SELECT id FROM teams ORDER BY id LIMIT 1');
  const teamId = defaultTeam.length > 0 ? defaultTeam[0].id : 1;

  const displayName = name || preferred_username || email || sub;
  const username = preferred_username || email || sub;

  const { rows: created } = await pool.query(
    `INSERT INTO users (username, display_name, team_id, is_admin, email, keycloak_sub)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [username, displayName, teamId, isAdmin, email, sub],
  );

  const { rows: newUser } = await pool.query(
    `SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id,
            t.name as team_name, t.color as team_color,
            d.id as department_id, d.name as department_name, d.color as department_color
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
      WHERE u.id = $1`,
    [created[0].id],
  );

  return newUser[0];
}
