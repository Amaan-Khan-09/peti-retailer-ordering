export class ApiError extends Error {
  constructor(message: string, public status: number, public details: string[] = []) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("No connection. Check your internet and try again.", 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data?.detail;
    if (typeof detail === "string") throw new ApiError(detail, response.status);
    if (detail?.message) throw new ApiError(detail.message, response.status, detail.errors ?? []);
    if (Array.isArray(detail)) throw new ApiError("Please check the highlighted fields.", response.status, detail.map((d: { msg: string }) => d.msg));
    throw new ApiError("Something went wrong. Please try again.", response.status);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  async download(path: string, body: unknown): Promise<number> {
    const response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(typeof data.detail === "string" ? data.detail : "Export failed", response.status);
    }
    const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "export";
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    link.click();
    URL.revokeObjectURL(url);
    return Number(response.headers.get("X-Exported-Count") ?? 0);
  },
};
