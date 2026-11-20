import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ThemeToggleProps {
  variant?: "icon" | "pill" | "subtle";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({
  variant = "icon",
  size = "md",
  showLabel = false,
  className = "",
}: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  const nextModeLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  const currentModeLabel = isDark ? "Dark" : "Light";

  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-9 text-sm",
    lg: "size-10 text-base",
  };

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20,
  };

  if (variant === "pill" || showLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={nextModeLabel}
        title={nextModeLabel}
        className={`inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      >
        <span className="grid size-5 place-items-center rounded-full bg-paper text-moss">
          {isDark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-moss" />}
        </span>
        <span>{currentModeLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextModeLabel}
      title={nextModeLabel}
      className={`grid ${sizeClasses[size]} place-items-center rounded-xl border border-black/10 dark:border-white/10 bg-surface text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {isDark ? (
        <Sun size={iconSizes[size]} className="text-amber-300 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon size={iconSizes[size]} className="text-moss transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
}
