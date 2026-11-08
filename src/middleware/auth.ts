import type { RequestHandler } from "express";
import { isAdminRole, verifyAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  // P0-1: tidak ada token berarti tidak ada identitas. Dulu di sini dibuat
  // peran GUEST yang bisa membaca semua data anak.
  if (!token) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  if (token.split(".").length !== 3) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch (_error) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { userRoles: { include: { role: true } } }
    });

    if (!user || user.isActive === false) {
      res.status(401).json({ message: "Invalid user" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      roles: user.userRoles.map((userRole) => userRole.role.code)
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireStrictAuth: RequestHandler = (req, res, next) => {
  // Peran GUEST sudah tidak pernah terbentuk, jadi cukup periksa identitas.
  if (!req.user) {
    res.status(401).json({ message: "Missing or invalid bearer token" });
    return;
  }

  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user || !isAdminRole(req.user.roles)) {
    res.status(403).json({ message: "Admin role required" });
    return;
  }

  next();
};
