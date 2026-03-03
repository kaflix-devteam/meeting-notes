import pool from './database';

const initStatements = [
  // 1. teams
  `CREATE TABLE IF NOT EXISTS teams (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 2. users
  `CREATE TABLE IF NOT EXISTS users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    team_id      INT          NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    INDEX idx_users_team_id (team_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 3. reports
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

  // 4. final_reports
  `CREATE TABLE IF NOT EXISTS final_reports (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    report_date  DATE      NOT NULL UNIQUE,
    content_html LONGTEXT  NOT NULL,
    team_summary JSON,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_final_reports_report_date (report_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 5. attachments
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

  // 6. document_embeddings (RAG) - store as JSON since MySQL has no vector type
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

  // Seed: 기본 팀 데이터
  `INSERT IGNORE INTO teams (code, name) VALUES ('ops', '운영')`,
  `INSERT IGNORE INTO teams (code, name) VALUES ('uiux', 'UI/UX')`,
  `INSERT IGNORE INTO teams (code, name) VALUES ('tech', '기술개발')`,

  // Seed: 기본 사용자 데이터
  `INSERT IGNORE INTO users (username, display_name, team_id)
   SELECT 'kim.ops', '김운영', id FROM teams WHERE code = 'ops'`,
  `INSERT IGNORE INTO users (username, display_name, team_id)
   SELECT 'lee.ops', '이관리', id FROM teams WHERE code = 'ops'`,
  `INSERT IGNORE INTO users (username, display_name, team_id)
   SELECT 'park.uiux', '박디자인', id FROM teams WHERE code = 'uiux'`,
  `INSERT IGNORE INTO users (username, display_name, team_id)
   SELECT 'choi.uiux', '최유엑스', id FROM teams WHERE code = 'uiux'`,
  `INSERT IGNORE INTO users (username, display_name, team_id)
   SELECT 'jung.tech', '정개발', id FROM teams WHERE code = 'tech'`,
  `INSERT IGNORE INTO users (username, display_name, team_id)
   SELECT 'han.tech', '한기술', id FROM teams WHERE code = 'tech'`,
];

export async function initDatabase(): Promise<void> {
  try {
    console.log('[initDb] Initializing database tables...');
    for (const sql of initStatements) {
      await pool.query(sql);
    }
    console.log('[initDb] Database initialization complete.');
  } catch (err) {
    console.error('[initDb] Database initialization failed:', err);
    throw err;
  }
}
