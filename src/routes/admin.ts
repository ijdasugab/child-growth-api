import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { idParamSchema } from "../lib/validation.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const adminUserSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(150),
  password: z.string().min(8),
  phoneNumber: z.string().max(30).optional(),
  roleCodes: z.array(z.enum(["SUPER_ADMIN", "ADMIN", "PARENT"])).min(1).default(["PARENT"])
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
  roleCodes: z.array(z.enum(["SUPER_ADMIN", "ADMIN", "PARENT"])).min(1).optional()
});

router.get("/roles", async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
    sendJson(res, roles);
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      include: { userRoles: { include: { role: true } } }
    });

    sendJson(res, users.map(toAdminUser));
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const body = adminUserSchema.parse(req.body);
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

      const roles = await tx.role.findMany({ where: { code: { in: body.roleCodes } } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: createdUser.id,
          roleId: role.id
        })),
        skipDuplicates: true
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: { userRoles: { include: { role: true } } }
      });
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "users",
      recordId: user.id,
      newData: toAdminUser(user)
    });

    sendJson(res, toAdminUser(user), 201);
  } catch (error) {
    next(error);
  }
});

router.put("/users/:id", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateUserSchema.parse(req.body);
    const oldUser = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: { userRoles: { include: { role: true } } }
    });

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          fullName: body.fullName,
          phoneNumber: body.phoneNumber,
          isActive: body.isActive,
          updatedAt: new Date()
        }
      });

      if (body.roleCodes) {
        const roles = await tx.role.findMany({ where: { code: { in: body.roleCodes } } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({
            userId: id,
            roleId: role.id
          })),
          skipDuplicates: true
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: { userRoles: { include: { role: true } } }
      });
    });

    await writeAuditLog(req, {
      action: "UPDATE",
      tableName: "users",
      recordId: user.id,
      oldData: toAdminUser(oldUser),
      newData: toAdminUser(user)
    });

    sendJson(res, toAdminUser(user));
  } catch (error) {
    next(error);
  }
});

router.get("/audit-logs", async (_req, res, next) => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { id: "desc" },
      take: 100
    });

    sendJson(res, auditLogs);
  } catch (error) {
    next(error);
  }
});

function toAdminUser(user: {
  id: bigint;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  userRoles: Array<{ role: { code: string; name: string } }>;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles.map((userRole) => userRole.role)
  };
}

export { router as adminRouter };
