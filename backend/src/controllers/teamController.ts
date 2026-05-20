import { Request, Response } from 'express';
import pool from '../config/database';
export async function getTeams(req: Request, res: Response): Promise<void> {
  try {
    const departmentId = req.query.department_id;
    if (departmentId) {
      const { rows } = await pool.query('SELECT * FROM teams WHERE department_id = $1 ORDER BY id', [departmentId]);
      res.json(rows);
    } else {
      const { rows } = await pool.query('SELECT * FROM teams ORDER BY id');
      res.json(rows);
    }
  } catch (error) {
    console.error('[teamController] getTeams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

export async function getDepartments(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query('SELECT * FROM departments ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('[teamController] getDepartments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

export async function getTeamsWithDepartment(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT t.id, t.name, t.color as team_color, t.department_id, d.name as department_name, d.color as department_color
       FROM teams t
       JOIN departments d ON t.department_id = d.id
       ORDER BY d.name, t.name`);
    res.json(rows);
  } catch (error) {
    console.error('[teamController] getTeamsWithDepartment error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

export async function createTeam(req: Request, res: Response): Promise<void> {
  try {
    const { department_name, team_name, department_color, team_color } = req.body;

    if (!department_name || !team_name) {
      res.status(400).json({ error: '소속과 팀 이름을 입력해주세요.' });
      return;
    }

    const deptColor = department_color || '#5c2d91';
    const tColor = team_color || '#107c10';

    // 소속이 없으면 새로 생성
    let departmentId: number;
    const { rows: existingDepts } = await pool.query('SELECT id FROM departments WHERE name = $1', [department_name]);
    if (existingDepts.length > 0) {
      departmentId = existingDepts[0].id;
      // 색상 업데이트
      await pool.query('UPDATE departments SET color = $1 WHERE id = $2', [deptColor, departmentId]);
    } else {
      const code = 'dept_' + Date.now();
      const deptResult = await pool.query('INSERT INTO departments (code, name, color) VALUES ($1, $2, $3) RETURNING id', [code, department_name, deptColor]);
      departmentId = deptResult.rows[0].id;
    }

    // 같은 소속에 같은 팀이름 중복 체크
    const { rows: existingTeams } = await pool.query('SELECT id FROM teams WHERE department_id = $1 AND name = $2', [departmentId, team_name]);
    if (existingTeams.length > 0) {
      res.status(409).json({ error: '이미 존재하는 팀입니다.' });
      return;
    }

    const teamCode = 'team_' + Date.now();
    const result = await pool.query('INSERT INTO teams (code, name, department_id, color) VALUES ($1, $2, $3, $4) RETURNING id', [teamCode, team_name, departmentId, tColor]);

    res.status(201).json({
      id: result.rows[0].id,
      name: team_name,
      team_color: tColor,
      department_id: departmentId,
      department_name,
      department_color: deptColor,
    });
  } catch (error) {
    console.error('[teamController] createTeam error:', error);
    res.status(500).json({ error: '팀 추가에 실패했습니다.' });
  }
}

export async function updateTeam(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: '유효하지 않은 팀 ID입니다.' });
      return;
    }

    const { department_name, team_name, department_color, team_color } = req.body;
    if (!department_name || !team_name) {
      res.status(400).json({ error: '소속과 팀 이름을 입력해주세요.' });
      return;
    }

    const deptColor = department_color || '#5c2d91';
    const tColor = team_color || '#107c10';

    // 소속이 없으면 새로 생성
    let departmentId: number;
    const { rows: existingDepts } = await pool.query('SELECT id FROM departments WHERE name = $1', [department_name]);
    if (existingDepts.length > 0) {
      departmentId = existingDepts[0].id;
      await pool.query('UPDATE departments SET color = $1 WHERE id = $2', [deptColor, departmentId]);
    } else {
      const code = 'dept_' + Date.now();
      const deptResult = await pool.query('INSERT INTO departments (code, name, color) VALUES ($1, $2, $3) RETURNING id', [code, department_name, deptColor]);
      departmentId = deptResult.rows[0].id;
    }

    await pool.query('UPDATE teams SET name = $1, department_id = $2, color = $3 WHERE id = $4', [team_name, departmentId, tColor, id]);

    res.json({
      id,
      name: team_name,
      team_color: tColor,
      department_id: departmentId,
      department_name,
      department_color: deptColor,
    });
  } catch (error) {
    console.error('[teamController] updateTeam error:', error);
    res.status(500).json({ error: '팀 수정에 실패했습니다.' });
  }
}

export async function deleteTeam(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: '유효하지 않은 팀 ID입니다.' });
      return;
    }

    // 팀에 소속된 유저가 있는지 확인
    const { rows: users } = await pool.query('SELECT id FROM users WHERE team_id = $1', [id]);
    if (users.length > 0) {
      res.status(400).json({ error: `해당 팀에 ${users.length}명의 유저가 있어 삭제할 수 없습니다.` });
      return;
    }

    // 삭제 전 사업부 ID 기록
    const { rows: teamRows } = await pool.query('SELECT department_id FROM teams WHERE id = $1', [id]);
    const deptId = teamRows[0]?.department_id;

    // 관련 보고서의 team_id NULL 처리 후 삭제
    await pool.query('UPDATE reports SET team_id = NULL WHERE team_id = $1', [id]);
    const result = await pool.query('DELETE FROM teams WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
      return;
    }

    // 해당 사업부에 다른 팀이 없으면 사업부도 삭제
    if (deptId) {
      const { rows: remaining } = await pool.query('SELECT id FROM teams WHERE department_id = $1 LIMIT 1', [deptId]);
      if (remaining.length === 0) {
        await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
        console.log(`[teamController] Orphan department ${deptId} deleted`);
      }
    }

    res.json({ message: '팀이 삭제되었습니다.' });
  } catch (error) {
    console.error('[teamController] deleteTeam error:', error);
    res.status(500).json({ error: '팀 삭제에 실패했습니다.' });
  }
}
