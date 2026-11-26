/**
 * speechUtils.ts
 *
 * High-performance Web Speech API utilities for Fieldnotes Journal.
 * Handles clean article text extraction, strict English voice filtering,
 * natural paragraph/sentence segmentation, and speech duration estimation.
 */

export interface SpeechSegment {
  id: string;
  type: "title" | "excerpt" | "heading" | "paragraph";
  text: string;
  domId?: string;
}

export type PlaybackRate = 0.75 | 1 | 1.25 | 1.5 | 2;

export type ListeningLanguage = "en" | "hi";

export interface SupportedListeningLanguage {
  code: ListeningLanguage;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: SupportedListeningLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
];

export const AVAILABLE_RATES: PlaybackRate[] = [0.75, 1, 1.25, 1.5, 2];

/**
 * Strips Markdown syntax, HTML tags, raw code fences, image markup, and special characters
 * to produce clean, natural-sounding English prose for speech synthesis.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // 1. Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // 2. Remove multi-line code blocks entirely (```...```) to avoid reciting syntax noise
  text = text.replace(/```[\s\S]*?```/g, " ");

  // 3. Remove inline code formatting `code` -> code
  text = text.replace(/`([^`]+)`/g, "$1");

  // 4. Remove image tags ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");

  // 5. Convert markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // 6. Remove bold/italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // 7. Strip heading markers (##, ###, etc.)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 8. Strip blockquote markers (> )
  text = text.replace(/^>\s+/gm, "");

  // 9. Strip bullet and numbered list markers
  text = text.replace(/^[-*]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");

  // 10. Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Extracts structured, sequential speech segments from story content,
 * title, and excerpt, assigning stable DOM IDs for paragraph highlighting.
 */
export function extractSpeechSegments(
  content: string,
  title?: string,
  excerpt?: string
): SpeechSegment[] {
  const segments: SpeechSegment[] = [];

  // 1. Title segment
  if (title) {
    const cleanTitle = cleanTextForSpeech(title);
    if (cleanTitle) {
      segments.push({
        id: "speech-title",
        type: "title",
        text: cleanTitle,
      });
    }
  }

  // 2. Excerpt / Pullquote segment
  if (excerpt) {
    const cleanExcerpt = cleanTextForSpeech(excerpt);
    if (cleanExcerpt) {
      segments.push({
        id: "speech-excerpt",
        type: "excerpt",
        text: cleanExcerpt,
        domId: "article-excerpt",
      });
    }
  }

  if (!content) return segments;

  const lines = content.split("\n");
  let inCodeBlock = false;
  let paragraphBuffer: string[] = [];
  let pCounter = 0;
  let hCounter = 0;

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const rawPara = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    const clean = cleanTextForSpeech(rawPara);
    if (clean) {
      segments.push({
        id: `speech-p-${pCounter}`,
        type: "paragraph",
        text: clean,
        domId: `article-p-${pCounter}`,
      });
      pCounter++;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block fences
    if (trimmed.startsWith("```")) {
      flushParagraph();
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Headings (##, ###)
    if (trimmed.startsWith("#")) {
      flushParagraph();
      const cleanHeading = cleanTextForSpeech(trimmed);
      if (cleanHeading) {
        segments.push({
          id: `speech-h-${hCounter}`,
          type: "heading",
          text: cleanHeading,
          domId: `article-h-${hCounter}`,
        });
        hCounter++;
      }
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  return segments;
}

/**
 * Filters the browser's available speech synthesis voices strictly to English voices.
 * Matches en-US, en-GB, en-AU, en-CA, en-IN, en-NZ, en-IE, etc.
 * Never includes non-English languages (e.g. Hindi, Gujarati, Spanish, etc.).
 */
export function filterEnglishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((voice) => {
    const lang = voice.lang.replace(/_/g, "-").toLowerCase();
    return lang.startsWith("en-") || lang === "en";
  });
}

/**
 * Filters the browser's available speech synthesis voices strictly to Hindi voices.
 * Matches hi-IN and hi.
 * Never includes non-Hindi languages.
 */
export function filterHindiVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((voice) => {
    const lang = voice.lang.replace(/_/g, "-").toLowerCase();
    return lang.startsWith("hi-") || lang === "hi";
  });
}

/**
 * Filters voices based on the chosen listening language ("en" or "hi").
 */
export function filterVoicesByLanguage(
  voices: SpeechSynthesisVoice[],
  language: ListeningLanguage
): SpeechSynthesisVoice[] {
  return language === "hi" ? filterHindiVoices(voices) : filterEnglishVoices(voices);
}

/**
 * Returns the highest priority English voice:
 * 1. en-US
 * 2. en-GB
 * 3. en-AU
 * 4. Other English voices (en-CA, en-IN, etc.)
 * Returns null if no English voice is found.
 */
export function getPreferredEnglishVoice(
  englishVoices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!englishVoices || englishVoices.length === 0) return null;

  const preferredLocales = ["en-us", "en-gb", "en-au", "en-ca", "en-in"];

  for (const locale of preferredLocales) {
    const found = englishVoices.find((v) => {
      const l = v.lang.replace(/_/g, "-").toLowerCase();
      return l === locale;
    });
    if (found) return found;
  }

  // Fallback to default flag among English voices
  const defaultEnglish = englishVoices.find((v) => v.default);
  if (defaultEnglish) return defaultEnglish;

  return englishVoices[0];
}

/**
 * Returns the highest priority Hindi voice:
 * 1. hi-IN
 * 2. Any other hi voice
 * Returns null if no Hindi voice is found.
 */
export function getPreferredHindiVoice(
  hindiVoices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!hindiVoices || hindiVoices.length === 0) return null;

  // Prefer hi-IN
  const foundHiIn = hindiVoices.find((v) => {
    const l = v.lang.replace(/_/g, "-").toLowerCase();
    return l === "hi-in";
  });
  if (foundHiIn) return foundHiIn;

  // Fallback to default flag among Hindi voices
  const defaultHindi = hindiVoices.find((v) => v.default);
  if (defaultHindi) return defaultHindi;

  return hindiVoices[0];
}

/**
 * Gets preferred voice for the chosen listening language.
 */
export function getPreferredVoice(
  voices: SpeechSynthesisVoice[],
  language: ListeningLanguage
): SpeechSynthesisVoice | null {
  return language === "hi" ? getPreferredHindiVoice(voices) : getPreferredEnglishVoice(voices);
}

/**
 * Cleanly formats a speech synthesis voice name into a friendly, readable label.
 * Example:
 *  "Microsoft Swara - Hindi (India)" -> "Swara"
 *  "Microsoft Madhur - Hindi (India)" -> "Madhur"
 *  "Microsoft Heera - English (India)" -> "Heera"
 *  "Google हिन्दी" -> "Google Hindi"
 */
export function formatFriendlyVoiceName(voice: SpeechSynthesisVoice | null): string {
  if (!voice) return "Voice";
  const name = voice.name;

  const cleaned = name
    .replace(/^Microsoft\s+/i, "")
    .replace(/Desktop/i, "")
    .replace(/Online\s*\(Natural\)/i, "")
    .replace(/-\s*(Hindi|English)\s*\([^)]*\)/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();

  return cleaned || voice.name.split(" ")[0] || "Voice";
}

/**
 * Calculates estimated narration duration in minutes and seconds based on word count.
 * Average English speech speed is ~150 words per minute at 1.0x rate.
 */
export function estimateSpeechDuration(totalWords: number, rate: PlaybackRate = 1): {
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const baseMinutes = totalWords / (150 * rate);
  const totalSeconds = Math.max(15, Math.round(baseMinutes * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  return { minutes, seconds, formatted };
}
