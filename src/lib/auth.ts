import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const accessTokenTtl = "15m";
const refreshTokenDays = 30;

export function signAccessToken(payload: { userId: bigint; email: string; roles: string[] }) {
  return jwt.sign(
    {
      sub: payload.userId.toString(),
      email: payload.email,
      roles: payload.roles
    },
    getJwtSecret(),
    { expiresIn: accessTokenTtl }
  );
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;

  return {
    userId: BigInt(payload.sub ?? 0),
    email: String(payload.email ?? ""),
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : []
  };
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function getRefreshTokenExpiry() {
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + refreshTokenDays);
  return expiredAt;
}

export function isAdminRole(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
}

function getJwtSecret() {
  return process.env.JWT_SECRET ?? "dev-only-change-me";
}
