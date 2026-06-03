import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import pool from '../config/database';

function htmlToText(html: string): string {
  if (!html) return '';
  return cheerio.load(html).text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'meeting-notes-mcp', version: '1.0.0' });

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

  return server;
}

const requireMcpToken: express.RequestHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const expected = process.env.MCP_TOKEN;
  if (!expected) {
    console.warn('[mcp] MCP_TOKEN is not set — denying request');
    res.status(503).json({ error: 'MCP_TOKEN is not configured on the server' });
    return;
  }
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }
  const provided = header.slice('Bearer '.length).trim();
  if (provided !== expected) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }
  next();
};

export function mountMcp(app: express.Application): void {
  const handler: express.RequestHandler = async (req, res) => {
    try {
      const server = buildMcpServer();
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

  app.post('/mcp', requireMcpToken, handler);
  app.get('/mcp', requireMcpToken, handler);
  app.delete('/mcp', requireMcpToken, handler);

  console.log('[mcp] mounted at /mcp (Bearer token required)');
}
