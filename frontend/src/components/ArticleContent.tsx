import { ReactNode } from "react";
import { slugifyHeading } from "./TableOfContents";

export interface ArticleContentProps {
  content: string;
  className?: string;
  activeSpeechDomId?: string | null;
}

/**
 * Parses inline formatting: **bold**, *italic*, and `code` safely
 * into React elements without using dangerouslySetInnerHTML.
 */
function parseInlineFormatting(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-[var(--bg-surface-elevated)] border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-primary)] font-semibold"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold text: **bold**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      nodes.push(
        <strong key={key++} className="font-bold text-[var(--color-text)]">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Italic text: *italic*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      nodes.push(
        <em key={key++} className="italic text-[var(--color-text)]">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 4. Regular plain text up to next special delimiter
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      nodes.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      nodes.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      nodes.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return nodes;
}

/**
 * ArticleContent
 *
 * Renders story content into semantic, accessible HTML elements.
 * Generates identical stable IDs for H2 and H3 elements matching TableOfContents.
 * Includes scroll-mt-24 to guarantee comfortable clearance below sticky headers.
 */
export function ArticleContent({ content, className = "", activeSpeechDomId }: ArticleContentProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  const seenSlugs = new Map<string, number>();

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  let paragraphBuffer: string[] = [];
  let isFirstParagraph = true;
  let pCounter = 0;
  let hCounter = 0;

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;

    const domId = `article-p-${pCounter++}`;
    const isHighlight = activeSpeechDomId === domId;
    const highlightClass = isHighlight ? "speech-highlight-active" : "";
    const key = `p-${elements.length}`;

    if (isFirstParagraph) {
      isFirstParagraph = false;
      elements.push(
        <p
          key={key}
          id={domId}
          className={`editorial-dropcap drop-cap mb-6 leading-relaxed text-[var(--color-text)] transition-all ${highlightClass}`}
        >
          {parseInlineFormatting(text)}
        </p>
      );
    } else {
      elements.push(
        <p
          key={key}
          id={domId}
          className={`mb-6 leading-relaxed text-[var(--color-text)] transition-all ${highlightClass}`}
        >
          {parseInlineFormatting(text)}
        </p>
      );
    }
  }

  function flushList() {
    if (listBuffer.length === 0 || !listType) return;
    const items = [...listBuffer];
    const type = listType;
    listBuffer = [];
    listType = null;

    const key = `list-${elements.length}`;
    if (type === "ul") {
      elements.push(
        <ul key={key} className="my-5 list-disc pl-6 space-y-2 text-[var(--color-text)]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={key} className="my-5 list-decimal pl-6 space-y-2 text-[var(--color-text)]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
    }
  }

  function flushCodeBlock() {
    if (!inCodeBlock) return;
    inCodeBlock = false;
    const code = codeBuffer.join("\n");
    codeBuffer = [];

    const key = `code-${elements.length}`;
    elements.push(
      <div key={key} className="my-6 max-w-full overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] shadow-card">
        {codeLang && (
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--bg-surface-elevated)] px-4 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            <span>{codeLang}</span>
          </div>
        )}
        <pre className="overflow-x-auto p-4 text-xs sm:text-sm font-mono leading-relaxed text-[var(--color-text)] bg-[var(--bg-surface-elevated)] min-w-0">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code Block Fence (```)
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // 2. Heading H3 (### )
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      const title = trimmed.slice(4).trim();
      const baseSlug = slugifyHeading(title) || "section";
      const count = seenSlugs.get(baseSlug) || 0;
      seenSlugs.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

      const domId = `article-h-${hCounter++}`;
      const isHighlight = activeSpeechDomId === domId;
      const highlightClass = isHighlight ? "speech-highlight-active" : "";

      elements.push(
        <h3
          key={`h3-${id}`}
          id={id}
          data-speech-id={domId}
          className={`scroll-mt-24 font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)] mt-8 mb-3 transition-all ${highlightClass}`}
        >
          {title}
        </h3>
      );
      continue;
    }

    // 3. Heading H2 (## )
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      const title = trimmed.slice(3).trim();
      const baseSlug = slugifyHeading(title) || "section";
      const count = seenSlugs.get(baseSlug) || 0;
      seenSlugs.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

      const domId = `article-h-${hCounter++}`;
      const isHighlight = activeSpeechDomId === domId;
      const highlightClass = isHighlight ? "speech-highlight-active" : "";

      elements.push(
        <h2
          key={`h2-${id}`}
          id={id}
          data-speech-id={domId}
          className={`scroll-mt-24 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)] mt-12 mb-4 border-b border-[var(--color-border)] pb-2 transition-all ${highlightClass}`}
        >
          {title}
        </h2>
      );
      continue;
    }

    // 4. Blockquote (> )
    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      const quoteText = trimmed.slice(2).trim();
      const domId = `article-q-${pCounter++}`;
      const isHighlight = activeSpeechDomId === domId;
      const highlightClass = isHighlight ? "speech-highlight-active" : "";
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          id={domId}
          data-speech-id={domId}
          className={`editorial-pullquote my-8 border-l-4 border-moss dark:border-primary pl-6 py-4 italic text-lg sm:text-xl text-[var(--color-text)] bg-[var(--bg-surface-elevated)] rounded-r-2xl transition-all shadow-sm ${highlightClass}`}
        >
          {parseInlineFormatting(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 5. Horizontal Divider (---, ***, ___)
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushParagraph();
      flushList();
      elements.push(
        <hr
          key={`hr-${elements.length}`}
          className="editorial-hr my-10 border-0 h-px bg-[var(--color-border)]"
        />
      );
      continue;
    }

    // 4. Unordered List (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listBuffer.push(ulMatch[1]);
      continue;
    }

    // 5. Ordered List (1. 2. etc.)
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listBuffer.push(olMatch[1]);
      continue;
    }

    // 6. Blank line -> flush paragraph or list
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // 7. Regular paragraph content
    paragraphBuffer.push(trimmed);
  }

  // Flush remaining buffers
  flushParagraph();
  flushList();
  flushCodeBlock();

  return (
    <div className={`editorial-article reading-content ${className}`}>
      {elements}
    </div>
  );
}
