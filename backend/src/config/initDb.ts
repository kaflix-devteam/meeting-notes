import pool from './database';

const initSql = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. teams
CREATE TABLE IF NOT EXISTS teams (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 2. users
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    team_id      INTEGER      NOT NULL REFERENCES teams(id),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

-- 3. reports
CREATE TABLE IF NOT EXISTS reports (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER   NOT NULL REFERENCES users(id),
    team_id      INTEGER   NOT NULL REFERENCES teams(id),
    report_date  DATE      NOT NULL,
    content_html TEXT      NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reports_team_date_user UNIQUE (team_id, report_date, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_team_id     ON reports(team_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id     ON reports(user_id);

-- 4. final_reports
CREATE TABLE IF NOT EXISTS final_reports (
    id           SERIAL PRIMARY KEY,
    report_date  DATE      NOT NULL UNIQUE,
    content_html TEXT      NOT NULL,
    team_summary JSONB,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_final_reports_report_date ON final_reports(report_date);

-- 5. attachments
CREATE TABLE IF NOT EXISTS attachments (
    id            SERIAL PRIMARY KEY,
    report_id     INTEGER      NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(255) NOT NULL,
    file_type     VARCHAR(100) NOT NULL,
    file_size     INTEGER      NOT NULL,
    file_path     VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_report_id ON attachments(report_id);

-- 6. document_embeddings (RAG)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id         SERIAL PRIMARY KEY,
    report_id  INTEGER        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    chunk_text TEXT           NOT NULL,
    embedding  vector(1536)   NOT NULL,
    metadata   JSONB,
    created_at TIMESTAMP      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_report_id ON document_embeddings(report_id);

-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (DROP + CREATE to avoid duplicate errors)
DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_final_reports_updated_at ON final_reports;
CREATE TRIGGER trg_final_reports_updated_at
    BEFORE UPDATE ON final_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed: 기본 팀 데이터
INSERT INTO teams (code, name) VALUES
    ('ops',  '운영'),
    ('uiux', 'UI/UX'),
    ('tech', '기술개발')
ON CONFLICT (code) DO NOTHING;

-- Seed: 기본 사용자 데이터
INSERT INTO users (username, display_name, team_id) VALUES
    ('kim.ops',   '김운영',   (SELECT id FROM teams WHERE code = 'ops')),
    ('lee.ops',   '이관리',   (SELECT id FROM teams WHERE code = 'ops')),
    ('park.uiux', '박디자인', (SELECT id FROM teams WHERE code = 'uiux')),
    ('choi.uiux', '최유엑스', (SELECT id FROM teams WHERE code = 'uiux')),
    ('jung.tech', '정개발',   (SELECT id FROM teams WHERE code = 'tech')),
    ('han.tech',  '한기술',   (SELECT id FROM teams WHERE code = 'tech'))
ON CONFLICT (username) DO NOTHING;
`;

export async function initDatabase(): Promise<void> {
  try {
    console.log('[initDb] Initializing database tables...');
    await pool.query(initSql);
    console.log('[initDb] Database initialization complete.');
  } catch (err) {
    console.error('[initDb] Database initialization failed:', err);
    throw err;
  }
}
