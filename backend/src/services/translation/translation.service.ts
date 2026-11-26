import crypto from "node:crypto";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  ITranslationProvider,
  SupportedLanguage,
  TranslationError,
  TranslationProviderStatus,
  TranslationRequest,
  TranslationResult,
} from "./types";
import { NoneTranslationProvider } from "./none.provider";
import { GeminiTranslationProvider } from "./gemini.provider";
import { LibreTranslateProvider } from "./libretranslate.provider";
import { DeepLTranslationProvider } from "./deepl.provider";
import { GoogleCloudTranslationProvider } from "./google-cloud.provider";
import { MockTranslationProvider } from "./mock.provider";

export interface CacheEntry {
  result: TranslationResult;
  timestamp: number;
}

export class TranslationService {
  private provider: ITranslationProvider;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheEntries = 200;
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.provider = this.resolveProvider();
  }

  private resolveProvider(): ITranslationProvider {
    const providerName = env.TRANSLATION_PROVIDER || "none";
    const apiKey = env.TRANSLATION_API_KEY || env.GEMINI_API_KEY;
    const apiUrl = env.TRANSLATION_API_URL;

    switch (providerName) {
      case "gemini":
        return new GeminiTranslationProvider({ apiKey, model: env.GEMINI_MODEL });
      case "libretranslate":
        return new LibreTranslateProvider({ apiUrl, apiKey });
      case "deepl":
        return new DeepLTranslationProvider({ apiKey, apiUrl });
      case "google-cloud":
        return new GoogleCloudTranslationProvider({ apiKey });
      case "mock":
        return new MockTranslationProvider();
      case "none":
      default:
        // If an explicit GEMINI_API_KEY is present without TRANSLATION_PROVIDER set, auto-enable gemini
        if (apiKey && apiKey.trim().length > 0) {
          return new GeminiTranslationProvider({ apiKey, model: env.GEMINI_MODEL });
        }
        return new NoneTranslationProvider();
    }
  }

  /**
   * Allows tests or runtime reconfiguration to switch provider
   */
  public setProvider(provider: ITranslationProvider): void {
    this.provider = provider;
  }

  public getStatus(): TranslationProviderStatus {
    const isConfigured = this.provider.isConfigured();
    const activeProvider = this.provider.name;

    return {
      isConfigured,
      activeProvider,
      supportedProviders: ["gemini", "libretranslate", "deepl", "google-cloud", "mock"],
      supportedLanguages: ["en", "hi"],
      configurationHint: isConfigured
        ? `Translation is active using ${activeProvider}.`
        : "Set TRANSLATION_PROVIDER and TRANSLATION_API_KEY in backend environment to enable Hindi translation.",
    };
  }

  private computeHash(request: TranslationRequest): string {
    const payload = `${request.targetLanguage}::${request.title || ""}::${request.excerpt || ""}::${request.content}`;
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Sanitizes text to strip dangerous executable HTML script tags, while preserving
   * clean markdown headings, paragraphs, and prose.
   */
  private sanitizeInputText(raw: string): string {
    if (!raw) return "";
    return raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/javascript:/gi, "");
  }

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    // 1. Language validation
    if (request.targetLanguage !== "hi") {
      throw new TranslationError(
        `Unsupported target language: ${request.targetLanguage}. Currently supported: hi.`,
        "UNSUPPORTED_LANGUAGE",
        400
      );
    }

    // 2. Text input validation & size limits
    const rawContent = (request.content || "").trim();
    if (!rawContent) {
      throw new TranslationError("Content to translate cannot be empty.", "EMPTY_CONTENT", 400);
    }

    if (rawContent.length > 50000) {
      throw new TranslationError(
        `Content exceeds maximum permitted length of 50,000 characters (received ${rawContent.length}).`,
        "CONTENT_TOO_LARGE",
        413
      );
    }

    const title = request.title ? this.sanitizeInputText(request.title.trim()).slice(0, 500) : undefined;
    const excerpt = request.excerpt ? this.sanitizeInputText(request.excerpt.trim()).slice(0, 2000) : request.excerpt;
    const content = this.sanitizeInputText(rawContent);

    const sanitizedRequest: TranslationRequest = {
      targetLanguage: request.targetLanguage,
      sourceLanguage: request.sourceLanguage || "en",
      title,
      excerpt,
      content,
    };

    // 3. Cache lookup by content hash
    const cacheKey = this.computeHash(sanitizedRequest);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      logger.info({ cacheKey, targetLanguage: "hi" }, "Serving translated article from in-memory cache");
      return {
        ...cached.result,
        cached: true,
      };
    }

    // 4. Check provider configuration
    if (!this.provider.isConfigured()) {
      throw new TranslationError(
        "Hindi translation is currently unavailable because a translation provider is not configured. Set TRANSLATION_PROVIDER and TRANSLATION_API_KEY in the backend environment.",
        "TRANSLATION_PROVIDER_NOT_CONFIGURED",
        503,
        {
          requiredEnv: ["TRANSLATION_PROVIDER", "TRANSLATION_API_KEY"],
          supportedProviders: ["gemini", "libretranslate", "deepl", "google-cloud"],
        }
      );
    }

    // 5. Delegate to active translation provider
    logger.info({ provider: this.provider.name, targetLanguage: "hi" }, "Initiating article translation");
    const result = await this.provider.translate(sanitizedRequest);

    // 6. Store in LRU cache
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { result, timestamp: now });

    return {
      ...result,
      cached: false,
    };
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const translationService = new TranslationService();
