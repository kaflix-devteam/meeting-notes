import pool from './database';

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

  // 7. document_embeddings (RAG)
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

    console.log('[initDb] Database initialization complete.');
  } catch (err) {
    console.error('[initDb] Database initialization failed:', err);
    throw err;
  }
}
