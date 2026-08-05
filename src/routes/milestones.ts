import { Router } from "express";
import { z } from "zod";
import { ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { childIdParamSchema, dateString, idParamSchema } from "../lib/validation.js";

const router = Router({ mergeParams: true });

const milestoneSchema = z.object({
  milestoneMasterId: z.coerce.bigint().positive(),
  achieved: z.boolean().optional(),
  achievedDate: dateString.optional(),
  notes: z.string().optional()
});

router.get("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const data = await prisma.childMilestone.findMany({
      where: { childId },
      include: { milestoneMaster: true },
      orderBy: { id: "asc" }
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = milestoneSchema.parse(req.body);
    const data = await prisma.childMilestone.create({
      data: {
        childId,
        milestoneMasterId: body.milestoneMasterId,
        achieved: body.achieved,
        achievedDate: body.achievedDate ? new Date(body.achievedDate) : undefined,
        notes: body.notes,
        createdBy: req.user!.id,
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "child_milestones",
      recordId: data.id,
      newData: data
    });

    sendJson(res, data, 201);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = milestoneSchema.partial().parse(req.body);
    const oldData = await prisma.childMilestone.findFirstOrThrow({ where: { id, childId } });
    const data = await prisma.childMilestone.update({
      where: { id },
      data: {
        milestoneMasterId: body.milestoneMasterId,
        achieved: body.achieved,
        achievedDate: body.achievedDate ? new Date(body.achievedDate) : undefined,
        notes: body.notes,
        updatedAt: new Date(),
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "UPDATE",
      tableName: "child_milestones",
      recordId: data.id,
      oldData,
      newData: data
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

export { router as milestonesRouter };
