const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ size: 'A4', margin: 50 });
const output = fs.createWriteStream(path.join(__dirname, '..', '보고또보고서_기능소개.pdf'));
doc.pipe(output);

// Register Korean font
const fontPath = '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc';
const fontBoldPath = '/usr/share/fonts/noto/NotoSansCJK-Bold.ttc';
let hasKoreanFont = false;

try {
  if (fs.existsSync(fontPath)) {
    doc.registerFont('Korean', fontPath);
    doc.registerFont('KoreanBold', fontBoldPath || fontPath);
    hasKoreanFont = true;
  }
} catch (e) {
  console.log('Korean font not available locally, using default');
}

const font = hasKoreanFont ? 'Korean' : 'Helvetica';
const fontBold = hasKoreanFont ? 'KoreanBold' : 'Helvetica-Bold';

const BLUE = '#0078D4';
const DARK = '#333333';
const GRAY = '#666666';
const LIGHT_BG = '#F5F5F5';

function addTitle(text, size = 24) {
  doc.font(fontBold).fontSize(size).fillColor(BLUE).text(text);
  doc.moveDown(0.3);
  // Blue line
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BLUE).lineWidth(2).stroke();
  doc.moveDown(0.8);
}

function addSubTitle(text, size = 16) {
  doc.font(fontBold).fontSize(size).fillColor(DARK).text(text);
  doc.moveDown(0.3);
}

function addBody(text, size = 11) {
  doc.font(font).fontSize(size).fillColor(DARK).text(text, { lineGap: 4 });
  doc.moveDown(0.3);
}

function addBullet(text, indent = 70) {
  const y = doc.y;
  doc.font(font).fontSize(11).fillColor(DARK);
  doc.text('•', indent - 15, y);
  doc.text(text, indent, y, { width: 545 - indent, lineGap: 3 });
  doc.moveDown(0.2);
}

function addScreenshot(filename, width = 480) {
  const filepath = path.join(__dirname, filename);
  if (!fs.existsSync(filepath)) {
    addBody(`[Screenshot: ${filename} - not found]`);
    return;
  }

  const imgWidth = width;
  const x = (595 - imgWidth) / 2; // center

  // Check if we need a new page
  if (doc.y > 500) {
    doc.addPage();
  }

  // Add border
  doc.save();
  doc.roundedRect(x - 2, doc.y - 2, imgWidth + 4, 1, 3).strokeColor('#CCCCCC').lineWidth(1).stroke();
  doc.restore();

  doc.image(filepath, x, doc.y, { width: imgWidth });
  doc.moveDown(1);
}

function addPageBreak() {
  doc.addPage();
}

// ============================================================
// Cover Page
// ============================================================
doc.moveDown(6);
doc.font(fontBold).fontSize(36).fillColor(BLUE).text('보고또보고서', { align: 'center' });
doc.moveDown(0.5);
doc.font(font).fontSize(16).fillColor(GRAY).text('주간 업무보고서 관리 시스템', { align: 'center' });
doc.moveDown(1);
doc.font(font).fontSize(14).fillColor(GRAY).text('기능 소개서', { align: 'center' });
doc.moveDown(3);

// Blue line
doc.moveTo(150, doc.y).lineTo(445, doc.y).strokeColor(BLUE).lineWidth(3).stroke();
doc.moveDown(1.5);

doc.font(font).fontSize(12).fillColor(DARK).text('Version 1.0', { align: 'center' });
doc.moveDown(0.3);
doc.text('2026-03-09', { align: 'center' });
doc.moveDown(3);

// Tech stack summary
doc.font(font).fontSize(10).fillColor(GRAY);
doc.text('Frontend: Vue 3 + TypeScript  |  Backend: Express + Node.js  |  DB: MySQL  |  AI: Claude API', { align: 'center' });
doc.text('Design: Windows Metro Theme  |  Deploy: Kubernetes (k3d)', { align: 'center' });

// ============================================================
// Page 2: Overview
// ============================================================
addPageBreak();
addTitle('시스템 개요', 22);

addBody('보고또보고서는 팀별 주간 업무보고서를 효율적으로 작성, 관리, 통합하는 웹 기반 시스템입니다.');
doc.moveDown(0.3);

addSubTitle('주요 특징');
addBullet('리치 텍스트 에디터를 통한 직관적 보고서 작성');
addBullet('AI 기반 보고서 다듬기 및 문체 통일 기능');
addBullet('여러 팀의 개별 보고서를 자동 병합하여 최종보고서 생성');
addBullet('이전 주 보고서 비교 참조 기능');
addBullet('사업부/팀 기반 조직 관리');
addBullet('관리자 전용 사용자/팀 관리 기능');
addBullet('Windows Metro 디자인 테마 적용');
doc.moveDown(0.5);

addSubTitle('시스템 구성');
addBullet('Frontend: Vue 3 + TypeScript + Pinia + Vue Router');
addBullet('Backend: Express + TypeScript + mysql2');
addBullet('Database: MySQL (사용자, 팀, 보고서, 최종보고서, 첨부파일)');
addBullet('AI Engine: Claude API (Anthropic) - 보고서 다듬기, 양식 표준화, 병합');
addBullet('Deployment: Kubernetes (k3d cluster)');
doc.moveDown(0.5);

addSubTitle('사용자 권한');
addBullet('일반 사용자: 보고서 작성/수정/삭제, 최종보고서 조회');
addBullet('관리자: 사용자 관리, 팀 관리, 전체 보고서 관리');

// ============================================================
// Page 3: Login
// ============================================================
addPageBreak();
addTitle('1. 로그인 페이지', 20);

addBody('사용자 인증을 위한 로그인 화면입니다.');
doc.moveDown(0.3);

addScreenshot('01_login.png', 400);

addSubTitle('기능 설명');
addBullet('아이디/패스워드 입력을 통한 사용자 인증');
addBullet('로그인 성공 시 내 보고서 목록 페이지로 자동 이동');
addBullet('회원가입 페이지 연결 링크 제공');
addBullet('인증 정보는 브라우저 localStorage에 저장되어 세션 유지');
addBullet('로그인하지 않은 사용자는 로그인 페이지로 자동 리다이렉트');

// ============================================================
// Page 4: My Reports
// ============================================================
addPageBreak();
addTitle('2. 내 보고서 (My Reports)', 20);

addBody('로그인한 사용자의 모든 보고서를 날짜순으로 조회하는 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('02_my_reports.png', 480);

addSubTitle('기능 설명');
addBullet('내가 작성한 모든 보고서를 최신순으로 표시');
addBullet('보고서 날짜, 소속 사업부/팀 배지, 본문 미리보기 표시');
addBullet('카드를 클릭하면 보고서 편집 페이지로 이동');
addBullet('삭제 버튼(빨간색)으로 보고서 즉시 삭제 가능');
addBullet('관리자(is_admin)인 경우 전체 사용자의 보고서도 조회 가능');

// ============================================================
// Page 5: New Report
// ============================================================
addPageBreak();
addTitle('3. 새로 작성하기 (New Report)', 20);

addBody('새로운 주간 업무보고서를 작성하는 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('03_report_create.png', 480);

addSubTitle('기능 설명');
addBullet('사업부/팀 선택: 상단 배지를 클릭하면 드롭다운으로 사업부와 팀 변경 가능');
addBullet('날짜 선택: 보고서 기준 날짜 설정 (기본값: 오늘)');
addBullet('리치 텍스트 에디터: B(굵게), I(기울임), S(취소선), H2/H3(제목), UL/OL(목록), Quote(인용), HR(구분선) 지원');
addBullet('이전 주 보고서 비교: 우측에 이전 주(7일 전) 보고서를 자동으로 표시하여 참조 가능');
addBullet('첨부파일 업로드: PDF, JPG, PNG, TXT 파일 첨부 가능');
doc.moveDown(0.3);

addSubTitle('하단 버튼');
addBullet('Preview: 작성 내용을 HTML 미리보기로 확인');
addBullet('1. Save: 보고서 저장 (처음 저장 시 생성, 이후 수정). 저장 후 페이지에서 머무름');
addBullet('2. AI 다듬기: Claude AI가 보고서 문체를 다듬고, 하위 항목(ㄴ)을 중첩 리스트로 정리');
addBullet('3. 최종보고서에 병합: 해당 날짜의 모든 팀 보고서를 통합하여 최종보고서 생성');

// ============================================================
// Page 6: Meetings List
// ============================================================
addPageBreak();
addTitle('4. 최종 보고서 목록 (Meetings)', 20);

addBody('날짜별로 병합된 최종보고서 목록을 조회하는 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('04_meetings.png', 480);

addSubTitle('기능 설명');
addBullet('날짜별 최종보고서를 카드 형태로 표시');
addBullet('각 카드에는 해당 날짜에 참여한 사업부/팀 배지가 표시됨');
addBullet('카드를 클릭하면 최종보고서 상세 페이지로 이동');
addBullet('최종보고서는 개별 보고서 저장/병합 시 자동 생성됨');

// ============================================================
// Page 7: Meeting Detail
// ============================================================
addPageBreak();
addTitle('5. 최종보고서 상세 (Meeting Detail)', 20);

addBody('병합된 최종보고서의 상세 내용을 확인하는 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('05_meeting_detail.png', 350);

doc.moveDown(0.3);
addSubTitle('기능 설명');
addBullet('보고서 메타 정보: 보고일자, 사업부, 작성팀, 작성인원 수 표시');
addBullet('팀별 섹션: 각 팀의 보고서가 팀 이름 헤더와 함께 구분되어 표시');
addBullet('통일된 양식: AI가 각 보고서를 주요 업무, 진행 현황, 이슈 및 건의, 차주 계획 섹션으로 표준화');
addBullet('이전 주 비교: Current/Previous 탭으로 이전 주 보고서와 나란히 비교 가능');
addBullet('AI 요약: 최종보고서 하단에 AI가 생성한 전체 요약 표시');
addBullet('삭제 기능: 관리자가 최종보고서를 삭제할 수 있는 버튼 제공');

// ============================================================
// Page 8: User Management
// ============================================================
addPageBreak();
addTitle('6. 사용자 관리 (Admin)', 20);

addBody('관리자 전용 사용자 관리 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('06_user_management.png', 480);

addSubTitle('기능 설명');
addBullet('전체 사용자 목록을 테이블 형태로 표시');
addBullet('사용자별 ID, 아이디, 표시명, 역할(ADMIN 배지), 소속 사업부/팀 확인');
addBullet('사용자별 편집(파란색) / 삭제(빨간색) 버튼 제공');
addBullet('관리자 권한(is_admin) 사용자만 접근 가능');
addBullet('사용자의 소속 팀 변경 가능');

// ============================================================
// Page 9: Team Management
// ============================================================
addPageBreak();
addTitle('7. 팀 관리 (Admin)', 20);

addBody('관리자 전용 팀 관리 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('07_team_management.png', 480);

addSubTitle('기능 설명');
addBullet('전체 팀 목록을 테이블 형태로 표시');
addBullet('팀별 ID, 팀 코드(색상 배지), 팀명, 소속 사업부(색상 배지) 확인');
addBullet('새 사업부 추가: 사업부명과 색상을 지정하여 새 사업부 생성');
addBullet('새 팀 추가: 팀명, 색상, 소속 사업부를 지정하여 새 팀 생성');
addBullet('팀별 편집(파란색) / 삭제(빨간색) 버튼 제공');
addBullet('사업부-팀 계층 구조로 조직 관리');

// ============================================================
// Page 10: Signup
// ============================================================
addPageBreak();
addTitle('8. 회원가입 (Signup)', 20);

addBody('새로운 사용자가 계정을 등록하는 페이지입니다.');
doc.moveDown(0.3);

addScreenshot('08_signup.png', 400);

addSubTitle('기능 설명');
addBullet('아이디, 패스워드, 표시명(이름) 입력');
addBullet('소속 사업부 선택 드롭다운');
addBullet('소속 팀 선택 드롭다운 (사업부 선택에 따라 필터링)');
addBullet('가입 완료 시 자동으로 로그인 페이지로 이동');
addBullet('로그인 페이지로 돌아가기 링크 제공');

// ============================================================
// Page 11: AI Features
// ============================================================
addPageBreak();
addTitle('AI 기능 상세', 22);

addSubTitle('1. AI 다듬기 (Polish)');
addBody('Claude AI를 활용하여 보고서의 문체와 형식을 자동으로 다듬어줍니다.');
addBullet('"ㄴ"으로 시작하는 항목을 자동으로 상위 항목의 하위 목록으로 변환');
addBullet('불필요한 문장 정리 및 간결화');
addBullet('일관된 문체로 통일');
addBullet('처리 중 오버레이에 진행 상황 표시');
doc.moveDown(0.5);

addSubTitle('2. 최종보고서 병합 (Merge)');
addBody('해당 날짜에 작성된 모든 팀의 보고서를 자동으로 통합합니다.');
addBullet('각 개별 보고서를 AI가 표준 양식으로 변환 (주요 업무/진행 현황/이슈/차주 계획)');
addBullet('팀별로 구분된 통합 보고서 자동 생성');
addBullet('보고서 메타 정보(보고일자, 사업부, 팀, 인원수) 자동 집계');
addBullet('사업부별로 자동 분류하여 별도 최종보고서 생성');
addBullet('병합 중 오버레이에 "최종보고서 병합 중" 상태 표시');
doc.moveDown(0.5);

addSubTitle('3. 이전 주 비교');
addBody('보고서 작성 및 열람 시 이전 주(7일 전) 보고서를 자동으로 불러와 비교할 수 있습니다.');
addBullet('작성 페이지: 에디터 우측에 이전 주 내용 표시');
addBullet('최종보고서: Current/Previous 탭으로 전환하여 비교');

// ============================================================
// Final page
// ============================================================
addPageBreak();
addTitle('시스템 아키텍처', 22);

doc.moveDown(0.5);

// Architecture diagram as text
doc.font(font).fontSize(10).fillColor(DARK);

const archText = `
┌─────────────────────────────────────────────────────┐
│                    사용자 (브라우저)                      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│               Kubernetes Ingress                     │
│              (meeting.kaflix.com)                    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Express Backend (Node.js)                │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ REST API │  │ Static    │  │ AI Service       │  │
│  │ Routes   │  │ Files     │  │ (Claude API)     │  │
│  │          │  │ (Vue SPA) │  │ - 다듬기          │  │
│  │ - Report │  │           │  │ - 표준화          │  │
│  │ - Final  │  │           │  │ - 병합            │  │
│  │ - Auth   │  │           │  │                  │  │
│  │ - Admin  │  │           │  │                  │  │
│  └────┬─────┘  └───────────┘  └──────────────────┘  │
│       │                                              │
└───────┼──────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────┐
│                    MySQL Database                     │
│  ┌─────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │ users   │ │ reports      │ │ final_reports      │ │
│  │ teams   │ │ attachments  │ │ departments        │ │
│  └─────────┘ └──────────────┘ └────────────────────┘ │
└──────────────────────────────────────────────────────┘
`;

doc.text(archText, 60, doc.y, { width: 490 });
doc.moveDown(1);

addSubTitle('접속 정보');
addBullet('URL: https://meeting.kaflix.com');
addBullet('관리자 계정: admin / 1234');

// End
doc.end();

output.on('finish', () => {
  console.log('PDF generated: 보고또보고서_기능소개.pdf');
});
