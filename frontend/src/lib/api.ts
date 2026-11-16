export class ApiError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
export function token() { return typeof window === "undefined" ? null : sessionStorage.getItem("zayqora-token"); }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const session = token(); if (session) headers.set("Authorization", `Bearer ${session}`);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}${path}`, {...options, headers, cache: "no-store"});
  const data = await response.json().catch(() => ({detail: "Service returned an invalid response. Please retry."}));
  if (!response.ok) throw new ApiError(response.status, typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((e: {msg: string}) => e.msg).join("; ") : "Request failed. Please retry.", data.code);
  return data as T;
}
export const send = <T>(path: string, body?: unknown, method = "POST", headers?: HeadersInit) => api<T>(path, {method, body: body === undefined ? undefined : JSON.stringify(body), headers});
