import { ITranslationProvider, TranslationRequest, TranslationResult } from "./types";

/**
 * MockTranslationProvider
 *
 * Safe, deterministic offline provider for automated test suites and local verification.
 * Translates English sentences and headings into natural Hindi mock translations
 * while rigorously preserving markdown headings, paragraph breaks, lists, and code blocks.
 */
export class MockTranslationProvider implements ITranslationProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  private translateMarkdown(text: string): string {
    if (!text) return "";
    const lines = text.split("\n");
    let inCode = false;

    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("```")) {
          inCode = !inCode;
          return line;
        }
        if (inCode || !trimmed) {
          return line;
        }

        // Heading H1
        if (trimmed.startsWith("# ")) {
          return `# [हिंदी] ${trimmed.slice(2)}`;
        }
        // Heading H2
        if (trimmed.startsWith("## ")) {
          return `## [हिंदी] ${trimmed.slice(3)}`;
        }
        // Heading H3
        if (trimmed.startsWith("### ")) {
          return `### [हिंदी] ${trimmed.slice(4)}`;
        }
        // List item
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return `- [हिंदी] ${trimmed.slice(2)}`;
        }
        // Blockquote
        if (trimmed.startsWith("> ")) {
          return `> [हिंदी] ${trimmed.slice(2)}`;
        }

        // Paragraph
        return `[हिंदी अनुवाद]: ${line}`;
      })
      .join("\n");
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      targetLanguage: "hi",
      title: request.title ? `[हिंदी शीर्षक] ${request.title}` : undefined,
      excerpt: request.excerpt ? `[हिंदी सारांश] ${request.excerpt}` : request.excerpt,
      content: this.translateMarkdown(request.content),
      provider: this.name,
    };
  }
}
