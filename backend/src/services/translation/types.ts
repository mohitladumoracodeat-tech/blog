/**
 * types.ts
 *
 * Types and interfaces for the translation provider abstraction.
 * Supports enterprise multi-provider architecture (Gemini, LibreTranslate, DeepL, Google Cloud).
 */

export type SupportedLanguage = "en" | "hi";

export interface TranslationRequest {
  targetLanguage: "hi";
  sourceLanguage?: string;
  title?: string;
  excerpt?: string | null;
  content: string;
}

export interface TranslationResult {
  targetLanguage: "hi";
  title?: string;
  excerpt?: string | null;
  content: string;
  provider: string;
  cached?: boolean;
}

export interface TranslationProviderStatus {
  isConfigured: boolean;
  activeProvider: string;
  supportedProviders: string[];
  supportedLanguages: SupportedLanguage[];
  configurationHint?: string;
}

export interface ITranslationProvider {
  readonly name: string;
  isConfigured(): boolean;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TranslationError";
  }
}

export class TranslationNotConfiguredError extends TranslationError {
  constructor(message = "Translation provider is not configured. Set TRANSLATION_PROVIDER and TRANSLATION_API_KEY to enable Hindi translation.") {
    super(message, "TRANSLATION_PROVIDER_NOT_CONFIGURED", 503, {
      requiredEnv: ["TRANSLATION_PROVIDER", "TRANSLATION_API_KEY"],
      supportedProviders: ["gemini", "libretranslate", "deepl", "google-cloud"],
    });
  }
}
