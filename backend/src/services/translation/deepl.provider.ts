import { ITranslationProvider, TranslationError, TranslationRequest, TranslationResult } from "./types";

export interface DeepLOptions {
  apiKey?: string;
  apiUrl?: string;
  timeoutMs?: number;
}

export class DeepLTranslationProvider implements ITranslationProvider {
  readonly name = "deepl";
  private readonly apiKey?: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(options: DeepLOptions = {}) {
    this.apiKey = options.apiKey;
    const isFree = this.apiKey && this.apiKey.endsWith(":fx");
    this.apiUrl = options.apiUrl || (isFree ? "https://api-free.deepl.com/v2" : "https://api.deepl.com/v2");
    this.timeoutMs = options.timeoutMs || 20000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async translateText(text: string, signal: AbortSignal): Promise<string> {
    if (!text || !text.trim()) return text;
    const res = await fetch(`${this.apiUrl.replace(/\/+$/, "")}/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        text: [text],
        source_lang: "EN",
        target_lang: "HI",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new TranslationError(
        `DeepL API returned ${res.status}: ${err.slice(0, 200)}`,
        "DEEPL_ERROR",
        res.status >= 500 ? 502 : 400
      );
    }

    const data = (await res.json()) as { translations?: Array<{ text: string }> };
    return data.translations?.[0]?.text || text;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.isConfigured()) {
      throw new TranslationError(
        "DeepL API key is not configured. Set TRANSLATION_API_KEY in backend env.",
        "DEEPL_NOT_CONFIGURED",
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
        throw new TranslationError("DeepL translation request timed out.", "TRANSLATION_TIMEOUT", 504);
      }
      throw new TranslationError(
        `DeepL translation failed: ${err instanceof Error ? err.message : String(err)}`,
        "DEEPL_FAILED",
        500
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
