import { toast } from "@/hooks/useToast";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public requestId?: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

const TOKEN_ERROR_CODES = ["TOKEN_EXPIRED", "TOKEN_INVALID", "UNAUTHORIZED", "HTTP_401"];

function handleTokenExpiration() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");

  try {
    localStorage.removeItem("auth-storage");
  } catch (err) {
    console.warn("Failed to clear auth-storage:", err);
  }

  toast.warning({ description: "Your session has expired. Please sign in again." });

  window.location.href = "/login";
}

interface RefreshResponse {
  access_token: string;
}

/** Attempts to refresh the access token using the stored refresh token. */
async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as RefreshResponse;
  if (data?.access_token) {
    localStorage.setItem("access_token", data.access_token);
    return data.access_token;
  }
  return null;
}

/** Sends an authenticated request. On token errors, retries once after refresh. */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    if (err instanceof Error) {
      throw new APIError(
        "NETWORK_ERROR",
        `Failed to connect to API: ${err.message}`,
        undefined,
        undefined,
      );
    }
    throw new APIError("NETWORK_ERROR", "Failed to connect to API", undefined, undefined);
  }

  if (!response.ok) {
    interface ErrorResponse {
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
        request_id?: string;
      };
    }
    let error: ErrorResponse = {};
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      error = (await response.json().catch((err) => {
        console.warn("Failed to parse error response body:", err);
        return {};
      })) as ErrorResponse;
    }

    const errorCode = error.error?.code || `HTTP_${response.status}`;
    const isTokenError = TOKEN_ERROR_CODES.includes(errorCode);

    if (
      isTokenError &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login" &&
      !isRetry
    ) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        return request<T>(endpoint, options, true);
      }
      handleTokenExpiration();
    }

    throw new APIError(
      errorCode,
      error.error?.message || `Request failed with status ${response.status}`,
      error.error?.details,
      error.error?.request_id,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) return null as T;

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn("Failed to parse API response:", err);
    return null as T;
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
