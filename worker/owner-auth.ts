import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
export interface OwnerEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  OWNER_EMAIL?: string;
}
const keysets = new Map<string, JWTVerifyGetKey>();
export function ownerConfig(
  env: OwnerEnv,
): { issuer: string; audience: string; email: string } | undefined {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.OWNER_EMAIL) return;
  try {
    const team = new URL(env.ACCESS_TEAM_DOMAIN);
    if (
      team.protocol !== "https:" ||
      !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team.hostname) ||
      team.pathname !== "/" ||
      team.search ||
      team.hash ||
      team.port ||
      team.username ||
      team.password
    )
      return;
    return {
      issuer: team.origin,
      audience: env.ACCESS_AUD,
      email: env.OWNER_EMAIL.trim().toLowerCase(),
    };
  } catch {
    return;
  }
}
// Signature, issuer, audience, expiry AND the configured individual owner are
// required. A forged header, ordinary user, or unset config always fails closed.
export async function isOwner(
  request: Request,
  env: OwnerEnv,
  testKey?: JWTVerifyGetKey,
): Promise<boolean> {
  const config = ownerConfig(env);
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!config || !token) return false;
  try {
    let keys = testKey ?? keysets.get(config.issuer);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL(`${config.issuer}/cdn-cgi/access/certs`),
      );
      keysets.set(config.issuer, keys);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "email"],
    });
    return (
      typeof payload.email === "string" &&
      payload.email.toLowerCase() === config.email &&
      payload.type === "app"
    );
  } catch {
    return false;
  }
}
