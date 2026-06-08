import { getLocalAuthToken, isLocalAuthMode } from "@/auth/localAuth";
import { getApiBaseUrl } from "@/lib/api-base";

type ClerkSession = {
  getToken: () => Promise<string>;
};

type ClerkGlobal = {
  session?: ClerkSession | null;
};

const resolveAuthHeaders = async (): Promise<Headers> => {
  const headers = new Headers();
  if (isLocalAuthMode()) {
    const token = getLocalAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }
  if (typeof window === "undefined") {
    return headers;
  }
  const clerk = (window as unknown as { Clerk?: ClerkGlobal }).Clerk;
  if (!clerk?.session) {
    return headers;
  }
  try {
    const token = await clerk.session.getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    // Ignore token resolution failures; caller handles 401 responses.
  }
  return headers;
};

export const resolveApiUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  return `${baseUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
};

export async function fetchWithAuth(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const authHeaders = await resolveAuthHeaders();
  authHeaders.forEach((value, key) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });
  return fetch(resolveApiUrl(pathOrUrl), {
    ...init,
    headers,
  });
}

export async function fetchAuthenticatedBlob(pathOrUrl: string): Promise<string> {
  const response = await fetchWithAuth(pathOrUrl);
  if (!response.ok) {
    throw new Error("Unable to load attachment.");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export const TASK_ATTACHMENT_PATH_PATTERN =
  /\/api\/v1\/boards\/[^/]+\/tasks\/attachments\/[^/?#]+/;

export function isTaskAttachmentUrl(src: string): boolean {
  return TASK_ATTACHMENT_PATH_PATTERN.test(src);
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function downloadTaskAttachment(
  pathOrUrl: string,
  suggestedFilename?: string,
): Promise<void> {
  const response = await fetchWithAuth(pathOrUrl);
  if (!response.ok) {
    throw new Error("Unable to download attachment.");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const filename =
    suggestedFilename?.trim() ||
    filenameFromContentDisposition(response.headers.get("content-disposition")) ||
    "attachment";
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
