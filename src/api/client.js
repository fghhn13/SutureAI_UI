/**
 * Thin fetch wrapper for the FastAPI backend (`/api/*`, proxied by Vite in dev).
 * Auth is an httpOnly session cookie, so no token handling here.
 * Every request carries the UI language as Accept-Language (zh-CN or en).
 */
import { apiLanguage } from "../i18n/locale.js";
import { t } from "../i18n/translate.js";

const API_ROOT = `${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/api`;

export class ApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Resolve an API path (e.g. "/sessions/1/video") or an already-absolute "/api/..." URL. */
export function apiUrl(path) {
  if (path.startsWith("/api/")) return `${API_ROOT}${path.slice(4)}`;
  return `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}

async function errorFromResponse(res) {
  let message = t("api.requestFailed", { status: res.status });
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") message = body.detail;
    else if (Array.isArray(body?.detail) && body.detail[0]?.msg) message = body.detail[0].msg;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, message);
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal }} [opts]
 */
export async function api(path, { method = "GET", body, signal } = {}) {
  const res = await fetch(apiUrl(path), {
    method,
    signal,
    credentials: "same-origin",
    headers: {
      "Accept-Language": apiLanguage(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await errorFromResponse(res);
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Multipart upload with progress (fetch has no upload progress events).
 * @param {string} path
 * @param {FormData} formData
 * @param {{ onProgress?: (fraction: number) => void, signal?: AbortSignal }} [opts]
 */
export function uploadWithProgress(path, formData, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(path));
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept-Language", apiLanguage());
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        const detail = typeof body?.detail === "string" ? body.detail : t("api.uploadFailed", { status: xhr.status });
        reject(new ApiError(xhr.status, detail));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, t("api.networkError")));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(formData);
  });
}
