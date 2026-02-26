-- ============================================================
-- Meeting Management Agent - Database Schema
-- PostgreSQL DDL
-- Created: 2026-02-25
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector for RAG embeddings

-- ============================================================
-- 1. teams - 팀 정보
-- ============================================================
CREATE TABLE teams (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  teams         IS '팀 정보';
COMMENT ON COLUMN teams.code    IS '팀 코드 (ops, uiux, tech 등)';
COMMENT ON COLUMN teams.name    IS '팀 이름 (운영, UI/UX, 기술개발)';

-- ============================================================
-- 2. users - 사용자 정보
-- ============================================================
CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    team_id      INTEGER      NOT NULL REFERENCES teams(id),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_team_id ON users(team_id);

COMMENT ON TABLE  users              IS '사용자 정보';
COMMENT ON COLUMN users.username     IS '로그인 계정명';
COMMENT ON COLUMN users.display_name IS '표시 이름';
COMMENT ON COLUMN users.team_id      IS '소속 팀 FK';

-- ============================================================
-- 3. reports - 팀별 업무보고서
-- ============================================================
CREATE TABLE reports (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER   NOT NULL REFERENCES users(id),
    team_id      INTEGER   NOT NULL REFERENCES teams(id),
    report_date  DATE      NOT NULL,
    content_html TEXT      NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_reports_team_date_user UNIQUE (team_id, report_date, user_id)
);

CREATE INDEX idx_reports_report_date ON reports(report_date);
CREATE INDEX idx_reports_team_id     ON reports(team_id);
CREATE INDEX idx_reports_user_id     ON reports(user_id);

COMMENT ON TABLE  reports              IS '팀별 업무보고서';
COMMENT ON COLUMN reports.report_date  IS '보고 날짜';
COMMENT ON COLUMN reports.content_html IS 'HTML 형식 보고 내용';

-- ============================================================
-- 4. final_reports - 최종보고서 (병합된)
-- ============================================================
CREATE TABLE final_reports (
    id           SERIAL PRIMARY KEY,
    report_date  DATE      NOT NULL UNIQUE,
    content_html TEXT      NOT NULL,
    team_summary JSONB,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_final_reports_report_date ON final_reports(report_date);

COMMENT ON TABLE  final_reports              IS '최종 병합 보고서';
COMMENT ON COLUMN final_reports.report_date  IS '보고 날짜 (유니크)';
COMMENT ON COLUMN final_reports.content_html IS '병합된 HTML 콘텐츠';
COMMENT ON COLUMN final_reports.team_summary IS '팀별 요약 데이터 (JSON)';

-- ============================================================
-- 5. attachments - 첨부파일
-- ============================================================
CREATE TABLE attachments (
    id            SERIAL PRIMARY KEY,
    report_id     INTEGER      NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(255) NOT NULL,
    file_type     VARCHAR(100) NOT NULL,
    file_size     INTEGER      NOT NULL,
    file_path     VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_report_id ON attachments(report_id);

COMMENT ON TABLE  attachments               IS '보고서 첨부파일';
COMMENT ON COLUMN attachments.original_name IS '원본 파일명';
COMMENT ON COLUMN attachments.stored_name   IS '저장된 파일명 (UUID 등)';
COMMENT ON COLUMN attachments.file_type     IS 'MIME 타입 (application/pdf, image/png 등)';
COMMENT ON COLUMN attachments.file_size     IS '파일 크기 (bytes)';
COMMENT ON COLUMN attachments.file_path     IS '파일 저장 경로';

-- ============================================================
-- 6. document_embeddings - RAG용 벡터 테이블
-- ============================================================
CREATE TABLE document_embeddings (
    id         SERIAL PRIMARY KEY,
    report_id  INTEGER        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    chunk_text TEXT           NOT NULL,
    embedding  vector(1536)   NOT NULL,
    metadata   JSONB,
    created_at TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_embeddings_report_id ON document_embeddings(report_id);

-- HNSW 벡터 인덱스: cosine distance 기반 유사도 검색
-- ef_construction, m 파라미터는 데이터 규모에 따라 조정
CREATE INDEX idx_document_embeddings_vector ON document_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE  document_embeddings            IS 'RAG용 문서 임베딩 벡터';
COMMENT ON COLUMN document_embeddings.chunk_text IS '텍스트 청크';
COMMENT ON COLUMN document_embeddings.embedding  IS 'OpenAI text-embedding-ada-002 (1536차원) 벡터';
COMMENT ON COLUMN document_embeddings.metadata   IS '청크 메타데이터 (팀, 날짜, 섹션 등)';

-- ============================================================
-- Trigger: reports.updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_final_reports_updated_at
    BEFORE UPDATE ON final_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
