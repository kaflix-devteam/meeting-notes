import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const polishGuide = fs.readFileSync(
  path.join(__dirname, '../prompts/polish-guide.md'),
  'utf-8'
);

const teamPrompt = fs.readFileSync(
  path.join(__dirname, '../prompts/team.md'),
  'utf-8'
);

const polishSystemPrompt = `${teamPrompt}\n\n${polishGuide}`;

const mergePrompt = fs.readFileSync(
  path.join(__dirname, '../prompts/merge.md'),
  'utf-8'
);

// ============================================================
// Types
// ============================================================

export interface AnalysisResult {
  teamName: string;
  summary: string;
  keyPoints: string[];
  opinions: string[];
  suggestions: string[];
}

export interface TeamAnalysis {
  teamCode: string;
  teamName: string;
  reportContents: string[];
  analysis: AnalysisResult;
}

// ============================================================
// analyzeReport - 보고서 분석: 핵심 내용, 의견, 제안 추출
// ============================================================

export async function analyzeReport(
  content: string,
  teamName: string
): Promise<AnalysisResult> {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `다음은 "${teamName}" 팀의 업무보고서입니다. 아래 내용을 분석하여 JSON 형식으로 응답해주세요.

보고서 내용:
${content}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "teamName": "${teamName}",
  "summary": "전체 요약 (2-3문장)",
  "keyPoints": ["핵심 내용 1", "핵심 내용 2", ...],
  "opinions": ["의견 1", "의견 2", ...],
  "suggestions": ["제안 1", "제안 2", ...]
}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse analysis JSON from Claude response');
    }

    return JSON.parse(jsonMatch[0]) as AnalysisResult;
  } catch (error) {
    console.error(`[aiService] analyzeReport failed for team ${teamName}:`, error);
    // Fallback: return a basic analysis without AI
    return {
      teamName,
      summary: `${teamName} 팀의 업무보고서입니다.`,
      keyPoints: ['보고서 내용을 확인해주세요.'],
      opinions: [],
      suggestions: [],
    };
  }
}

// ============================================================
// generateFinalReportHtml - 여러 팀 분석 결과를 최종보고서 HTML로 병합
// ============================================================

export async function generateFinalReportHtml(
  analyses: TeamAnalysis[],
  reportDate: string
): Promise<string> {
  try {
    const analysisText = analyses
      .map(
        (a) => `
팀: ${a.teamName} (${a.teamCode})
요약: ${a.analysis.summary}
핵심 내용: ${a.analysis.keyPoints.join(', ')}
의견: ${a.analysis.opinions.join(', ')}
제안: ${a.analysis.suggestions.join(', ')}
원본 보고서:
${a.reportContents.join('\n---\n')}
`
      )
      .join('\n========\n');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `다음은 ${reportDate} 날짜의 여러 팀 업무보고서 분석 결과입니다. 이것을 하나의 최종보고서 HTML로 만들어주세요.

분석 결과:
${analysisText}

다음 HTML 형식으로만 응답하세요 (다른 텍스트 없이, HTML 코드만):

<div class="final-report">
  <h1>업무보고서 - ${reportDate}</h1>

  (각 팀별 섹션)
  <section class="team-section" data-team="팀코드">
    <h2>팀이름</h2>
    <div class="report-content">원본 보고 내용을 정리하여 포함</div>
    <div class="suggestions">
      <h3>의견 및 제안</h3>
      <ul><li>...</li></ul>
    </div>
  </section>

  (마지막에 종합 요약)
  <section class="overall-summary">
    <h2>종합 요약</h2>
    <p>모든 팀의 보고 내용을 종합한 요약</p>
  </section>
</div>`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract HTML from response
    const htmlMatch = responseText.match(/<div class="final-report">[\s\S]*<\/div>/);
    if (htmlMatch) {
      return htmlMatch[0];
    }

    // If no match, try to use the whole response if it looks like HTML
    if (responseText.includes('<div') && responseText.includes('</div>')) {
      return responseText.trim();
    }

    // Fallback: generate HTML manually
    return generateFallbackHtml(analyses, reportDate);
  } catch (error) {
    console.error('[aiService] generateFinalReportHtml failed:', error);
    return generateFallbackHtml(analyses, reportDate);
  }
}

// ============================================================
// summarizeReport - 보고서 내용 요약
// ============================================================

export async function summarizeReport(content: string): Promise<string> {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `다음 업무보고서 내용을 3-4문장으로 간결하게 요약해주세요. 요약만 응답하세요.

${content}`,
        },
      ],
    });

    return message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : '';
  } catch (error) {
    console.error('[aiService] summarizeReport failed:', error);
    return '요약을 생성할 수 없습니다.';
  }
}

// ============================================================
// generateMergeSummary - 병합 보고서 요약문 생성 (토큰 최소화)
// ============================================================

export async function generateMergeSummary(
  teams: { name: string; count: number }[],
  reportDate: string
): Promise<string> {
  try {
    const teamList = teams.map((t) => `- ${t.name}: ${t.count}건`).join('\n');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: mergePrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `${reportDate} 업무보고서 병합 요약문을 1~2문장으로 작성해주세요.\n\n참여 팀:\n${teamList}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    return responseText.trim();
  } catch (error) {
    console.error('[aiService] generateMergeSummary failed:', error);
    return `${reportDate} 업무보고서 - ${teams.map((t) => t.name).join(', ')} 팀의 보고서가 병합되었습니다.`;
  }
}

// ============================================================
// polishReport - 보고서 내용 다듬기
// ============================================================

export async function polishReport(contentHtml: string): Promise<string> {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: polishSystemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `다음 업무보고서 HTML을 다듬어주세요.\n\n${contentHtml}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Try to extract HTML content from the response
    const trimmed = responseText.trim();
    if (trimmed.startsWith('<')) {
      return trimmed;
    }

    // If wrapped in code block, extract it
    const codeBlockMatch = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    return trimmed || contentHtml;
  } catch (error) {
    console.error('[aiService] polishReport failed:', error);
    throw error;
  }
}

// ============================================================
// Fallback HTML generator (no AI)
// ============================================================

function generateFallbackHtml(
  analyses: TeamAnalysis[],
  reportDate: string
): string {
  const teamSections = analyses
    .map((a) => {
      const suggestionsHtml =
        a.analysis.suggestions.length > 0 || a.analysis.opinions.length > 0
          ? `<div class="suggestions">
        <h3>의견 및 제안</h3>
        <ul>
          ${[...a.analysis.opinions, ...a.analysis.suggestions]
            .map((item) => `<li>${item}</li>`)
            .join('\n          ')}
        </ul>
      </div>`
          : '';

      return `<section class="team-section" data-team="${a.teamCode}">
    <h2>${a.teamName}</h2>
    <div class="report-content">
      ${a.reportContents.join('<hr/>')}
    </div>
    ${suggestionsHtml}
  </section>`;
    })
    .join('\n  \n  ');

  const overallKeyPoints = analyses
    .flatMap((a) => a.analysis.keyPoints)
    .map((kp) => `<li>${kp}</li>`)
    .join('\n      ');

  return `<div class="final-report">
  <h1>업무보고서 - ${reportDate}</h1>

  ${teamSections}

  <section class="overall-summary">
    <h2>종합 요약</h2>
    <ul>
      ${overallKeyPoints}
    </ul>
  </section>
</div>`;
}
