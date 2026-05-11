import pool from './database';
import { RowDataPacket } from 'mysql2';

// 테이블 생성 (CREATE TABLE IF NOT EXISTS - 기존 테이블은 건드리지 않음)
const createTableStatements = [
  // 1. departments (소속)
  `CREATE TABLE IF NOT EXISTS departments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 2. teams (팀) - belongs to a department
  `CREATE TABLE IF NOT EXISTS teams (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(20)  NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    department_id INT          NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 3. users - with password
  `CREATE TABLE IF NOT EXISTS users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL DEFAULT 'password123',
    display_name VARCHAR(100) NOT NULL,
    team_id      INT          NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    INDEX idx_users_team_id (team_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 4. reports
  `CREATE TABLE IF NOT EXISTS reports (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT       NOT NULL,
    team_id      INT       NOT NULL,
    report_date  DATE      NOT NULL,
    content_html LONGTEXT  NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reports_team_date_user (team_id, report_date, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    INDEX idx_reports_report_date (report_date),
    INDEX idx_reports_team_id (team_id),
    INDEX idx_reports_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 5. final_reports
  `CREATE TABLE IF NOT EXISTS final_reports (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    report_date  DATE      NOT NULL UNIQUE,
    content_html LONGTEXT  NOT NULL,
    team_summary JSON,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_final_reports_report_date (report_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 6. attachments
  `CREATE TABLE IF NOT EXISTS attachments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    report_id     INT          NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(255) NOT NULL,
    file_type     VARCHAR(100) NOT NULL,
    file_size     INT          NOT NULL,
    file_path     VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    INDEX idx_attachments_report_id (report_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 7. report_tags (태그)
  `CREATE TABLE IF NOT EXISTS report_tags (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    team_id       INT          NOT NULL,
    department_id INT          NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tag_name_team_dept (name, team_id, department_id),
    INDEX idx_report_tags_dept_team (department_id, team_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 8. report_tag_map (보고서-태그 매핑)
  `CREATE TABLE IF NOT EXISTS report_tag_map (
    report_id INT NOT NULL,
    tag_id    INT NOT NULL,
    PRIMARY KEY (report_id, tag_id),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES report_tags(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 9. meeting_notes (회의록)
  `CREATE TABLE IF NOT EXISTS meeting_notes (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    team_id       INT          NULL,
    department_id INT          NOT NULL,
    report_date   DATE         NOT NULL,
    content_html  LONGTEXT     NOT NULL,
    tag_signature VARCHAR(255) NOT NULL DEFAULT '',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_meeting_notes_date (report_date),
    INDEX idx_meeting_notes_dept (department_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 10. notices (공지)
  `CREATE TABLE IF NOT EXISTS notices (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(255) NOT NULL,
    content    LONGTEXT     NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notices_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 11. notice_reads (공지 읽음 기록)
  `CREATE TABLE IF NOT EXISTS notice_reads (
    user_id    INT NOT NULL,
    notice_id  INT NOT NULL,
    read_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notice_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 12. document_embeddings (RAG)
  `CREATE TABLE IF NOT EXISTS document_embeddings (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    report_id  INT      NOT NULL,
    chunk_text TEXT     NOT NULL,
    embedding  JSON     NOT NULL,
    metadata   JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    INDEX idx_document_embeddings_report_id (report_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// 컬럼 추가 마이그레이션 (기존 테이블에 새 컬럼 추가, 이미 존재하면 무시)
const migrations = [
  `ALTER TABLE teams ADD COLUMN department_id INT NULL AFTER name`,
  `ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'password123' AFTER username`,
  `ALTER TABLE reports ADD COLUMN department_id INT NULL AFTER team_id`,
  `ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER password`,
  `ALTER TABLE final_reports ADD COLUMN department_id INT NULL AFTER report_date`,
  `ALTER TABLE final_reports ADD COLUMN team_id INT NULL AFTER department_id`,
  `ALTER TABLE final_reports DROP INDEX report_date`,
  `ALTER TABLE final_reports ADD UNIQUE KEY uq_final_date_dept_team (report_date, department_id, team_id)`,
  `ALTER TABLE final_reports DROP INDEX uq_final_date_dept_team`,
  // 기존 중복 데이터 정리: 같은 date+dept에 여러 row가 있으면 가장 최신 1개만 남기고 삭제
  `DELETE f1 FROM final_reports f1
   INNER JOIN final_reports f2
   ON f1.report_date = f2.report_date AND f1.department_id = f2.department_id AND f1.id < f2.id`,
  `ALTER TABLE final_reports ADD UNIQUE KEY uq_final_date_dept (report_date, department_id)`,
  `ALTER TABLE departments ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#5c2d91'`,
  `ALTER TABLE teams ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#107c10'`,
  // reports의 department_id를 팀의 현재 소속으로 동기화
  `UPDATE reports r JOIN teams t ON r.team_id = t.id SET r.department_id = t.department_id WHERE r.department_id IS NULL OR r.department_id != t.department_id`,
  // final_reports에 AI 분석 결과 저장 컬럼 추가
  `ALTER TABLE final_reports ADD COLUMN analysis_html LONGTEXT NULL`,
  // final_reports에 회의록 저장 컬럼 추가
  `ALTER TABLE final_reports ADD COLUMN meeting_notes LONGTEXT NULL`,
  // 공유 토큰 컬럼 추가
  `ALTER TABLE final_reports ADD COLUMN share_token VARCHAR(64) NULL`,
  `ALTER TABLE meeting_notes ADD COLUMN share_token VARCHAR(64) NULL`,
  `ALTER TABLE final_reports ADD UNIQUE INDEX idx_share_token (share_token)`,
  // final_reports에 태그 시그니처 컬럼 추가 (태그별 별도 병합)
  `ALTER TABLE final_reports ADD COLUMN tag_signature VARCHAR(255) NOT NULL DEFAULT ''`,
  `ALTER TABLE final_reports DROP INDEX uq_final_date_dept`,
  `ALTER TABLE final_reports ADD UNIQUE KEY uq_final_date_dept_tag (report_date, department_id, tag_signature)`,
  // reports.team_id를 NULL 허용으로 변경 + FK를 ON DELETE SET NULL로 변경
  `ALTER TABLE reports MODIFY COLUMN team_id INT NULL`,
  `ALTER TABLE reports DROP FOREIGN KEY reports_ibfk_2`,
  `ALTER TABLE reports ADD CONSTRAINT reports_ibfk_2 FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL`,
];

// 시드 데이터
const seedStatements = [
  // 어드민 소속/팀
  `INSERT IGNORE INTO departments (code, name) VALUES ('admin', '어드민')`,
  `INSERT IGNORE INTO teams (code, name, department_id)
   SELECT 'admin', '어드민', id FROM departments WHERE code = 'admin'`,

  // 슈퍼어드민 계정
  `INSERT IGNORE INTO users (username, password, is_admin, display_name, team_id)
   SELECT 'admin', '1234', 1, '관리자', id FROM teams WHERE code = 'admin'`,
  `UPDATE users SET team_id = (SELECT id FROM teams WHERE code = 'admin') WHERE username = 'admin'`,
];

async function runMigrations(): Promise<void> {
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log(`[initDb] Migration applied: ${sql.substring(0, 60)}...`);
    } catch (err: any) {
      // ER_DUP_FIELDNAME(1060): 이미 컬럼이 존재하면 무시
      // ER_CANT_DROP_FIELD_OR_KEY(1091): 인덱스가 존재하지 않을 때 무시
      // ER_DUP_KEYNAME(1061): 이미 인덱스가 존재하면 무시
      if (err.errno === 1060 || err.errno === 1091 || err.errno === 1061 || err.errno === 1062) {
        continue;
      }
      throw err;
    }
  }
}

// team_summary를 ID 전용으로 정리 + content_html에서 문자열 이름 제거 (ID만 남김)
async function backfillTeamSummaryIds(): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, team_summary, department_id, content_html FROM final_reports WHERE team_summary IS NOT NULL`
    );
    for (const row of rows) {
      const summary = typeof row.team_summary === 'string'
        ? JSON.parse(row.team_summary)
        : row.team_summary;
      if (!summary) continue;

      let changed = false;

      // 1. team_summary에 ID 추가 + 이름 제거
      for (const [code, entry] of Object.entries(summary) as [string, any][]) {
        if (!entry.teamId) {
          const [teamRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, department_id FROM teams WHERE code = ?`, [code]
          );
          if (teamRows.length > 0) {
            entry.teamId = teamRows[0].id;
            entry.departmentId = teamRows[0].department_id || row.department_id;
            changed = true;
          }
        }
        // 이름 필드 제거 (ID만 남김)
        if (entry.teamName !== undefined) { delete entry.teamName; changed = true; }
        if (entry.departmentName !== undefined) { delete entry.departmentName; changed = true; }
      }

      // 2. content_html 정리: 기존 형태의 이름을 빈 텍스트로, data 속성 추가
      let html = row.content_html || '';
      const origHtml = html;

      // 2a. <section data-team="code"> → data-team-id 추가
      for (const [code, entry] of Object.entries(summary) as [string, any][]) {
        if (!entry.teamId) continue;
        // data-team="code" 있고 data-team-id 없으면 추가
        if (html.includes(`data-team="${code}"`) && !html.includes(`data-team-id="${entry.teamId}"`)) {
          html = html.replace(`data-team="${code}"`, `data-team-id="${entry.teamId}"`);
        }
        // data-team="code" data-team-id="N" → data-team-id="N"만 남기기
        html = html.replace(new RegExp(`data-team="${code}"\\s*data-team-id="${entry.teamId}"`, 'g'), `data-team-id="${entry.teamId}"`);
      }

      // 2b. <h3>이름</h3> 또는 <h3 data-team-id="N">이름</h3> → <h3 data-team-id="N"></h3>
      for (const [, entry] of Object.entries(summary) as [string, any][]) {
        if (!entry.teamId) continue;
        // 이미 data-team-id가 있는 h3: 텍스트 비우기
        html = html.replace(
          new RegExp(`(<h3\\s+data-team-id="${entry.teamId}">)[^<]*(<\\/h3>)`, 'g'),
          `$1$2`
        );
      }

      // 2c. 소속 td: <td>이름</td> 또는 <td data-dept-id="N">이름</td> → <td data-dept-id="N"></td>
      if (row.department_id) {
        // 이미 data-dept-id가 있으면 텍스트만 비우기
        html = html.replace(
          new RegExp(`(<td\\s+data-dept-id="${row.department_id}">)[^<]*(<\\/td>)`, 'g'),
          `$1$2`
        );
        // <span data-dept-id> 형태도 처리
        html = html.replace(
          new RegExp(`<span\\s+data-dept-id="${row.department_id}">[^<]*<\\/span>`, 'g'),
          ''
        );
        // data-dept-id가 없는 소속 td에 추가
        if (!html.includes('data-dept-id=')) {
          html = html.replace(
            /(<th>소속<\/th>\s*)<td>[^<]*?<\/td>/,
            `$1<td data-dept-id="${row.department_id}"></td>`
          );
        }
        // 혹시 <td><td 중복이 생겼으면 정리
        html = html.replace(/<td><td data-dept-id=/g, '<td data-dept-id=');
      }

      // 2d. 참여팀 td: data-teams-meta 추가 + 텍스트 비우기
      const teamIds = Object.values(summary).map((e: any) => e.teamId).filter(Boolean);
      if (teamIds.length > 0) {
        // 이미 data-teams-meta가 있으면 텍스트만 비우기
        html = html.replace(
          /(data-teams-meta="[^"]*">)[^<]*(<\/td>)/g,
          `$1$2`
        );
        // 없으면 추가
        if (!html.includes('data-teams-meta=')) {
          html = html.replace(
            /(<th>참여팀<\/th>\s*<td>)([^<]*?)(<\/td>)/,
            `<th>참여팀</th><td data-teams-meta="${teamIds.join(',')}"></td>`
          );
        }
      }

      if (changed || html !== origHtml) {
        await pool.query(
          `UPDATE final_reports SET team_summary = ?, content_html = ? WHERE id = ?`,
          [JSON.stringify(summary), html, row.id]
        );
        console.log(`[initDb] Migrated final_reports id=${row.id} to ID-only`);
      }
    }
  } catch (err) {
    console.error('[initDb] backfillTeamSummaryIds error:', err);
  }
}

export async function initDatabase(): Promise<void> {
  try {
    console.log('[initDb] Creating tables...');
    for (const sql of createTableStatements) {
      await pool.query(sql);
    }

    console.log('[initDb] Running migrations...');
    await runMigrations();

    console.log('[initDb] Seeding data...');
    for (const sql of seedStatements) {
      await pool.query(sql);
    }

    console.log('[initDb] Backfilling team summary IDs...');
    await backfillTeamSummaryIds();

    console.log('[initDb] Database initialization complete.');
  } catch (err) {
    console.error('[initDb] Database initialization failed:', err);
    throw err;
  }
}
