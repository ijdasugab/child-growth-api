import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createRefreshToken, getRefreshTokenExpiry, signAccessToken } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireStrictAuth } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit.js";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(150),
  password: z.string().min(8),
  phoneNumber: z.string().max(30).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

// P0-6: batasi percobaan login dan register. Tanpa ini password bisa ditebak
// ribuan kali per menit, dan bcrypt 10 round sudah cukup membuat server sibuk.
//
// Kuncinya gabungan email + IP asal, bukan IP saja. Alasannya: seluruh lalu
// lintas dari natababy.online masuk lewat tunnel Cloudflare, jadi IP yang
// terlihat server selalu sama. Kalau kuncinya hanya IP, satu penyerang bisa
// menghabiskan kuota dan ikut mengunci pemilik akun yang sah.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
  keyGenerator: (req) => {
    const body = (req.body ?? {}) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    // Cloudflare menaruh IP asli di cf-connecting-ip. Kalau tidak ada, pakai
    // hop pertama X-Forwarded-For, lalu jatuh ke req.ip.
    const forwarded = req.get("cf-connecting-ip")
      ?? req.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.ip
      ?? "unknown";
    return `${email || "-"}|${forwarded}`;
  }
});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          fullName: body.fullName,
          email: body.email.toLowerCase(),
          passwordHash,
          phoneNumber: body.phoneNumber
        }
      });

      const parentRole = await tx.role.findUniqueOrThrow({ where: { code: "PARENT" } });
      await tx.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: parentRole.id
        }
      });

      return createdUser;
    });

    const roles = ["PARENT"];
    const refreshToken = createRefreshToken();
    await prisma.userRefreshToken.create({
      data: {
        userId: user.id,
        refreshToken,
        expiredAt: getRefreshTokenExpiry()
      }
    });

    req.user = { id: user.id, email: user.email, roles };
    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "users",
      recordId: user.id,
      newData: { id: user.id, email: user.email, roles }
    });

    sendJson(res, {
      accessToken: signAccessToken({ userId: user.id, email: user.email, roles }),
      refreshToken,
      user: toPublicUser(user, roles)
    }, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { userRoles: { include: { role: true } } }
    });

    if (!user || user.isActive === false) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const roles = user.userRoles.map((userRole) => userRole.role.code);
    const refreshToken = createRefreshToken();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }),
      prisma.userRefreshToken.create({
        data: {
          userId: user.id,
          refreshToken,
          expiredAt: getRefreshTokenExpiry()
        }
      })
    ]);

    req.user = { id: user.id, email: user.email, roles };
    await writeAuditLog(req, { action: "LOGIN", tableName: "users", recordId: user.id });

    sendJson(res, {
      accessToken: signAccessToken({ userId: user.id, email: user.email, roles }),
      refreshToken,
      user: toPublicUser(user, roles)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const existingToken = await prisma.userRefreshToken.findFirst({
      where: {
        refreshToken: body.refreshToken,
        revokedAt: null,
        expiredAt: { gt: new Date() }
      },
      include: {
        user: {
          include: { userRoles: { include: { role: true } } }
        }
      }
    });

    if (!existingToken || existingToken.user.isActive === false) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const roles = existingToken.user.userRoles.map((userRole) => userRole.role.code);

    // P1-5: rotasi. Token lama dicabut, token baru diterbitkan, dalam satu
    // transaksi. Tanpa ini satu token bocor bisa dipakai 30 hari penuh.
    const nextRefreshToken = createRefreshToken();
    await prisma.$transaction([
      prisma.userRefreshToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date() }
      }),
      prisma.userRefreshToken.create({
        data: {
          userId: existingToken.userId,
          refreshToken: nextRefreshToken,
          expiredAt: getRefreshTokenExpiry()
        }
      })
    ]);

    sendJson(res, {
      accessToken: signAccessToken({
        userId: existingToken.user.id,
        email: existingToken.user.email,
        roles
      }),
      refreshToken: nextRefreshToken
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    await prisma.userRefreshToken.updateMany({
      where: {
        userId: req.user!.id,
        refreshToken: body.refreshToken,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    await writeAuditLog(req, { action: "LOGOUT", tableName: "users", recordId: req.user!.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { userRoles: { include: { role: true } } }
    });

    sendJson(res, toPublicUser(user, user.userRoles.map((userRole) => userRole.role.code)));
  } catch (error) {
    next(error);
  }
});

function toPublicUser(user: { id: bigint; fullName: string; email: string; phoneNumber: string | null; isActive: boolean | null }, roles: string[]) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    isActive: user.isActive,
    roles
  };
}

export { router as authRouter };
