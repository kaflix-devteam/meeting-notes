import { Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { username, password, display_name, team_id } = req.body;

    if (!username || !password || !display_name || !team_id) {
      res.status(400).json({ error: '모든 필드를 입력해주세요.' });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
      return;
    }

    const [teams] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM teams WHERE id = ?',
      [team_id]
    );
    if (teams.length === 0) {
      res.status(400).json({ error: '존재하지 않는 팀입니다.' });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, password, display_name, team_id) VALUES (?, ?, ?, ?)',
      [username, password, display_name, team_id]
    );

    res.status(201).json({
      id: result.insertId,
      username,
      display_name,
      team_id,
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

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id, t.name as team_name, t.color as team_color, d.id as department_id, d.name as department_name, d.color as department_color
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
       WHERE u.username = ? AND u.password = ?`,
      [username, password]
    );

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
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id, t.name as team_name, d.id as department_id, d.name as department_name
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
       ORDER BY u.id`
    );
    res.json(rows.map((r: any) => ({ ...r, is_admin: !!r.is_admin })));
  } catch (error) {
    console.error('[authController] getUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function updateUserTeam(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { team_id } = req.body;

    if (isNaN(userId) || !team_id) {
      res.status(400).json({ error: 'user id와 team_id가 필요합니다.' });
      return;
    }

    const [teams] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM teams WHERE id = ?',
      [team_id]
    );
    if (teams.length === 0) {
      res.status(400).json({ error: '존재하지 않는 팀입니다.' });
      return;
    }

    await pool.query<ResultSetHeader>(
      'UPDATE users SET team_id = ? WHERE id = ?',
      [team_id, userId]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.display_name, u.is_admin, u.team_id, t.name as team_name, d.id as department_id, d.name as department_name
       FROM users u
       JOIN teams t ON u.team_id = t.id
       JOIN departments d ON t.department_id = d.id
       WHERE u.id = ?`,
      [userId]
    );

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
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT is_admin FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
      return;
    }
    if (users[0].is_admin) {
      res.status(403).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
      return;
    }

    // 유저의 보고서도 함께 삭제
    await pool.query('DELETE FROM reports WHERE user_id = ?', [userId]);
    await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: '유저가 삭제되었습니다.' });
  } catch (error) {
    console.error('[authController] deleteUser error:', error);
    res.status(500).json({ error: '유저 삭제에 실패했습니다.' });
  }
}
