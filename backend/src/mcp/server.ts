import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import pool from '../config/database';
import { verifyToken } from '../services/tokenService';

function htmlToText(html: string): string {
  if (!html) return '';
  return cheerio.load(html).text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 평문/마크다운-lite 를 간단한 HTML 로 변환. 이미 HTML 태그가 있으면 그대로 둔다.
function toHtml(content: string): string {
  if (!content) return '';
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function todayKst(): string {
  // 서버는 UTC 일 수 있으므로 KST 기준 날짜로 보정
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getUserContext(
  userId: number,
): Promise<{ displayName: string; teamId: number; departmentId: number } | null> {
  const { rows } = await pool.query(
    `SELECT u.display_name, u.team_id, t.department_id
       FROM users u JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1`,
    [userId],
  );
  if (rows.length === 0) return null;
  return { displayName: rows[0].display_name, teamId: rows[0].team_id, departmentId: rows[0].department_id };
}

function buildMcpServer(authUserId: number | null): McpServer {
  const server = new McpServer({ name: 'meeting-notes-mcp', version: '1.1.0' });

  // ── 읽기 도구: 회의록 검색 (모든 유효 토큰 허용) ───────────────────────────
  server.registerTool(
    'search_meeting_notes',
    {
      title: 'Search meeting notes',
      description:
        '회의록을 제목(첫 단락) 또는 내용 키워드로 검색해 일치하는 회의록의 본문을 반환합니다. title 또는 content 중 최소 하나는 필요합니다.',
      inputSchema: {
        title: z.string().optional().describe('제목/첫 단락 검색어'),
        content: z.string().optional().describe('본문 검색어'),
        limit: z.number().int().min(1).max(50).optional().describe('최대 결과 수 (기본 10)'),
      },
    },
    async ({ title, content, limit }) => {
      if (!title && !content) {
        return {
          content: [{ type: 'text', text: 'title 또는 content 중 하나는 반드시 제공해야 합니다.' }],
          isError: true,
        };
      }

      const max = limit ?? 10;
      const conds: string[] = [];
      const params: (string | number)[] = [];
      if (title) {
        params.push(`%${title}%`);
        conds.push(`regexp_replace(m.content_html, '<[^>]+>', '', 'g') ILIKE $${params.length}`);
      }
      if (content) {
        params.push(`%${content}%`);
        conds.push(`m.content_html ILIKE $${params.length}`);
      }
      params.push(max);
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const { rows } = await pool.query(
        `SELECT m.id, to_char(m.report_date, 'YYYY-MM-DD') AS report_date,
                m.content_html,
                d.name AS department_name,
                t.name AS team_name,
                u.display_name AS user_display_name
         FROM meeting_notes m
         LEFT JOIN departments d ON m.department_id = d.id
         LEFT JOIN teams t ON m.team_id = t.id
         LEFT JOIN users u ON m.user_id = u.id
         ${where}
         ORDER BY m.report_date DESC, m.created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      if (rows.length === 0) {
        return { content: [{ type: 'text', text: '검색 결과 없음.' }] };
      }

      const formatted = rows
        .map((r: any) => {
          const plain = htmlToText(r.content_html);
          const header = `## #${r.id} | ${r.report_date} | ${r.department_name || '-'} / ${r.team_name || '-'} | 작성: ${r.user_display_name || '-'}`;
          return `${header}\n\n${plain}`;
        })
        .join('\n\n---\n\n');

      return { content: [{ type: 'text', text: formatted }] };
    },
  );

  // ── 쓰기 도구: 개인 토큰(작성자 식별 가능)으로 인증된 경우에만 등록 ──────────
  if (authUserId !== null) {
    server.registerTool(
      'create_meeting_note',
      {
        title: '회의록 등록',
        description:
          '회의록을 등록합니다. 작성자는 인증 토큰의 소유자로 자동 지정되고, 팀/부서는 작성자의 소속으로 채워집니다. content 는 평문/마크다운/HTML 모두 가능합니다.',
        inputSchema: {
          content: z.string().min(1).describe('회의록 본문 (평문/마크다운/HTML)'),
          report_date: z
            .string()
            .regex(DATE_RE)
            .optional()
            .describe('회의 날짜 YYYY-MM-DD (생략 시 오늘)'),
        },
      },
      async ({ content, report_date }) => {
        const ctx = await getUserContext(authUserId);
        if (!ctx) return { content: [{ type: 'text', text: '작성자 정보를 찾을 수 없습니다.' }], isError: true };
        const date = report_date || todayKst();
        const { rows } = await pool.query(
          `INSERT INTO meeting_notes (user_id, team_id, department_id, report_date, content_html, tag_signature)
           VALUES ($1, $2, $3, $4, $5, '') RETURNING id`,
          [authUserId, ctx.teamId, ctx.departmentId, date, toHtml(content)],
        );
        return {
          content: [
            { type: 'text', text: `회의록이 등록되었습니다. (#${rows[0].id}, ${date}, 작성: ${ctx.displayName})` },
          ],
        };
      },
    );

    server.registerTool(
      'create_weekly_report',
      {
        title: '주간보고서 등록',
        description:
          '주간보고서를 등록합니다. 작성자는 인증 토큰의 소유자로 자동 지정됩니다. 같은 날짜에 이미 보고서가 있으면 오류를 반환합니다.',
        inputSchema: {
          content: z.string().min(1).describe('보고서 본문 (평문/마크다운/HTML)'),
          report_date: z
            .string()
            .regex(DATE_RE)
            .optional()
            .describe('보고 기준일 YYYY-MM-DD (생략 시 오늘)'),
        },
      },
      async ({ content, report_date }) => {
        const ctx = await getUserContext(authUserId);
        if (!ctx) return { content: [{ type: 'text', text: '작성자 정보를 찾을 수 없습니다.' }], isError: true };
        const date = report_date || todayKst();
        try {
          const { rows } = await pool.query(
            `INSERT INTO reports (user_id, team_id, department_id, report_date, content_html)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [authUserId, ctx.teamId, ctx.departmentId, date, toHtml(content)],
          );
          return {
            content: [
              { type: 'text', text: `주간보고서가 등록되었습니다. (#${rows[0].id}, ${date}, 작성: ${ctx.displayName})` },
            ],
          };
        } catch (e: any) {
          if (e?.code === '23505') {
            return { content: [{ type: 'text', text: `${date} 에 이미 보고서가 존재합니다.` }], isError: true };
          }
          throw e;
        }
      },
    );

    server.registerTool(
      'create_notice',
      {
        title: '공지 등록',
        description: '전사 공지를 등록합니다. title 과 content 가 필요합니다.',
        inputSchema: {
          title: z.string().min(1).max(255).describe('공지 제목'),
          content: z.string().min(1).describe('공지 본문 (평문/마크다운/HTML)'),
        },
      },
      async ({ title, content }) => {
        const { rows } = await pool.query(
          'INSERT INTO notices (title, content) VALUES ($1, $2) RETURNING id',
          [title, toHtml(content)],
        );
        return { content: [{ type: 'text', text: `공지가 등록되었습니다. (#${rows[0].id})` }] };
      },
    );
  }

  return server;
}

// 요청 인증: 개인 토큰(mnt_)이면 작성자 식별, 레거시 공유 MCP_TOKEN 이면 읽기 전용.
interface McpAuth {
  userId: number | null; // 개인 토큰 소유자 (없으면 공유 토큰)
}

async function authenticate(req: express.Request): Promise<McpAuth | null> {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const provided = header.slice('Bearer '.length).trim();

  // 1) 개인 토큰
  if (provided.startsWith('mnt_')) {
    const v = await verifyToken(provided);
    return v ? { userId: v.userId } : null;
  }

  // 2) 레거시 공유 토큰 (검색 전용)
  const shared = process.env.MCP_TOKEN;
  if (shared && provided === shared) return { userId: null };

  return null;
}

export function mountMcp(app: express.Application): void {
  const handler: express.RequestHandler = async (req, res) => {
    try {
      if (req.method !== 'OPTIONS') {
        const auth = await authenticate(req);
        if (!auth) {
          res.status(401).json({ error: 'Missing or invalid token' });
          return;
        }
        (req as any).mcpUserId = auth.userId;
      }

      const server = buildMcpServer((req as any).mcpUserId ?? null);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        try {
          transport.close();
          server.close();
        } catch {
          /* ignore */
        }
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e: any) {
      console.error('[mcp] handler error:', e?.message || e);
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP server error', detail: e?.message });
      }
    }
  };

  app.post('/mcp', handler);
  app.get('/mcp', handler);
  app.delete('/mcp', handler);

  console.log('[mcp] mounted at /mcp (personal token = read+write, shared MCP_TOKEN = read-only)');
}
