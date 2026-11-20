import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === "string") return message;
    if (!error.response) return "Could not reach the server. Check that the backend is running.";
  }
  return "Something went wrong. Please try again.";
}

export function unwrap<T>(value: { data: T }): T {
  return value.data;
}

export function imageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    try {
      const origin = new URL(apiUrl, window.location.origin).origin;
      return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
    } catch {
      return path;
    }
  }
  return path;
}
