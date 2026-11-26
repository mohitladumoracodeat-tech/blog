import { ITranslationProvider, TranslationError, TranslationRequest, TranslationResult } from "./types";

export interface GoogleCloudOptions {
  apiKey?: string;
  timeoutMs?: number;
}

export class GoogleCloudTranslationProvider implements ITranslationProvider {
  readonly name = "google-cloud";
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: GoogleCloudOptions = {}) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs || 20000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async translateText(text: string, signal: AbortSignal): Promise<string> {
    if (!text || !text.trim()) return text;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(this.apiKey!)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "hi",
        format: "text",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new TranslationError(
        `Google Cloud Translation returned ${res.status}: ${err.slice(0, 200)}`,
        "GOOGLE_CLOUD_TRANSLATION_ERROR",
        res.status >= 500 ? 502 : 400
      );
    }

    const data = (await res.json()) as {
      data?: {
        translations?: Array<{ translatedText?: string }>;
      };
    };
    return data.data?.translations?.[0]?.translatedText || text;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.isConfigured()) {
      throw new TranslationError(
        "Google Cloud Translation API key is not configured. Set TRANSLATION_API_KEY in backend env.",
        "GOOGLE_CLOUD_NOT_CONFIGURED",
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
        throw new TranslationError("Google Cloud Translation request timed out.", "TRANSLATION_TIMEOUT", 504);
      }
      throw new TranslationError(
        `Google Cloud Translation failed: ${err instanceof Error ? err.message : String(err)}`,
        "GOOGLE_CLOUD_FAILED",
        500
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
