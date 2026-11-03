import { Router } from "express";
import { z } from "zod";
import { canAccessChild, ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { isAdminRole } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { dateString, idParamSchema, optionalDecimal } from "../lib/validation.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

const childBodySchema = z.object({
  fullName: z.string().min(1).max(100),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: dateString,
  birthWeightKg: optionalDecimal,
  birthLengthCm: optionalDecimal,
  ownerUserId: z.coerce.bigint().positive().optional(),
  relation: z.string().max(50).optional()
});

router.get("/", async (req, res, next) => {
  try {
    const where = isAdminRole(req.user!.roles) || req.user!.roles.includes("GUEST")
      ? {}
      : { userChildren: { some: { userId: req.user!.id } } };

    const children = await prisma.child.findMany({
      where,
      orderBy: { id: "asc" },
      include: { userChildren: { include: { user: true } } }
    });

    sendJson(res, children.map(toChildResponse));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = childBodySchema.parse(req.body);
    const ownerUserId = isAdminRole(req.user!.roles) ? body.ownerUserId ?? req.user!.id : req.user!.id;

    const child = await prisma.$transaction(async (tx) => {
      const createdChild = await tx.child.create({
        data: {
          fullName: body.fullName,
          gender: body.gender,
          birthDate: new Date(body.birthDate),
          birthWeightKg: body.birthWeightKg,
          birthLengthCm: body.birthLengthCm,
          createdBy: req.user!.id,
          updatedBy: req.user!.id
        }
      });

      await tx.userChild.create({
        data: {
          userId: ownerUserId,
          childId: createdChild.id,
          relation: body.relation ?? "PARENT"
        }
      });

      return tx.child.findUniqueOrThrow({
        where: { id: createdChild.id },
        include: { userChildren: { include: { user: true } } }
      });
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "children",
      recordId: child.id,
      newData: toChildResponse(child)
    });

    sendJson(res, toChildResponse(child), 201);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, id);

    const child = await prisma.child.findUniqueOrThrow({
      where: { id },
      include: {
        measurements: { orderBy: { measuredAt: "desc" } },
        reminders: { orderBy: { reminderDate: "asc" } },
        userChildren: { include: { user: true } }
      }
    });

    sendJson(res, toChildResponse(child));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, id);

    const body = childBodySchema.partial().parse(req.body);
    const oldChild = await prisma.child.findUniqueOrThrow({ where: { id } });
    const child = await prisma.child.update({
      where: { id },
      data: {
        fullName: body.fullName,
        gender: body.gender,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        birthWeightKg: body.birthWeightKg,
        birthLengthCm: body.birthLengthCm,
        updatedAt: new Date(),
        updatedBy: req.user!.id
      },
      include: { userChildren: { include: { user: true } } }
    });

    await writeAuditLog(req, {
      action: "UPDATE",
      tableName: "children",
      recordId: child.id,
      oldData: oldChild,
      newData: child
    });

    sendJson(res, toChildResponse(child));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, id);

    const oldChild = await prisma.child.findUniqueOrThrow({ where: { id } });
    await prisma.child.delete({ where: { id } });
    await writeAuditLog(req, {
      action: "DELETE",
      tableName: "children",
      recordId: id,
      oldData: oldChild
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/users", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    if (!isAdminRole(req.user!.roles) && !(await canAccessChild(req.user!, id))) {
      res.status(403).json({ message: "Child access denied" });
      return;
    }

    const body = z.object({
      userId: z.coerce.bigint().positive(),
      relation: z.string().max(50).optional()
    }).parse(req.body);

    const userChild = await prisma.userChild.upsert({
      where: {
        userId_childId: {
          userId: body.userId,
          childId: id
        }
      },
      update: { relation: body.relation },
      create: {
        userId: body.userId,
        childId: id,
        relation: body.relation
      },
      include: { user: true, child: true }
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "user_children",
      recordId: userChild.id,
      newData: userChild
    });

    sendJson(res, userChild, 201);
  } catch (error) {
    next(error);
  }
});

function toChildResponse(child: {
  id: bigint;
  fullName: string;
  gender: string;
  birthDate: Date;
  birthWeightKg: unknown;
  birthLengthCm: unknown;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: bigint | null;
  updatedBy: bigint | null;
  measurements?: unknown[];
  reminders?: unknown[];
  userChildren?: Array<{ relation: string | null; user: { id: bigint; fullName: string; email: string } }>;
}) {
  return {
    ...child,
    users: child.userChildren?.map((userChild) => ({
      relation: userChild.relation,
      user: {
        id: userChild.user.id,
        fullName: userChild.user.fullName,
        email: userChild.user.email
      }
    })),
    userChildren: undefined
  };
}

export { router as childrenRouter };
