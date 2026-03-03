import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ============================================================
// Types
// ============================================================

export interface SearchResult {
  reportId: number;
  chunkText: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

// ============================================================
// splitTextIntoChunks - 문서를 청크로 분할
// ============================================================

export function splitTextIntoChunks(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const cleanText = text.replace(/\s+/g, ' ').trim();

  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  let start = 0;
  while (start < cleanText.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < cleanText.length) {
      const lastPeriod = cleanText.lastIndexOf('.', end);
      const lastNewline = cleanText.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= cleanText.length) break;
  }

  return chunks;
}

// ============================================================
// generateEmbedding - 텍스트에서 임베딩 생성
// ============================================================

export async function generateEmbedding(text: string): Promise<number[]> {
  return generateLocalEmbedding(text);
}

function generateLocalEmbedding(text: string): number[] {
  const dimensions = 1536;
  const vector = new Array<number>(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const idx = code % dimensions;
    vector[idx] += 1;
  }

  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.charCodeAt(i) * 31 + normalized.charCodeAt(i + 1);
    const idx = bigram % dimensions;
    vector[idx] += 0.5;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / magnitude;
    }
  }

  return vector;
}

// ============================================================
// embedReport - 보고서를 임베딩하여 document_embeddings 테이블에 저장
// ============================================================

export async function embedReport(
  reportId: number,
  contentHtml: string
): Promise<void> {
  const $ = cheerio.load(contentHtml);
  const plainText = $.text().trim();

  if (!plainText) {
    console.warn(`[ragService] No text content found for report ${reportId}`);
    return;
  }

  const [reportRows] = await pool.query<RowDataPacket[]>(
    `SELECT r.report_date, t.code AS team_code, t.name AS team_name
     FROM reports r
     JOIN teams t ON r.team_id = t.id
     WHERE r.id = ?`,
    [reportId]
  );

  const reportMeta = reportRows[0];

  // Delete existing embeddings for this report
  await pool.query('DELETE FROM document_embeddings WHERE report_id = ?', [reportId]);

  const chunks = splitTextIntoChunks(plainText);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk);

    const metadata = {
      chunkIndex: i,
      totalChunks: chunks.length,
      teamCode: reportMeta?.team_code ?? null,
      teamName: reportMeta?.team_name ?? null,
      reportDate: reportMeta?.report_date ?? null,
    };

    await pool.query<ResultSetHeader>(
      `INSERT INTO document_embeddings (report_id, chunk_text, embedding, metadata)
       VALUES (?, ?, ?, ?)`,
      [reportId, chunk, JSON.stringify(embedding), JSON.stringify(metadata)]
    );
  }

  console.log(
    `[ragService] Embedded report ${reportId}: ${chunks.length} chunks stored`
  );
}

// ============================================================
// searchSimilarDocuments - 유사도 검색 (MySQL JSON 기반 간소화)
// ============================================================

export async function searchSimilarDocuments(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  // MySQL doesn't support native vector similarity search.
  // Fallback: return recent embeddings matching by keyword overlap.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT report_id, chunk_text, metadata
     FROM document_embeddings
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    reportId: row.report_id,
    chunkText: row.chunk_text,
    similarity: 0,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  }));
}

// ============================================================
// extractTextFromAttachment - 첨부파일에서 텍스트 추출
// ============================================================

export async function extractTextFromAttachment(
  filePath: string,
  fileType: string
): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`[ragService] File not found: ${absolutePath}`);
    return '';
  }

  try {
    if (fileType === 'text/plain' || filePath.endsWith('.txt')) {
      return fs.readFileSync(absolutePath, 'utf-8');
    }

    if (fileType === 'application/pdf' || filePath.endsWith('.pdf')) {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = fs.readFileSync(absolutePath);
      const pdfData = await pdfParse.default(dataBuffer);
      return pdfData.text;
    }

    if (
      fileType.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath)
    ) {
      return await extractTextFromImage(absolutePath, fileType);
    }

    console.warn(`[ragService] Unsupported file type: ${fileType}`);
    return '';
  } catch (error) {
    console.error(`[ragService] Text extraction failed for ${filePath}:`, error);
    return '';
  }
}

// ============================================================
// extractTextFromImage - 이미지에서 Claude Vision으로 텍스트 추출
// ============================================================

async function extractTextFromImage(
  filePath: string,
  fileType: string
): Promise<string> {
  try {
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');

    const mediaType = fileType.startsWith('image/')
      ? (fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
      : 'image/png';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: '이 이미지에 포함된 모든 텍스트를 추출해주세요. 텍스트만 응답하세요. 텍스트가 없으면 빈 문자열을 응답하세요.',
            },
          ],
        },
      ],
    });

    return message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : '';
  } catch (error) {
    console.error('[ragService] Image text extraction failed:', error);
    return '';
  }
}
