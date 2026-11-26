import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export { ThemeToggle };

/* ══════════════════════════════════════════════════════════════════════
   1. PAGE HEADER / HEADING
   ══════════════════════════════════════════════════════════════════════ */

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-10 flex flex-col gap-6 border-b border-black/[.08] dark:border-white/[.08] pb-6 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.25em] text-moss dark:text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl leading-[1.08]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-base sm:text-lg text-muted font-normal leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </div>
      {action && <div className="sm:shrink-0 flex items-center gap-3">{action}</div>}
    </div>
  );
}

export const PageHeader = PageHeading;

/* ══════════════════════════════════════════════════════════════════════
   2. BUTTON
   ══════════════════════════════════════════════════════════════════════ */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "accent" | "ghost" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss dark:focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-paper dark:focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:translate-y-0";

  const sizeStyles = {
    xs: "px-2.5 py-1 text-[11px] rounded-lg",
    sm: "px-3.5 py-1.5 text-xs rounded-xl",
    md: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-2xl",
  };

  const variantStyles = {
    primary:
      "bg-moss text-white hover:bg-ink hover:-translate-y-0.5 dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90 shadow-sm hover:shadow-card",
    secondary:
      "border border-black/15 dark:border-white/15 bg-surface text-ink hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated hover:-translate-y-0.5 shadow-sm",
    danger:
      "border border-red-200/80 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 hover:-translate-y-0.5",
    accent:
      "bg-accent text-ink hover:bg-accent/80 hover:-translate-y-0.5 dark:bg-accent dark:text-white shadow-sm",
    ghost:
      "bg-transparent text-ink hover:bg-paper dark:hover:bg-surface-elevated",
    outline:
      "border border-moss dark:border-primary text-moss dark:text-primary hover:bg-moss hover:text-white dark:hover:bg-primary dark:hover:text-[#171B19] hover:-translate-y-0.5",
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <LoaderCircle size={size === "xs" || size === "sm" ? 14 : 16} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   3. INPUT & FIELD
   ══════════════════════════════════════════════════════════════════════ */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
}

export function Input({ className = "", error, ...props }: InputProps) {
  return (
    <input
      className={`field !px-4 !py-3 text-sm font-sans font-normal text-ink ${
        error ? "!border-red-500 focus:!ring-red-500/20" : ""
      } ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  className = "",
  ...props
}: InputProps & { label: string }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.15em] text-ink/80">
      <span className="block mb-2">{label}</span>
      <Input className={className} error={error} {...props} />
      {hint && !error && <span className="mt-1.5 block text-xs font-normal normal-case text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-normal normal-case text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   4. TEXTAREA & TEXTAREA FIELD
   ══════════════════════════════════════════════════════════════════════ */

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hint?: string;
}

export function Textarea({ className = "", error, ...props }: TextAreaProps) {
  return (
    <textarea
      className={`field min-h-32 resize-y !px-4 !py-3 text-sm font-sans font-normal text-ink ${
        error ? "!border-red-500 focus:!ring-red-500/20" : ""
      } ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  label,
  error,
  hint,
  className = "",
  ...props
}: TextAreaProps & { label: string }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.15em] text-ink/80">
      <span className="block mb-2">{label}</span>
      <Textarea className={className} error={error} {...props} />
      {hint && !error && <span className="mt-1.5 block text-xs font-normal normal-case text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-normal normal-case text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   5. SELECT & SELECT FIELD
   ══════════════════════════════════════════════════════════════════════ */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  hint?: string;
}

export function Select({ children, className = "", error, ...props }: PropsWithChildren<SelectProps>) {
  return (
    <select
      className={`field !px-4 !py-3 text-sm font-sans font-normal text-ink bg-surface ${
        error ? "!border-red-500 focus:!ring-red-500/20" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function SelectField({
  label,
  children,
  error,
  hint,
  className = "",
  ...props
}: PropsWithChildren<SelectProps & { label: string }>) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.15em] text-ink/80">
      <span className="block mb-2">{label}</span>
      <Select className={className} error={error} {...props}>
        {children}
      </Select>
      {hint && !error && <span className="mt-1.5 block text-xs font-normal normal-case text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-normal normal-case text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   6. CARD
   ══════════════════════════════════════════════════════════════════════ */

export interface CardProps {
  variant?: "default" | "elevated" | "muted" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
}: CardProps) {
  const variantStyles = {
    default: "bg-surface border border-black/[.08] dark:border-white/[.08] shadow-card",
    elevated: "bg-surface-elevated border border-black/[.08] dark:border-white/[.08] shadow-md",
    muted: "bg-paper border border-black/[.06] dark:border-white/[.06]",
    interactive:
      "bg-surface border border-black/[.08] dark:border-white/[.08] shadow-card hover:shadow-card-hover hover:border-moss/40 dark:hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 cursor-pointer",
  };

  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6 sm:p-7",
    lg: "p-8 sm:p-10",
  };

  return (
    <div className={`rounded-3xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   7. BADGE
   ══════════════════════════════════════════════════════════════════════ */

export interface BadgeProps {
  variant?: "default" | "primary" | "accent" | "success" | "warning" | "danger" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  className = "",
  children,
}: BadgeProps) {
  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
  };

  const variantStyles = {
    default: "bg-black/[.05] dark:bg-white/[.08] text-ink border border-black/[.06] dark:border-white/[.08]",
    primary: "bg-moss/10 dark:bg-primary/15 text-moss dark:text-primary font-semibold border border-moss/20 dark:border-primary/25",
    accent: "bg-accent/30 dark:bg-accent/20 text-ink dark:text-white font-semibold border border-accent/40 dark:border-accent/30",
    success: "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/25",
    warning: "bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold border border-amber-500/25",
    danger: "bg-red-500/10 dark:bg-red-500/15 text-red-800 dark:text-red-300 font-semibold border border-red-500/25",
    outline: "border border-black/15 dark:border-white/15 text-ink",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide uppercase ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-85" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   8. MODAL
   ══════════════════════════════════════════════════════════════════════ */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className = "",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/50 dark:bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-surface p-6 sm:p-8 text-ink shadow-soft transition-all duration-200 z-10 ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-5 top-5 grid size-8 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink transition"
        >
          <X size={18} />
        </button>

        {title && (
          <div className="mb-5 pr-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="text-sm font-normal text-ink/90 leading-relaxed">{children}</div>

        {footer && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-black/[.08] dark:border-white/[.08] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   9. DROPDOWN
   ══════════════════════════════════════════════════════════════════════ */

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({ trigger, children, align = "right", className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <div onClick={() => setOpen((prev) => !prev)}>{trigger}</div>
      {open && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } z-40 mt-2 w-56 origin-top rounded-2xl border border-black/10 dark:border-white/10 bg-surface py-2 shadow-soft focus:outline-none`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   10. NOTICE & ERROR STATE
   ══════════════════════════════════════════════════════════════════════ */

export function Notice({
  children,
  variant = "error",
}: PropsWithChildren<{ variant?: "error" | "success" | "info" }>) {
  const styles = {
    error:
      "border-l-red-600 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200 dark:border-l-red-500",
    success:
      "border-l-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-l-emerald-500",
    info:
      "border-l-moss bg-paper text-ink dark:border-l-primary dark:bg-surface-elevated",
  };

  const icons = {
    error: <AlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />,
    success: <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />,
    info: <Info size={18} className="shrink-0 text-moss dark:text-primary mt-0.5" />,
  };

  return (
    <div
      role="status"
      className={`rounded-r-xl border-l-4 px-5 py-4 text-sm font-medium shadow-sm leading-relaxed flex items-start gap-3 ${styles[variant]}`}
    >
      {icons[variant]}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-8 text-center ${className}`}
    >
      <div className="mx-auto mb-3.5 grid size-12 place-items-center rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
        <AlertCircle size={24} />
      </div>
      <h3 className="font-display text-xl font-bold text-red-900 dark:text-red-200 sm:text-2xl">
        {title}
      </h3>
      {message && (
        <p className="mx-auto mt-2 max-w-md text-sm text-red-700 dark:text-red-300/80 leading-relaxed">
          {message}
        </p>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button variant="danger" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   11. LOADING & SKELETON LOADERS (ACCESSIBLE, THEME-AWARE, SHIMMER)
   ══════════════════════════════════════════════════════════════════════ */

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-20 text-muted" role="status">
      <LoaderCircle className="animate-spin text-moss dark:text-primary" size={32} />
      <span className="font-display italic text-base tracking-wide text-ink/75">{label}</span>
    </div>
  );
}

export const LoadingState = Loading;

export function SkeletonBox({
  className = "",
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${rounded} ${className}`}
    />
  );
}

export function PostCardSkeleton({
  variant = "standard",
  count = 1,
  className = "",
}: {
  variant?: "standard" | "featured" | "compact" | "spotlight";
  count?: number;
  className?: string;
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === "featured") {
    return (
      <div
        role="status"
        aria-label="Loading featured story..."
        className={`rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card overflow-hidden lg:grid lg:grid-cols-12 ${className}`}
      >
        <span className="sr-only">Loading featured story...</span>
        <div className="lg:col-span-7 min-h-[300px] sm:min-h-[360px] lg:min-h-[460px] relative p-6 flex flex-col justify-between">
          <SkeletonBox className="absolute inset-0 size-full" rounded="rounded-none" />
          <div className="relative z-10 flex items-center gap-2">
            <SkeletonBox className="h-6 w-24" rounded="rounded-full" />
            <SkeletonBox className="h-6 w-36" rounded="rounded-full" />
          </div>
        </div>
        <div className="lg:col-span-5 p-7 sm:p-10 lg:p-10 xl:p-12 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SkeletonBox className="size-6" rounded="rounded-full" />
              <SkeletonBox className="h-4 w-28" />
              <SkeletonBox className="h-4 w-20" />
            </div>
            <SkeletonBox className="h-9 w-full" />
            <SkeletonBox className="h-9 w-4/5" />
            <div className="space-y-2 pt-2">
              <SkeletonBox className="h-4 w-full" />
              <SkeletonBox className="h-4 w-full" />
              <SkeletonBox className="h-4 w-3/4" />
            </div>
            <div className="flex gap-2 pt-3">
              <SkeletonBox className="h-5 w-16" rounded="rounded-full" />
              <SkeletonBox className="h-5 w-20" rounded="rounded-full" />
            </div>
          </div>
          <div className="border-t border-black/[.08] dark:border-white/[.08] pt-5 flex items-center justify-between">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div role="status" aria-label="Loading curated stories..." className={`divide-y divide-black/[.06] dark:divide-white/[.06] ${className}`}>
        <span className="sr-only">Loading stories...</span>
        {items.map((i) => (
          <div key={i} className="group flex gap-4 py-4 items-start">
            <SkeletonBox className="h-7 w-6 shrink-0" rounded="rounded" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-3 w-28" />
              <SkeletonBox className="h-4 w-full" />
              <SkeletonBox className="h-4 w-3/4" />
              <SkeletonBox className="h-3 w-32" />
            </div>
            <SkeletonBox className="size-16 shrink-0" rounded="rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "spotlight") {
    return (
      <div
        role="status"
        aria-label="Loading spotlight story..."
        className={`rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface-elevated p-6 sm:p-10 shadow-card md:grid md:grid-cols-12 md:gap-8 md:items-center ${className}`}
      >
        <span className="sr-only">Loading spotlight story...</span>
        <div className="md:col-span-7 space-y-4">
          <SkeletonBox className="h-5 w-32" rounded="rounded-full" />
          <SkeletonBox className="h-8 w-4/5" />
          <SkeletonBox className="h-4 w-full" />
          <SkeletonBox className="h-4 w-3/4" />
          <div className="pt-2 flex items-center gap-3">
            <SkeletonBox className="h-9 w-32" rounded="rounded-full" />
            <SkeletonBox className="h-4 w-24" />
          </div>
        </div>
        <div className="mt-6 md:mt-0 md:col-span-5 aspect-[16/10]">
          <SkeletonBox className="size-full" rounded="rounded-2xl" />
        </div>
      </div>
    );
  }

  // Standard Grid Card
  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading story..."
          className={`flex flex-col justify-between overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card ${className}`}
        >
          <span className="sr-only">Loading story...</span>
          <div>
            <div className="relative aspect-[16/10] w-full">
              <SkeletonBox className="size-full" rounded="rounded-none" />
              <div className="absolute left-4 top-4">
                <SkeletonBox className="h-6 w-20" rounded="rounded-full" />
              </div>
            </div>
            <div className="p-6 sm:p-7 space-y-4">
              <div className="flex items-center gap-2">
                <SkeletonBox className="size-5" rounded="rounded-full" />
                <SkeletonBox className="h-3.5 w-24" />
                <SkeletonBox className="h-3.5 w-16" />
              </div>
              <SkeletonBox className="h-6 w-full" />
              <SkeletonBox className="h-6 w-3/4" />
              <div className="space-y-1.5 pt-1">
                <SkeletonBox className="h-3.5 w-full" />
                <SkeletonBox className="h-3.5 w-4/5" />
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-7 pt-0 border-t border-black/[.06] dark:border-white/[.06] mt-4 flex items-center justify-between pt-4">
            <SkeletonBox className="h-4 w-20" />
            <SkeletonBox className="h-4 w-24" />
          </div>
        </div>
      ))}
    </>
  );
}

export function HeroSkeleton() {
  return (
    <div role="status" aria-label="Loading front page edition..." className="space-y-8">
      <span className="sr-only">Loading front page...</span>
      {/* Editorial Top Headline Banner Skeleton */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-black/10 dark:border-white/10 pb-4 gap-4">
        <div className="space-y-2">
          <SkeletonBox className="h-4 w-44" />
          <SkeletonBox className="h-12 w-80 sm:w-96" />
        </div>
        <SkeletonBox className="h-10 w-full sm:w-80" rounded="rounded-xl" />
      </div>

      {/* Asymmetric 7/5 Grid */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <PostCardSkeleton variant="featured" />
        </div>
        <div className="lg:col-span-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 sm:p-8 shadow-card space-y-4">
          <div className="border-b border-black/[.08] dark:border-white/[.08] pb-3 mb-3 flex justify-between items-center">
            <SkeletonBox className="h-4 w-36" />
            <SkeletonBox className="h-3 w-24" />
          </div>
          <PostCardSkeleton variant="compact" count={3} />
          <div className="border-t border-black/[.08] dark:border-white/[.08] pt-4 flex justify-between items-center">
            <SkeletonBox className="h-3 w-32" />
            <SkeletonBox className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const rowItems = Array.from({ length: rows }, (_, i) => i);
  const colItems = Array.from({ length: cols }, (_, i) => i);

  return (
    <div
      role="status"
      aria-label="Loading records..."
      className={`overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft ${className}`}
    >
      <span className="sr-only">Loading records...</span>
      <div className="border-b border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-background/60 px-6 py-4 flex gap-4">
        {colItems.map((c) => (
          <SkeletonBox
            key={c}
            className={`h-4 ${c === 0 ? "w-40" : c === cols - 1 ? "w-20 ml-auto" : "w-28 hidden sm:block"}`}
          />
        ))}
      </div>
      <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
        {rowItems.map((r) => (
          <div key={r} className="px-6 py-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-5 w-48 sm:w-64" />
              <SkeletonBox className="h-3 w-32" />
            </div>
            {cols > 2 && (
              <div className="hidden sm:block flex-1">
                <SkeletonBox className="h-4 w-36" />
              </div>
            )}
            <SkeletonBox className="h-6 w-20" rounded="rounded-full" />
            <SkeletonBox className="h-8 w-24" rounded="rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArticleDetailSkeleton() {
  return (
    <article role="status" aria-label="Loading article..." className="mx-auto max-w-4xl space-y-8 py-6">
      <span className="sr-only">Loading article...</span>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-6 w-24" rounded="rounded-full" />
          <SkeletonBox className="h-4 w-32" />
        </div>
        <SkeletonBox className="h-12 w-full" />
        <SkeletonBox className="h-12 w-4/5" />
        <div className="flex items-center gap-3 pt-3 border-b border-black/[.08] dark:border-white/[.08] pb-6">
          <SkeletonBox className="size-10" rounded="rounded-full" />
          <div className="space-y-1.5">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-3 w-36" />
          </div>
        </div>
      </div>
      <SkeletonBox className="aspect-[16/9] w-full" rounded="rounded-3xl" />
      <SkeletonBox className="h-14 w-full" rounded="rounded-2xl" />
      <div className="space-y-4 pt-4">
        <SkeletonBox className="h-5 w-full" />
        <SkeletonBox className="h-5 w-full" />
        <SkeletonBox className="h-5 w-11/12" />
        <SkeletonBox className="h-5 w-full" />
        <SkeletonBox className="h-5 w-4/5" />
      </div>
    </article>
  );
}

export function TableContainer({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`overflow-x-auto rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft ${className}`}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   12. EMPTY STATE
   ══════════════════════════════════════════════════════════════════════ */

export function EmptyState({
  title,
  icon,
  action,
  children,
  className = "",
}: PropsWithChildren<{
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={`rounded-3xl border-2 border-dashed border-black/15 dark:border-white/15 bg-surface/80 px-8 py-16 text-center shadow-soft ${className}`}
    >
      {icon && <div className="mx-auto mb-4 grid size-12 place-items-center text-muted">{icon}</div>}
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {children && (
        <div className="mx-auto mt-3 max-w-lg text-base font-normal leading-relaxed text-muted">
          {children}
        </div>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   13. PAGINATION
   ══════════════════════════════════════════════════════════════════════ */

export function Pagination({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 0) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const getPageNumbers = () => {
    if (pages <= 5) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }
    const delta = 1;
    const range: (number | string)[] = [];
    const left = Math.max(2, page - delta);
    const right = Math.min(pages - 1, page + delta);

    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) {
      range.push(i);
    }
    if (right < pages - 1) range.push("...");
    range.push(pages);
    return range;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="mt-8 flex flex-col gap-4 border-t border-black/[.08] dark:border-white/[.08] pt-6 sm:flex-row sm:items-center sm:justify-between text-sm text-muted">
      <div className="font-medium text-ink/70">
        Showing <span className="font-semibold text-ink">{from}–{to}</span> of{" "}
        <span className="font-semibold text-ink">{total}</span> records · Page{" "}
        <span className="font-semibold text-ink">{page}</span> of{" "}
        <span className="font-semibold text-ink">{pages}</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="uppercase tracking-wider"
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) =>
            typeof p === "number" ? (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(p)}
                className={`grid size-9 place-items-center rounded-lg text-sm font-semibold transition ${
                  p === page
                    ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                    : "border border-black/10 dark:border-white/10 bg-surface text-ink hover:border-moss/40 hover:bg-paper"
                }`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-muted">
                {p}
              </span>
            )
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="uppercase tracking-wider"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   14. DATE RANGE FILTER
   ══════════════════════════════════════════════════════════════════════ */

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        <label className="font-mono text-muted uppercase tracking-wider text-[11px]">From</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="font-mono text-muted uppercase tracking-wider text-[11px]">To</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
        />
      </div>
      {(startDate || endDate) && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted hover:text-ink underline underline-offset-2 ml-1"
        >
          Reset Dates
        </button>
      )}
    </div>
  );
}
