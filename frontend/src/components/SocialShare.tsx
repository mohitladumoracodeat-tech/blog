import { useEffect, useState } from "react";
import { Check, Copy, Facebook, Linkedin, Share2 } from "lucide-react";
import { showToast } from "../lib/alerts";

export interface SocialShareProps {
  title: string;
  url?: string;
  excerpt?: string | null;
  className?: string;
  compact?: boolean;
}

/**
 * Custom SVG icons for platforms where Lucide does not provide official brand glyphs
 */
function WhatsAppIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.197 1.006.128.832.941z" />
    </svg>
  );
}

function XIcon({ size = 13, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * Reusable Advanced Social Sharing Component for Fieldnotes Journal
 */
export function SocialShare({
  title,
  url,
  excerpt,
  className = "",
  compact = false,
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Compute canonical absolute URL
  const shareUrl = (() => {
    if (typeof window === "undefined") return url || "";
    if (url && /^https?:\/\//i.test(url)) return url;
    if (url) {
      return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
    }
    return window.location.href;
  })();

  // Detect Web Share API support
  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanNativeShare(true);
    }
  }, []);

  // Safe clipboard copy with fallback
  async function handleCopyLink() {
    if (!shareUrl) return;

    let successful = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        successful = true;
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        successful = document.execCommand("copy");
        textArea.remove();
      }
    } catch {
      successful = false;
    }

    if (successful) {
      setCopied(true);
      showToast({ title: "Story link copied to clipboard", icon: "success" });
      setTimeout(() => setCopied(false), 2500);
    } else {
      showToast({ title: "Could not copy link to clipboard", icon: "error" });
    }
  }

  // Native Web Share API trigger
  async function handleNativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title,
        text: excerpt || title,
        url: shareUrl,
      });
    } catch (err: unknown) {
      // User cancelled or aborted the share sheet - don't show an error
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      showToast({ title: "Unable to share via device dialog", icon: "error" });
    }
  }

  // Encoded parameters for share URLs
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedWhatsAppText = encodeURIComponent(`${title}\n${shareUrl}`);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* 1. WhatsApp */}
      <a
        href={`https://api.whatsapp.com/send?text=${encodedWhatsAppText}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share story on WhatsApp"
        title="Share on WhatsApp"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/5 active:scale-95"
      >
        <WhatsAppIcon size={14} className="text-[#25D366]" />
        {!compact && <span>WhatsApp</span>}
      </a>

      {/* 2. Telegram */}
      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share story on Telegram"
        title="Share on Telegram"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#229ED9] hover:text-[#229ED9] hover:bg-[#229ED9]/5 active:scale-95"
      >
        <TelegramIcon size={14} className="text-[#229ED9]" />
        {!compact && <span>Telegram</span>}
      </a>

      {/* 3. X / Twitter */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share story on X"
        title="Share on X"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
      >
        <XIcon size={13} />
        {!compact && <span>X</span>}
      </a>

      {/* 4. Facebook */}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share story on Facebook"
        title="Share on Facebook"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#1877F2] hover:text-[#1877F2] hover:bg-[#1877F2]/5 active:scale-95"
      >
        <Facebook size={14} className="text-[#1877F2]" />
        {!compact && <span>Facebook</span>}
      </a>

      {/* 5. LinkedIn */}
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share story on LinkedIn"
        title="Share on LinkedIn"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#0A66C2] hover:text-[#0A66C2] hover:bg-[#0A66C2]/5 active:scale-95"
      >
        <Linkedin size={14} className="text-[#0A66C2]" />
        {!compact && <span>LinkedIn</span>}
      </a>

      {/* 6. Copy Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        aria-label="Copy story link to clipboard"
        title="Copy link to clipboard"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 ${
          copied
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
            : "border-black/10 dark:border-white/10 bg-surface text-ink hover:border-moss hover:bg-moss/5 dark:hover:border-primary dark:hover:bg-primary/5 hover:text-moss dark:hover:text-primary"
        }`}
      >
        {copied ? (
          <>
            <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy size={14} />
            <span>Copy Link</span>
          </>
        )}
      </button>

      {/* 7. Native Mobile Share (Conditional on Web Share API support) */}
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label="Share story via system menu"
          title="Share via device menu"
          className="inline-flex items-center gap-1.5 rounded-full border border-moss/30 dark:border-primary/30 bg-moss/10 dark:bg-primary/10 px-3 py-1.5 text-xs font-semibold text-moss dark:text-primary shadow-sm transition hover:bg-moss hover:text-white dark:hover:bg-primary dark:hover:text-[#171B19] active:scale-95"
        >
          <Share2 size={13} />
          <span>More...</span>
        </button>
      )}
    </div>
  );
}
