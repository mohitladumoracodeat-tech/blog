import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Globe,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import {
  AVAILABLE_RATES,
  ListeningLanguage,
  PlaybackRate,
  SUPPORTED_LANGUAGES,
  SpeechSegment,
  estimateSpeechDuration,
  extractSpeechSegments,
  filterEnglishVoices,
  filterHindiVoices,
  filterVoicesByLanguage,
  formatFriendlyVoiceName,
  getPreferredEnglishVoice,
  getPreferredHindiVoice,
} from "../lib/speechUtils";
import { api, getErrorMessage } from "../lib/api";

export type AudioPlaybackState = "idle" | "playing" | "paused" | "completed";

export interface TranslatedArticleData {
  title: string;
  excerpt?: string | null;
  content: string;
  provider?: string;
}

export interface ArticleAudioPlayerProps {
  content: string;
  title: string;
  excerpt?: string | null;
  storyId: string;
  variant?: "card" | "compact";
  onSegmentChange?: (domId: string | null) => void;
  onLanguageChange?: (lang: ListeningLanguage, translated?: TranslatedArticleData) => void;
  className?: string;
}

/**
 * ArticleAudioPlayer
 *
 * Professional, browser-native Text-to-Speech audio narration player for Fieldnotes Journal.
 * Upgraded in Phase 1G with:
 *  - Multilingual support (English default, Hindi with translation engine)
 *  - Strict locale-specific voice filtering (no accidental English voices for Hindi)
 *  - Content-preserved paragraph-by-paragraph speech & visual highlighting
 *  - Dynamic drop-up/down viewport-aware placement
 *  - Graceful fallback and clear configuration messaging when translation provider is unset
 */
export function ArticleAudioPlayer({
  content,
  title,
  excerpt,
  storyId,
  variant = "card",
  onSegmentChange,
  onLanguageChange,
  className = "",
}: ArticleAudioPlayerProps) {
  const isSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Language & Translation state
  const [language, setLanguage] = useState<ListeningLanguage>("en");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translatedData, setTranslatedData] = useState<TranslatedArticleData | null>(null);

  // Speech & Voice state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedEnglishVoiceUri, setSelectedEnglishVoiceUri] = useState<string>("");
  const [selectedHindiVoiceUri, setSelectedHindiVoiceUri] = useState<string>("");
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>("idle");
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [voicesLoaded, setVoicesLoaded] = useState<boolean>(false);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState<boolean>(false);
  const [dropdownPlacement, setDropdownPlacement] = useState<"down" | "up">("down");
  const [speechErrorMessage, setSpeechErrorMessage] = useState<string | null>(null);

  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeRateRef = useRef<PlaybackRate>(playbackRate);
  const activeVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Active text depending on chosen listening language
  const activeTitle = language === "hi" && translatedData ? translatedData.title : title;
  const activeExcerpt = language === "hi" && translatedData ? (translatedData.excerpt ?? undefined) : excerpt ?? undefined;
  const activeContent = language === "hi" && translatedData ? translatedData.content : content;

  // Extract speech segments dynamically
  const segments: SpeechSegment[] = useMemo(() => {
    return extractSpeechSegments(activeContent, activeTitle, activeExcerpt);
  }, [activeContent, activeTitle, activeExcerpt]);

  // Total word count for duration estimation
  const totalWords = useMemo(() => {
    return segments.reduce((acc, seg) => acc + seg.text.split(/\s+/).length, 0);
  }, [segments]);

  const estimatedDuration = useMemo(() => {
    return estimateSpeechDuration(totalWords, playbackRate);
  }, [totalWords, playbackRate]);

  // Voices filtered for active language
  const activeVoices = useMemo(() => {
    return filterVoicesByLanguage(voices, language);
  }, [voices, language]);

  const selectedVoiceUri = language === "hi" ? selectedHindiVoiceUri : selectedEnglishVoiceUri;

  const selectedVoice = useMemo(() => {
    return activeVoices.find((v) => v.voiceURI === selectedVoiceUri) || null;
  }, [activeVoices, selectedVoiceUri]);

  useEffect(() => {
    activeVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  useEffect(() => {
    activeRateRef.current = playbackRate;
  }, [playbackRate]);

  // Dynamically calculate whether the dropdown should open downward or upward
  const updateDropdownPlacement = () => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 300 && spaceAbove > spaceBelow) {
      setDropdownPlacement("up");
    } else {
      setDropdownPlacement("down");
    }
  };

  const toggleVoiceSettings = () => {
    if (!voiceSettingsOpen) {
      updateDropdownPlacement();
    }
    setVoiceSettingsOpen((prev) => !prev);
  };

  // Close voice settings dropdown on outside click, escape, or resize/scroll
  useEffect(() => {
    if (!voiceSettingsOpen) return;

    updateDropdownPlacement();

    function handleScrollOrResize() {
      updateDropdownPlacement();
    }

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setVoiceSettingsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVoiceSettingsOpen(false);
      }
    }

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [voiceSettingsOpen]);

  // Load browser voices & select preferred voices for both English and Hindi
  useEffect(() => {
    if (!isSpeechSupported) {
      setSpeechErrorMessage("The Web Speech API is not supported in this browser.");
      return;
    }

    function loadVoices() {
      const available = window.speechSynthesis.getVoices();
      if (available && available.length > 0) {
        setVoices(available);
        setVoicesLoaded(true);

        // 1. Preferred English voice
        const enFiltered = filterEnglishVoices(available);
        if (enFiltered.length > 0 && !selectedEnglishVoiceUri) {
          const prefEn = getPreferredEnglishVoice(enFiltered);
          if (prefEn) setSelectedEnglishVoiceUri(prefEn.voiceURI);
        }

        // 2. Preferred Hindi voice
        const hiFiltered = filterHindiVoices(available);
        if (hiFiltered.length > 0 && !selectedHindiVoiceUri) {
          const prefHi = getPreferredHindiVoice(hiFiltered);
          if (prefHi) setSelectedHindiVoiceUri(prefHi.voiceURI);
        }
      }
    }

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSpeechSupported, selectedEnglishVoiceUri, selectedHindiVoiceUri]);

  // Clean up speech synthesis when story changes or component unmounts
  useEffect(() => {
    return () => {
      if (isSpeechSupported) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      onSegmentChange?.(null);
    };
  }, [storyId, isSpeechSupported, onSegmentChange]);

  // When storyId changes, reset translation cache and revert to English
  useEffect(() => {
    setTranslatedData(null);
    setTranslationError(null);
    setLanguage("en");
    setPlaybackState("idle");
    setCurrentSegmentIndex(0);
    onSegmentChange?.(null);
  }, [storyId, onSegmentChange]);

  // Check language-specific voice availability
  const hasVoiceForLanguage = activeVoices.length > 0;
  const noHindiVoice = language === "hi" && voicesLoaded && activeVoices.length === 0;
  const noEnglishVoice = language === "en" && voicesLoaded && activeVoices.length === 0;

  // Handle switching listening language
  async function handleSelectLanguage(newLang: ListeningLanguage) {
    if (newLang === language) return;

    // Stop current speech safely
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setPlaybackState("idle");
    setCurrentSegmentIndex(0);
    onSegmentChange?.(null);

    if (newLang === "en") {
      setLanguage("en");
      setTranslationError(null);
      onLanguageChange?.("en");
      return;
    }

    // Switched to Hindi
    setLanguage("hi");

    // If we already have translated text in memory for this story, reuse it
    if (translatedData) {
      onLanguageChange?.("hi", translatedData);
      return;
    }

    // Fetch Hindi translation from backend
    setIsTranslating(true);
    setTranslationError(null);

    try {
      const res = await api.post("/public/translate", {
        targetLanguage: "hi",
        sourceLanguage: "en",
        title,
        excerpt,
        content,
      });

      const result = res.data?.data as TranslatedArticleData | undefined;
      if (result && result.content) {
        const translated: TranslatedArticleData = {
          title: result.title || title,
          excerpt: result.excerpt,
          content: result.content,
          provider: result.provider,
        };
        setTranslatedData(translated);
        onLanguageChange?.("hi", translated);
      } else {
        throw new Error("Invalid translation response received from server.");
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setTranslationError(msg);
      // Fallback parent view to English while showing error in player
      onLanguageChange?.("en");
    } finally {
      setIsTranslating(false);
    }
  }

  // Speak a specific segment by index
  function speakSegment(index: number) {
    if (!isSpeechSupported || segments.length === 0) return;

    if (index >= segments.length) {
      // Completed all segments
      setPlaybackState("completed");
      setCurrentSegmentIndex(0);
      isSpeakingRef.current = false;
      onSegmentChange?.(null);
      return;
    }

    const segment = segments[index];
    if (!segment.text.trim()) {
      // Skip empty segment
      speakSegment(index + 1);
      return;
    }

    // Cancel any ongoing utterance before speaking new one
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(segment.text);
    currentUtteranceRef.current = utterance;

    // Apply voice strictly matching current language
    if (activeVoiceRef.current) {
      utterance.voice = activeVoiceRef.current;
      utterance.lang = activeVoiceRef.current.lang;
    } else {
      utterance.lang = language === "hi" ? "hi-IN" : "en-US";
    }

    // Apply rate & pitch
    utterance.rate = activeRateRef.current;
    utterance.pitch = 1.0;

    // Utterance lifecycle callbacks
    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setPlaybackState("playing");
      setCurrentSegmentIndex(index);

      // Notify parent for sentence/paragraph highlighting
      if (segment.domId) {
        onSegmentChange?.(segment.domId);
        const elem = document.getElementById(segment.domId);
        if (elem) {
          elem.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      } else {
        onSegmentChange?.(null);
      }
    };

    utterance.onend = () => {
      if (isSpeakingRef.current) {
        speakSegment(index + 1);
      }
    };

    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") {
        return;
      }
      console.warn("SpeechSynthesis error:", event.error);
      setPlaybackState("idle");
      isSpeakingRef.current = false;
      onSegmentChange?.(null);
    };

    window.speechSynthesis.speak(utterance);
  }

  // Play / Resume
  function handlePlay() {
    if (!isSpeechSupported || !hasVoiceForLanguage || isTranslating) return;

    if (playbackState === "paused") {
      window.speechSynthesis.resume();
      setPlaybackState("playing");
      isSpeakingRef.current = true;
      if (!window.speechSynthesis.speaking) {
        speakSegment(currentSegmentIndex);
      }
    } else {
      const startIndex = playbackState === "completed" ? 0 : currentSegmentIndex;
      speakSegment(startIndex);
    }
  }

  // Pause
  function handlePause() {
    if (!isSpeechSupported) return;
    window.speechSynthesis.pause();
    setPlaybackState("paused");
    isSpeakingRef.current = false;
  }

  // Stop
  function handleStop() {
    if (!isSpeechSupported) return;
    window.speechSynthesis.cancel();
    setPlaybackState("idle");
    setCurrentSegmentIndex(0);
    isSpeakingRef.current = false;
    onSegmentChange?.(null);
  }

  // Restart
  function handleRestart() {
    handleStop();
    setTimeout(() => {
      speakSegment(0);
    }, 50);
  }

  // Next segment
  function handleNext() {
    if (currentSegmentIndex < segments.length - 1) {
      speakSegment(currentSegmentIndex + 1);
    }
  }

  // Previous segment
  function handlePrevious() {
    if (currentSegmentIndex > 0) {
      speakSegment(currentSegmentIndex - 1);
    }
  }

  // Speed change
  function handleRateChange(rate: PlaybackRate) {
    setPlaybackRate(rate);
    activeRateRef.current = rate;
    if (playbackState === "playing") {
      speakSegment(currentSegmentIndex);
    }
  }

  // Voice change
  function handleVoiceChange(voiceUri: string) {
    if (language === "hi") {
      setSelectedHindiVoiceUri(voiceUri);
    } else {
      setSelectedEnglishVoiceUri(voiceUri);
    }
    const chosen = activeVoices.find((v) => v.voiceURI === voiceUri) || null;
    activeVoiceRef.current = chosen;
    if (playbackState === "playing") {
      speakSegment(currentSegmentIndex);
    }
  }

  // Progress percentage
  const progressPercent = segments.length > 0
    ? Math.round(((currentSegmentIndex + (playbackState === "completed" ? 1 : 0)) / segments.length) * 100)
    : 0;

  // Disabled condition
  const isDisabled =
    !isSpeechSupported ||
    isTranslating ||
    (voicesLoaded && !hasVoiceForLanguage) ||
    (language === "hi" && !translatedData && Boolean(translationError));

  // ══════════════════════════════════════════════════════════════════════
  // COMPACT VARIANT (For Reading Mode Toolbar or floating strip)
  // ══════════════════════════════════════════════════════════════════════
  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs shadow-sm ${className}`}>
        {/* Play / Pause button */}
        <button
          type="button"
          onClick={playbackState === "playing" ? handlePause : handlePlay}
          disabled={isDisabled}
          className={`grid size-7 place-items-center rounded-full text-white transition-all ${
            playbackState === "playing"
              ? "bg-amber-600 hover:bg-amber-700 animate-speech-pulse"
              : "bg-moss dark:bg-primary text-white dark:text-[#171B19] hover:opacity-90"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label={playbackState === "playing" ? "Pause article audio" : "Listen to article"}
          title={
            isTranslating
              ? "Translating article..."
              : noHindiVoice
              ? "Hindi voice not available on this device"
              : playbackState === "playing"
              ? "Pause narration"
              : "Listen to article narration"
          }
        >
          {isTranslating ? (
            <Loader2 size={13} className="animate-spin text-white dark:text-[#171B19]" />
          ) : playbackState === "playing" ? (
            <Pause size={13} />
          ) : (
            <Play size={13} className="ml-0.5" />
          )}
        </button>

        {playbackState !== "idle" && (
          <button
            type="button"
            onClick={handleStop}
            className="grid size-6 place-items-center rounded-full text-[var(--color-text-muted)] hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            aria-label="Stop narration"
            title="Stop narration"
          >
            <Square size={11} />
          </button>
        )}

        {/* Language selector toggle */}
        <div className="flex items-center rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] p-0.5 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => handleSelectLanguage("en")}
            className={`rounded-full px-2 py-0.5 transition-all ${
              language === "en"
                ? "bg-moss dark:bg-primary text-white dark:text-[#171B19]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => handleSelectLanguage("hi")}
            disabled={isTranslating}
            className={`rounded-full px-2 py-0.5 transition-all ${
              language === "hi"
                ? "bg-moss dark:bg-primary text-white dark:text-[#171B19]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            } disabled:opacity-50`}
          >
            HI
          </button>
        </div>

        <span className="font-semibold text-[11px] text-[var(--color-text-muted)] hidden sm:inline">
          {isTranslating
            ? "Translating..."
            : playbackState === "playing"
            ? `${progressPercent}%`
            : playbackState === "paused"
            ? "Paused"
            : playbackState === "completed"
            ? "Done"
            : `${estimatedDuration.formatted}`}
        </span>

        {/* Speed toggle chip */}
        <div className="relative">
          <select
            value={playbackRate}
            onChange={(e) => handleRateChange(Number(e.target.value) as PlaybackRate)}
            disabled={isDisabled}
            aria-label="Playback speed"
            className="rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer disabled:opacity-50"
          >
            {AVAILABLE_RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // CARD VARIANT (Editorial Story Detail Page Presentation)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <section
      aria-label="Audio narration of article"
      className={`my-8 relative z-20 rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-card transition-colors duration-200 ${className}`}
    >
      {/* Top Banner: Title, Duration & Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div
            className={`grid size-10 place-items-center rounded-xl bg-accent/30 dark:bg-accent/20 text-moss dark:text-primary ${
              playbackState === "playing" ? "animate-speech-pulse ring-2 ring-moss/30 dark:ring-primary/40" : ""
            }`}
          >
            <Headphones size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]">
                Audio Narration
              </span>
              {language === "hi" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                  हिंदी (Hindi)
                </span>
              )}
              {playbackState === "playing" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Playing
                </span>
              )}
              {playbackState === "paused" && (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Paused
                </span>
              )}
              {playbackState === "completed" && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  Completed
                </span>
              )}
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-[var(--color-text)]">
              {language === "hi" ? "इस आलेख को सुनें (Listen in Hindi)" : "Listen to this story"}
            </h3>
          </div>
        </div>

        {/* Right side: Language Selector & Duration/Progress */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Language Selector Pill Group */}
          <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] p-1 text-xs">
            <span className="pl-2 pr-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1">
              <Globe size={11} /> Lang:
            </span>
            {SUPPORTED_LANGUAGES.map((langItem) => {
              const isSelected = language === langItem.code;
              return (
                <button
                  key={langItem.code}
                  type="button"
                  onClick={() => handleSelectLanguage(langItem.code)}
                  disabled={isTranslating}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-moss dark:bg-primary text-white dark:text-[#171B19] shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  } disabled:opacity-50`}
                  aria-label={`Listen in ${langItem.label}`}
                >
                  {isTranslating && langItem.code === "hi" ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      <span>हिंदी</span>
                    </>
                  ) : (
                    <span>{langItem.code === "hi" ? "हिंदी (HI)" : "EN"}</span>
                  )}
                </button>
              );
            })}
          </div>

          <span className="font-semibold text-[var(--color-text-muted)] hidden sm:inline">
            {playbackState === "idle"
              ? `~${estimatedDuration.formatted}`
              : `${progressPercent}% (${currentSegmentIndex + 1}/${segments.length})`}
          </span>
        </div>
      </div>

      {/* Translation Loading State Banner */}
      {isTranslating && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3.5 text-xs text-[var(--color-text)]">
          <Loader2 size={16} className="shrink-0 animate-spin text-[var(--color-primary)]" />
          <div className="leading-relaxed">
            <p className="font-bold">Translating story into Hindi...</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Preserving original paragraph structure, headings, and formatting for Hindi voice narration.
            </p>
          </div>
        </div>
      )}

      {/* Translation Error Banner */}
      {translationError && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="leading-relaxed flex-1">
            <p className="font-bold">Hindi Translation Unavailable</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              {translationError}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectLanguage("en")}
                className="rounded-full bg-amber-700/20 dark:bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-700/30 transition-all"
              >
                Switch to English
              </button>
              <button
                type="button"
                onClick={() => handleSelectLanguage("hi")}
                className="rounded-full border border-amber-600/30 px-3 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-600/10 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hindi Voice Unavailable Warning Banner */}
      {noHindiVoice && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-900 dark:text-blue-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="leading-relaxed">
            <p className="font-bold">No Hindi Voice Installed in Browser</p>
            <p className="mt-0.5 text-blue-800 dark:text-blue-300">
              Hindi translation is ready, but your browser/operating system does not have a native Hindi speech voice installed. To listen, please install a Hindi voice package in your device language settings (e.g. Windows Settings &gt; Time &amp; Language &gt; Speech &gt; Add Voices &gt; Hindi).
            </p>
          </div>
        </div>
      )}

      {/* English Voice Unavailable Warning Banner */}
      {noEnglishVoice && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="leading-relaxed">
            <p className="font-bold">No English Voice Available</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              No English speech voice was detected on this device.
            </p>
          </div>
        </div>
      )}

      {/* General Speech Error Message */}
      {speechErrorMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-800 dark:text-red-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="leading-relaxed">
            <p className="font-bold">Speech Synthesis Unavailable</p>
            <p className="mt-0.5 text-red-700 dark:text-red-300">{speechErrorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Playback Controls Bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        {/* Play, Pause, Stop, Skip Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={playbackState === "playing" ? handlePause : handlePlay}
            disabled={isDisabled}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm ${
              playbackState === "playing"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-moss dark:bg-primary text-white dark:text-[#171B19] hover:opacity-90"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label={playbackState === "playing" ? "Pause narration" : "Play article narration"}
          >
            {isTranslating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Translating...</span>
              </>
            ) : playbackState === "playing" ? (
              <>
                <Pause size={15} />
                <span>Pause</span>
              </>
            ) : playbackState === "paused" ? (
              <>
                <Play size={15} className="ml-0.5" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Play size={15} className="ml-0.5" />
                <span>{language === "hi" ? "हिंदी में सुनें" : "Listen Now"}</span>
              </>
            )}
          </button>

          {playbackState !== "idle" && (
            <>
              <button
                type="button"
                onClick={handleStop}
                className="grid size-9 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] text-[var(--color-text)] hover:text-red-500 hover:border-red-500/40 transition-all"
                aria-label="Stop narration"
                title="Stop and reset narration"
              >
                <Square size={14} />
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="grid size-9 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] text-[var(--color-text)] hover:border-[var(--color-primary)] transition-all"
                aria-label="Restart from beginning"
                title="Restart from beginning"
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}

          {/* Previous / Next Paragraph Skip Buttons */}
          {playbackState !== "idle" && (
            <div className="hidden sm:flex items-center gap-1 border-l border-[var(--color-border)] pl-3">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentSegmentIndex === 0}
                className="grid size-8 place-items-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-all"
                aria-label="Previous paragraph"
                title="Previous paragraph"
              >
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentSegmentIndex >= segments.length - 1}
                className="grid size-8 place-items-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-all"
                aria-label="Next paragraph"
                title="Next paragraph"
              >
                <SkipForward size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Speed Selector & Voice Popover */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Speed Pills */}
          <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] p-1 text-xs">
            {AVAILABLE_RATES.map((rate) => {
              const isActive = playbackRate === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRateChange(rate)}
                  disabled={isDisabled}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                    isActive
                      ? "bg-moss dark:bg-primary text-white dark:text-[#171B19] shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  } disabled:opacity-40`}
                >
                  {rate}x
                </button>
              );
            })}
          </div>

          {/* Voice Selector Dropdown (Strictly for active language) */}
          {activeVoices.length > 0 && (
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={toggleVoiceSettings}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--bg-app)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] transition-all"
                aria-label={language === "hi" ? "Select Hindi narrator voice" : "Select English narrator voice"}
                aria-expanded={voiceSettingsOpen}
              >
                <Volume2 size={13} className="text-[var(--color-primary)]" />
                <span className="max-w-[140px] truncate">
                  {formatFriendlyVoiceName(selectedVoice)}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-[var(--color-text-muted)] transition-transform duration-200 ${
                    voiceSettingsOpen ? (dropdownPlacement === "up" ? "" : "rotate-180") : ""
                  }`}
                />
              </button>

              {voiceSettingsOpen && (
                <div
                  role="dialog"
                  aria-label={language === "hi" ? "Available Hindi Voices" : "Available English Voices"}
                  className={`absolute right-0 ${
                    dropdownPlacement === "up"
                      ? "bottom-full mb-2 origin-bottom-right"
                      : "top-full mt-2 origin-top-right"
                  } w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 shadow-2xl z-50 ring-1 ring-black/10 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-150 flex flex-col`}
                >
                  <div className="mb-2 px-2 pb-2 border-b border-[var(--color-border)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {language === "hi" ? "Available Hindi Voices" : "Available English Voices"}
                      </p>
                      <span className="text-[10px] font-semibold text-[var(--color-primary)]">
                        {activeVoices.length} {activeVoices.length === 1 ? "voice" : "voices"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {language === "hi" ? "Browser-native text-to-speech (hi-IN)" : "Browser-native text-to-speech"}
                    </p>
                  </div>

                  <div className="max-h-56 sm:max-h-60 overflow-y-auto space-y-1 pr-1 overscroll-contain">
                    {activeVoices.map((voice) => {
                      const isSelected = voice.voiceURI === selectedVoiceUri;
                      return (
                        <button
                          key={voice.voiceURI}
                          type="button"
                          onClick={() => {
                            handleVoiceChange(voice.voiceURI);
                            setVoiceSettingsOpen(false);
                          }}
                          className={`w-full rounded-xl px-2.5 py-2 text-left text-xs transition-all flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-moss/10 dark:bg-primary/20 text-moss dark:text-primary font-bold shadow-xs"
                              : "text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="truncate block leading-snug">{voice.name}</span>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className="rounded px-1.5 py-0.5 font-mono text-[10px] bg-black/5 dark:bg-white/10 text-[var(--color-text-muted)]">
                              {voice.lang}
                            </span>
                            {isSelected && <Check size={13} className="text-moss dark:text-primary" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Track Bar */}
      {playbackState !== "idle" && (
        <div className="mt-5 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mb-1.5 font-medium">
            <span>
              {language === "hi"
                ? `अनुच्छेद ${currentSegmentIndex + 1} / ${segments.length}`
                : `Reading along: Paragraph ${currentSegmentIndex + 1} of ${segments.length}`}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-moss dark:bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
