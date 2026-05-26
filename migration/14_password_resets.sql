-- 14_password_resets.sql — 비밀번호 찾기 기능
-- 1) users 테이블에 email 컬럼 추가 (기존 사용자는 NULL 허용)
-- 2) password_resets 토큰 테이블 신규 생성
BEGIN;

-- 1) users.email
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON COLUMN users.email IS '비밀번호 찾기 / 알림 수신용 이메일';

-- 2) password_resets
DROP TABLE IF EXISTS password_resets CASCADE;
CREATE TABLE password_resets (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(128) NOT NULL UNIQUE,
    expires_at  TIMESTAMP    NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_token   ON password_resets(token);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);

COMMENT ON TABLE  password_resets             IS '비밀번호 재설정 토큰';
COMMENT ON COLUMN password_resets.token       IS 'URL 에 포함되는 1회용 토큰';
COMMENT ON COLUMN password_resets.expires_at  IS '토큰 만료 시각 (기본 1시간)';
COMMENT ON COLUMN password_resets.used_at     IS '실제로 사용된 시각 (NULL = 미사용)';

COMMIT;
