import { Router } from "express";
import { z } from "zod";
import { ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { childIdParamSchema, dateString, idParamSchema, optionalDecimal } from "../lib/validation.js";

const router = Router({ mergeParams: true });

const measurementBodySchema = z.object({
  measuredAt: dateString,
  weightKg: optionalDecimal,
  heightCm: optionalDecimal,
  headCircumferenceCm: optionalDecimal,
  notes: z.string().optional(),
  weightForAgeStatus: z.string().max(50).optional(),
  heightForAgeStatus: z.string().max(50).optional(),
  weightForHeightStatus: z.string().max(50).optional(),
  headCircumferenceStatus: z.string().max(50).optional()
});

router.get("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const measurements = await prisma.childMeasurement.findMany({
      where: { childId },
      orderBy: { measuredAt: "desc" }
    });

    sendJson(res, measurements);
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const history = await prisma.$queryRaw`
      SELECT
        cm.id,
        cm.child_id,
        c.full_name,
        c.gender,
        c.birth_date,
        cm.measured_at,
        cm.age_in_days,
        round((cm.age_in_days::numeric / 30.4375), 1) AS age_in_months,
        cm.weight_kg,
        cm.height_cm,
        cm.head_circumference_cm,
        cm.weight_for_age_status,
        cm.height_for_age_status,
        cm.weight_for_height_status,
        cm.head_circumference_status,
        cm.notes,
        cm.created_by,
        cm.updated_by,
        cm.created_at,
        cm.updated_at
      FROM child_measurements cm
      JOIN children c ON c.id = cm.child_id
      WHERE cm.child_id = ${childId}
      ORDER BY cm.measured_at DESC
    `;

    sendJson(res, history);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = measurementBodySchema.parse(req.body);
    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
    const measuredAt = new Date(body.measuredAt);
    const ageInDays = Math.floor((measuredAt.getTime() - child.birthDate.getTime()) / 86_400_000);

    const measurement = await prisma.childMeasurement.create({
      data: {
        childId,
        measuredAt,
        ageInDays,
        weightKg: body.weightKg,
        heightCm: body.heightCm,
        headCircumferenceCm: body.headCircumferenceCm,
        notes: body.notes,
        weightForAgeStatus: body.weightForAgeStatus,
        heightForAgeStatus: body.heightForAgeStatus,
        weightForHeightStatus: body.weightForHeightStatus,
        headCircumferenceStatus: body.headCircumferenceStatus,
        createdBy: req.user!.id,
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "child_measurements",
      recordId: measurement.id,
      newData: measurement
    });

    sendJson(res, measurement, 201);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = measurementBodySchema.partial().parse(req.body);
    const oldMeasurement = await prisma.childMeasurement.findFirstOrThrow({
      where: { id, childId }
    });

    const measuredAt = body.measuredAt ? new Date(body.measuredAt) : undefined;
    const ageInDays = measuredAt
      ? Math.floor((measuredAt.getTime() - (await prisma.child.findUniqueOrThrow({ where: { id: childId } })).birthDate.getTime()) / 86_400_000)
      : undefined;

    const measurement = await prisma.childMeasurement.update({
      where: { id },
      data: {
        measuredAt,
        ageInDays,
        weightKg: body.weightKg,
        heightCm: body.heightCm,
        headCircumferenceCm: body.headCircumferenceCm,
        notes: body.notes,
        weightForAgeStatus: body.weightForAgeStatus,
        heightForAgeStatus: body.heightForAgeStatus,
        weightForHeightStatus: body.weightForHeightStatus,
        headCircumferenceStatus: body.headCircumferenceStatus,
        updatedAt: new Date(),
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "UPDATE",
      tableName: "child_measurements",
      recordId: measurement.id,
      oldData: oldMeasurement,
      newData: measurement
    });

    sendJson(res, measurement);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const oldMeasurement = await prisma.childMeasurement.findFirstOrThrow({
      where: { id, childId }
    });

    await prisma.childMeasurement.delete({ where: { id } });
    await writeAuditLog(req, {
      action: "DELETE",
      tableName: "child_measurements",
      recordId: id,
      oldData: oldMeasurement
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as measurementsRouter };
