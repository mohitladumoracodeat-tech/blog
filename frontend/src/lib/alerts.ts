import Swal, { type SweetAlertIcon, type SweetAlertOptions, type SweetAlertResult } from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { getErrorMessage } from "./api";

/**
 * Modern Editorial Theme Detection
 */
function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark"
  );
}

/**
 * Shared editorial styling defaults for SweetAlert2
 */
function getEditorialSwalConfig(isDestructive = false): SweetAlertOptions {
  const dark = isDarkMode();

  return {
    buttonsStyling: false,
    reverseButtons: true, // Cancel on left, Confirm on right
    focusCancel: isDestructive, // Focus cancel by default on destructive actions for safety
    showCancelButton: false,
    background: dark ? "#222925" : "#FFFFFF",
    color: dark ? "#F1F0E9" : "#242824",
    customClass: {
      popup: "fieldnotes-swal-popup",
      title: "fieldnotes-swal-title",
      htmlContainer: "fieldnotes-swal-html",
      actions: "fieldnotes-swal-actions",
      confirmButton: isDestructive
        ? "fieldnotes-swal-btn fieldnotes-swal-btn-danger"
        : "fieldnotes-swal-btn fieldnotes-swal-btn-primary",
      cancelButton: "fieldnotes-swal-btn fieldnotes-swal-btn-cancel",
      denyButton: "fieldnotes-swal-btn fieldnotes-swal-btn-deny",
      input: "fieldnotes-swal-input",
      loader: "fieldnotes-swal-loader",
    },
  };
}

export interface ConfirmOptions {
  title: string;
  text?: string;
  html?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
  isDestructive?: boolean;
}

export interface PromptOptions {
  title: string;
  text?: string;
  placeholder?: string;
  inputValue?: string;
  inputLabel?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  requiredMessage?: string;
  inputType?: "text" | "textarea" | "email" | "password";
  isDestructive?: boolean;
}

export interface ToastOptions {
  title: string;
  text?: string;
  icon?: SweetAlertIcon;
  timer?: number;
}

/**
 * Explicit Confirmation for Destructive Actions (Delete, Remove, Reject)
 * Requires user to explicitly click confirm button.
 */
export async function confirmDestructive(options: {
  title: string;
  text?: string;
  html?: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  const baseConfig = getEditorialSwalConfig(true);
  const result = await Swal.fire({
    ...baseConfig,
    title: options.title,
    text: options.text,
    html: options.html,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmText || "Delete Permanently",
    cancelButtonText: options.cancelText || "Cancel",
  });

  return result.isConfirmed === true;
}

/**
 * Explicit Confirmation for Significant Actions (Publish, Submit, Status Change, Sign Out)
 */
export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const isDestructive = options.isDestructive ?? false;
  const baseConfig = getEditorialSwalConfig(isDestructive);

  const result = await Swal.fire({
    ...baseConfig,
    title: options.title,
    text: options.text,
    html: options.html,
    icon: options.icon ?? "question",
    showCancelButton: true,
    confirmButtonText: options.confirmText || "Confirm",
    cancelButtonText: options.cancelText || "Cancel",
  });

  return result.isConfirmed === true;
}

/**
 * Editorial Success Notification
 */
export async function showSuccess(
  title: string,
  text?: string,
  timer?: number
): Promise<SweetAlertResult> {
  const baseConfig = getEditorialSwalConfig(false);

  return Swal.fire({
    ...baseConfig,
    title,
    text,
    icon: "success",
    timer: timer ?? 3000,
    timerProgressBar: true,
    showConfirmButton: !timer,
    confirmButtonText: "Done",
  });
}

/**
 * Editorial Error Notification
 * Accepts error strings or Axios/generic caught error objects.
 */
export async function showError(
  title: string,
  errorOrMessage?: unknown
): Promise<SweetAlertResult> {
  const baseConfig = getEditorialSwalConfig(true);
  const text =
    typeof errorOrMessage === "string"
      ? errorOrMessage
      : getErrorMessage(errorOrMessage);

  return Swal.fire({
    ...baseConfig,
    title,
    text: text || "An unexpected error occurred. Please try again.",
    icon: "error",
    showConfirmButton: true,
    confirmButtonText: "Dismiss",
  });
}

/**
 * Editorial Warning Notification
 */
export async function showWarning(
  title: string,
  text?: string
): Promise<SweetAlertResult> {
  const baseConfig = getEditorialSwalConfig(false);

  return Swal.fire({
    ...baseConfig,
    title,
    text,
    icon: "warning",
    showConfirmButton: true,
    confirmButtonText: "Understood",
  });
}

/**
 * Editorial Information Notification
 */
export async function showInfo(
  title: string,
  text?: string
): Promise<SweetAlertResult> {
  const baseConfig = getEditorialSwalConfig(false);

  return Swal.fire({
    ...baseConfig,
    title,
    text,
    icon: "info",
    showConfirmButton: true,
    confirmButtonText: "Close",
  });
}

/**
 * Reusable Editorial Prompt Dialog replacing native window.prompt()
 */
export async function promptInput(options: PromptOptions): Promise<string | null> {
  const baseConfig = getEditorialSwalConfig(options.isDestructive);

  const result = await Swal.fire({
    ...baseConfig,
    title: options.title,
    text: options.text,
    input: options.inputType ?? "textarea",
    inputLabel: options.inputLabel,
    inputPlaceholder: options.placeholder ?? "Type your input...",
    inputValue: options.inputValue ?? "",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Submit",
    cancelButtonText: options.cancelText ?? "Cancel",
    inputValidator: (value: string) => {
      if (options.required && (!value || !value.trim())) {
        return options.requiredMessage ?? "This field cannot be empty.";
      }
      return null;
    },
  });

  if (result.isConfirmed && typeof result.value === "string") {
    return result.value.trim();
  }
  return null;
}

/**
 * Non-intrusive Toast Notification (Top-End Auto-Dismiss)
 */
export function showToast(options: ToastOptions | string): void {
  const dark = isDarkMode();
  const config = typeof options === "string" ? { title: options } : options;

  const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: config.timer ?? 2500,
    timerProgressBar: true,
    background: dark ? "#222925" : "#FFFFFF",
    color: dark ? "#F1F0E9" : "#242824",
    customClass: {
      popup: "fieldnotes-swal-toast",
      title: "fieldnotes-swal-toast-title",
    },
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
  });

  void Toast.fire({
    icon: config.icon ?? "success",
    title: config.title,
    text: config.text,
  });
}

/**
 * Loading indicator preventing duplicate submissions during ongoing operations
 */
export function showLoading(title = "Processing...", text = "Please wait a moment."): void {
  const baseConfig = getEditorialSwalConfig(false);

  void Swal.fire({
    ...baseConfig,
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

/**
 * Close any active loading / alert dialog
 */
export function closeAlert(): void {
  Swal.close();
}

/**
 * Global Fallback Interceptor
 * Injects safe SweetAlert2 fallbacks for native window dialogs.
 */
if (typeof window !== "undefined") {
  window.alert = (message?: any) => {
    void showInfo("Notice", String(message ?? ""));
  };
}
