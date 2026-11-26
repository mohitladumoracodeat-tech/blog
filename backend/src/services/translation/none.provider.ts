import { ITranslationProvider, TranslationNotConfiguredError, TranslationRequest, TranslationResult } from "./types";

export class NoneTranslationProvider implements ITranslationProvider {
  readonly name = "none";

  isConfigured(): boolean {
    return false;
  }

  async translate(_request: TranslationRequest): Promise<TranslationResult> {
    throw new TranslationNotConfiguredError();
  }
}
