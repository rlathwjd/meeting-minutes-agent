export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "요청을 처리하지 못했습니다.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
