import { ITranslationProvider, TranslationError, TranslationRequest, TranslationResult } from "./types";

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GeminiTranslationProvider implements ITranslationProvider {
  readonly name = "gemini";
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model || "gemini-3.5-flash-lite";
    this.timeoutMs = options.timeoutMs || 60000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.isConfigured()) {
      throw new TranslationError(
        "Gemini Translation Provider is missing GEMINI_API_KEY or TRANSLATION_API_KEY.",
        "GEMINI_CREDENTIALS_MISSING",
        503
      );
    }

    const prompt = `You are a professional literary and editorial translator for Fieldnotes Journal.
Translate the following English article into natural, publication-grade Hindi (using Devanagari script).

STRICT TRANSLATION RULES:
1. Translate English prose faithfully and elegantly into Hindi.
2. PRESERVE ALL Markdown structure:
   - Keep heading markers (#, ##, ###) intact with their translated heading titles.
   - Preserve exact paragraph breaks (double newlines).
   - Preserve bullet list markers (- ) and numbered list markers (1. ).
   - Preserve blockquote markers (> ).
   - DO NOT translate raw code blocks or code fences (\`\`\`...\`\`\`). Keep technical identifiers and code syntax verbatim.
   - DO NOT translate inline code (\`code\`).
3. Output MUST be valid JSON matching this schema:
{
  "title": "Hindi translated title",
  "excerpt": "Hindi translated excerpt (or null if none provided)",
  "content": "Hindi translated full content with preserved markdown structure"
}
Output only the JSON object, without surrounding markdown ticks or commentary.

INPUT ARTICLE:
Title: ${request.title || ""}
Excerpt: ${request.excerpt || ""}
Content:
${request.content}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model
      )}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new TranslationError(
          `Gemini API responded with status ${response.status}: ${errorText.slice(0, 300)}`,
          "GEMINI_API_ERROR",
          response.status >= 500 ? 502 : 400
        );
      }

      const json = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new TranslationError("Gemini returned empty response for translation.", "GEMINI_EMPTY_RESPONSE", 502);
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        excerpt?: string | null;
        content: string;
      };

      return {
        targetLanguage: "hi",
        title: parsed.title || request.title,
        excerpt: parsed.excerpt !== undefined ? parsed.excerpt : request.excerpt,
        content: parsed.content || request.content,
        provider: this.name,
      };
    } catch (err: unknown) {
      if (err instanceof TranslationError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TranslationError("Gemini translation request timed out.", "TRANSLATION_TIMEOUT", 504);
      }
      throw new TranslationError(
        `Gemini translation failed: ${err instanceof Error ? err.message : String(err)}`,
        "GEMINI_TRANSLATION_FAILED",
        500
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
