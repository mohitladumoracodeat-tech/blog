import { ITranslationProvider, TranslationError, TranslationRequest, TranslationResult } from "./types";

export interface LibreTranslateOptions {
  apiUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class LibreTranslateProvider implements ITranslationProvider {
  readonly name = "libretranslate";
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: LibreTranslateOptions = {}) {
    this.apiUrl = options.apiUrl || "http://localhost:5000";
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs || 20000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiUrl.trim().length > 0);
  }

  private async translateText(text: string, signal: AbortSignal): Promise<string> {
    if (!text || !text.trim()) return text;
    const res = await fetch(`${this.apiUrl.replace(/\/+$/, "")}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "hi",
        format: "text",
        api_key: this.apiKey || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new TranslationError(
        `LibreTranslate returned ${res.status}: ${err.slice(0, 200)}`,
        "LIBRETRANSLATE_ERROR",
        res.status >= 500 ? 502 : 400
      );
    }

    const data = (await res.json()) as { translatedText?: string };
    return data.translatedText || text;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.isConfigured()) {
      throw new TranslationError(
        "LibreTranslate URL is not configured. Set TRANSLATION_API_URL in backend env.",
        "LIBRETRANSLATE_NOT_CONFIGURED",
        503
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const [translatedTitle, translatedExcerpt, translatedContent] = await Promise.all([
        request.title ? this.translateText(request.title, controller.signal) : Promise.resolve(request.title),
        request.excerpt ? this.translateText(request.excerpt, controller.signal) : Promise.resolve(request.excerpt),
        this.translateText(request.content, controller.signal),
      ]);

      return {
        targetLanguage: "hi",
        title: translatedTitle,
        excerpt: translatedExcerpt,
        content: translatedContent,
        provider: this.name,
      };
    } catch (err: unknown) {
      if (err instanceof TranslationError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TranslationError("LibreTranslate request timed out.", "TRANSLATION_TIMEOUT", 504);
      }
      throw new TranslationError(
        `LibreTranslate failed: ${err instanceof Error ? err.message : String(err)}`,
        "LIBRETRANSLATE_FAILED",
        500
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
