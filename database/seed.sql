-- ============================================================
-- Meeting Management Agent - Seed Data
-- 초기 데이터: 3개 팀 + 테스트 사용자
-- ============================================================

-- 1. 팀 데이터
INSERT INTO teams (code, name) VALUES
    ('ops',  '운영'),
    ('uiux', 'UI/UX'),
    ('tech', '기술개발')
ON CONFLICT (code) DO NOTHING;

-- 2. 테스트 사용자 데이터
INSERT INTO users (username, display_name, team_id) VALUES
    ('kim.ops',      '김운영', (SELECT id FROM teams WHERE code = 'ops')),
    ('lee.ops',      '이관리', (SELECT id FROM teams WHERE code = 'ops')),
    ('park.uiux',    '박디자인', (SELECT id FROM teams WHERE code = 'uiux')),
    ('choi.uiux',    '최유엑스', (SELECT id FROM teams WHERE code = 'uiux')),
    ('jung.tech',    '정개발', (SELECT id FROM teams WHERE code = 'tech')),
    ('han.tech',     '한기술', (SELECT id FROM teams WHERE code = 'tech'))
ON CONFLICT (username) DO NOTHING;

-- 3. 테스트 보고서 데이터
INSERT INTO reports (user_id, team_id, report_date, content_html) VALUES
    (
        (SELECT id FROM users WHERE username = 'kim.ops'),
        (SELECT id FROM teams WHERE code = 'ops'),
        '2026-02-25',
        '<h2>운영팀 업무보고</h2><ul><li>서버 모니터링 대시보드 점검 완료</li><li>주간 운영 리포트 작성</li><li>장애 대응 프로세스 업데이트</li></ul>'
    ),
    (
        (SELECT id FROM users WHERE username = 'park.uiux'),
        (SELECT id FROM teams WHERE code = 'uiux'),
        '2026-02-25',
        '<h2>UI/UX팀 업무보고</h2><ul><li>보고서 관리 화면 와이어프레임 완성</li><li>디자인 시스템 컴포넌트 업데이트</li><li>사용성 테스트 결과 분석</li></ul>'
    ),
    (
        (SELECT id FROM users WHERE username = 'jung.tech'),
        (SELECT id FROM teams WHERE code = 'tech'),
        '2026-02-25',
        '<h2>기술개발팀 업무보고</h2><ul><li>RAG 파이프라인 프로토타입 구현</li><li>PostgreSQL pgvector 인덱스 성능 테스트</li><li>API 엔드포인트 설계 완료</li></ul>'
    )
ON CONFLICT (team_id, report_date, user_id) DO NOTHING;
