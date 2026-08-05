import { Router } from "express";
import { z } from "zod";
import { ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { childIdParamSchema, dateString, idParamSchema } from "../lib/validation.js";

const router = Router({ mergeParams: true });

const immunizationSchema = z.object({
  immunizationMasterId: z.coerce.bigint().positive().optional(),
  givenDate: dateString.optional(),
  location: z.string().max(150).optional(),
  notes: z.string().optional()
});

router.get("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const data = await prisma.childImmunization.findMany({
      where: { childId },
      include: { immunizationMaster: true },
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

    const body = immunizationSchema.parse(req.body);
    const data = await prisma.childImmunization.create({
      data: {
        childId,
        immunizationMasterId: body.immunizationMasterId,
        givenDate: body.givenDate ? new Date(body.givenDate) : undefined,
        location: body.location,
        notes: body.notes,
        createdBy: req.user!.id,
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "child_immunizations",
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

    const body = immunizationSchema.partial().parse(req.body);
    const oldData = await prisma.childImmunization.findFirstOrThrow({ where: { id, childId } });
    const data = await prisma.childImmunization.update({
      where: { id },
      data: {
        immunizationMasterId: body.immunizationMasterId,
        givenDate: body.givenDate ? new Date(body.givenDate) : undefined,
        location: body.location,
        notes: body.notes,
        updatedAt: new Date(),
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "UPDATE",
      tableName: "child_immunizations",
      recordId: data.id,
      oldData,
      newData: data
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

export { router as immunizationsRouter };
