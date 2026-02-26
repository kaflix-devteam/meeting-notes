# Meeting Agent - 회의관리 에이전트

RAG + LangGraph 기반의 업무보고서 관리 및 자동 병합 시스템

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vue.js 3, TypeScript, Vite, Pinia, Tiptap, v-calendar |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, pgvector |
| AI/ML | Claude API (@anthropic-ai/sdk), LangGraph, RAG |
| Design | Windows Metro Design Theme |

## 프로젝트 구조

```
agent-meeting/
├── database/
│   ├── schema.sql                 # DB 스키마 (6개 테이블)
│   └── seed.sql                   # 초기 데이터 (3팀 + 테스트 사용자)
│
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Express 서버 (포트 3000)
│   │   ├── config/database.ts     # PostgreSQL 연결
│   │   ├── routes/                # API 라우트
│   │   ├── controllers/           # 요청 핸들러
│   │   ├── services/
│   │   │   ├── reportService.ts   # 보고서 CRUD
│   │   │   ├── mergeService.ts    # 보고서 병합
│   │   │   ├── aiService.ts       # Claude API 연동
│   │   │   ├── ragService.ts      # RAG 파이프라인
│   │   │   └── workflow.ts        # LangGraph 워크플로우
│   │   ├── models/types.ts        # 타입 정의
│   │   └── middleware/upload.ts   # 파일 업로드 (Multer)
│   ├── .env                       # 환경변수
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── views/                 # 6개 페이지
│   │   ├── components/            # 6개 재사용 컴포넌트
│   │   ├── styles/metro.css       # Metro 디자인 시스템
│   │   ├── stores/reportStore.ts  # Pinia 상태관리
│   │   ├── api/index.ts           # API 클라이언트
│   │   └── router/index.ts        # Vue Router
│   ├── package.json
│   └── vite.config.ts
│
└── team.md                        # 팀 구성 문서
```

## 데이터베이스 스키마

| 테이블 | 설명 |
|--------|------|
| `teams` | 팀 정보 (운영, UI/UX, 기술개발) |
| `users` | 사용자 정보 |
| `reports` | 팀별 업무보고서 (HTML 콘텐츠) |
| `final_reports` | 최종 병합 보고서 (팀별 구분 HTML + JSONB 요약) |
| `attachments` | 첨부파일 메타데이터 |
| `document_embeddings` | RAG용 벡터 임베딩 (pgvector, 1536차원) |

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/teams` | 팀 목록 조회 |
| POST | `/api/reports` | 보고서 저장 (자동 병합 트리거) |
| GET | `/api/reports` | 내 보고서 목록 |
| GET | `/api/reports/:id` | 보고서 상세 (첨부파일 포함) |
| PUT | `/api/reports/:id` | 보고서 수정 (최종보고서 재병합) |
| POST | `/api/reports/:id/attachments` | 첨부파일 업로드 |
| GET | `/api/final-reports` | 최종보고서 목록 |
| GET | `/api/final-reports/:id` | 최종보고서 상세 |

## 페이지 구성

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | HomePage | Metro 타일 버튼 3개 (회의록, 보고서 작성, 내 보고서) |
| `/reports/new` | ReportCreatePage | 팀 선택 + 에디터 + 달력 + 첨부파일 + 미리보기 |
| `/meetings` | MeetingListPage | 최종보고서 목록 (날짜별) |
| `/meetings/:id` | MeetingDetailPage | 최종보고서 상세 (팀별 섹션 구분) |
| `/my-reports` | MyReportsPage | 내가 작성한 보고서 목록 |
| `/reports/:id/edit` | ReportEditPage | 보고서 편집 (저장 시 최종보고서 반영) |

## 핵심 기능

### 보고서 자동 병합 (LangGraph 워크플로우)

보고서 저장 시 동일 날짜에 다른 팀 보고서가 존재하면 LangGraph 5단계 워크플로우가 자동 실행:

```
collectReports → groupByTeam → analyzeReports → generateFinalReport → saveFinalReport
```

1. 해당 날짜의 모든 팀 보고서 수집
2. 팀별로 그룹핑
3. Claude API로 각 팀 보고서 분석 (의견/제안 추출)
4. 팀별 섹션이 구분된 최종보고서 HTML 생성
5. `final_reports` 테이블에 UPSERT

### RAG 파이프라인

- 보고서 저장 시 텍스트를 청크로 분할하여 임베딩 생성
- pgvector HNSW 인덱스로 코사인 유사도 검색
- 첨부파일(PDF, 이미지, TXT) 텍스트 추출 지원

## 실행 방법

### 1. 데이터베이스 초기화

```bash
psql -h 172.10.65.80 -p 30432 -U pgadmin -d agent_meeting -f database/schema.sql
psql -h 172.10.65.80 -p 30432 -U pgadmin -d agent_meeting -f database/seed.sql
```

### 2. 백엔드 실행

```bash
cd backend
npm install
npm run dev        # 개발 모드 (ts-node)
# 또는
npm run build && npm start  # 프로덕션
```

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev        # 개발 서버 (Vite)
# 또는
npm run build      # 프로덕션 빌드 → dist/
```

## 환경변수 (backend/.env)

```env
DB_HOST=172.10.65.80
DB_PORT=30432
DB_USER=pgadmin
DB_PASSWORD=<password>
DB_NAME=agent_meeting
CLAUDE_API_KEY=<claude-api-key>
PORT=3000
```
