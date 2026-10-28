export class OwnerAccessError extends Error {
  constructor(public reason: "login" | "configuration" | "unavailable") {
    super(reason);
  }
}
export async function readOwnerJSON<T>(response: Response): Promise<T> {
  const json = response.headers.get("content-type")?.includes("application/json");
  // Access can return a successful HTML login page after a redirect.
  if (response.redirected || !json) throw new OwnerAccessError("login");
  const payload: unknown = await response.json();
  const configurationMissing = payload && typeof payload === "object" && "configured" in payload && payload.configured === false;
  if (!response.ok) {
    throw new OwnerAccessError(configurationMissing ? "configuration" : response.status === 401 || response.status === 403 ? "login" : "unavailable");
  }
  return payload as T;
}
export function ownerAccessMessage(error: unknown): string {
  if (import.meta.env?.PROBE_READONLY_PREVIEW) return "当前是公开数据只读预览，无法读取真实成本和到期时间。请在已部署的探针域名完成所有者登录。";
  if (error instanceof OwnerAccessError && error.reason === "configuration") return "服务器尚未完成所有者认证配置：需要 Cloudflare Access 应用及 ACCESS_TEAM_DOMAIN、ACCESS_AUD、OWNER_EMAIL。";
  return "需要在探针域名完成 Cloudflare Access 所有者登录，登录主控不等于已登录探针。";
}
