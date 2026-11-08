import { Router } from "express";
import { z } from "zod";
import { ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { childIdParamSchema, dateString, idParamSchema, optionalDecimal } from "../lib/validation.js";
import { computeArmCircumferenceStatus, computeGrowthStatus, computeGrowthTrend } from "../lib/growth.js";
import { requireStrictAuth } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

const measurementBodySchema = z.object({
  measuredAt: dateString,
  weightKg: optionalDecimal,
  heightCm: optionalDecimal,
  headCircumferenceCm: optionalDecimal,
  armCircumferenceCm: optionalDecimal,
  notes: z.string().optional()
  // P1-1: field status tidak lagi diterima dari klien. Server yang menghitung
  // dari tabel acuan, supaya klien tidak bisa mengarang label "Normal".
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
        cm.arm_circumference_cm,
        cm.arm_circumference_status,
        cm.growth_trend,
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

router.post("/", requireStrictAuth, async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = measurementBodySchema.parse(req.body);
    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
    const measuredAt = new Date(body.measuredAt);
    const ageInDays = Math.floor((measuredAt.getTime() - child.birthDate.getTime()) / 86_400_000);

    // P1-1 + P1-2: status dan z dihitung server dari tabel acuan.
    const growth = await computeGrowthStatus({
      gender: child.gender,
      ageInDays,
      weightKg: body.weightKg ?? null,
      heightCm: body.heightCm ?? null,
      headCircumferenceCm: body.headCircumferenceCm ?? null
    });

    const ageMonth = Math.floor(ageInDays / 30.4375);
    const armStatus = computeArmCircumferenceStatus(body.armCircumferenceCm ?? null, ageMonth);

    // Cari pengukuran sebelumnya untuk menghitung tren kenaikan BB (N / T)
    const prevMeasurement = await prisma.childMeasurement.findFirst({
      where: { childId, measuredAt: { lt: measuredAt } },
      orderBy: { measuredAt: "desc" }
    });
    const prevWeight = prevMeasurement?.weightKg !== null && prevMeasurement?.weightKg !== undefined
      ? Number(prevMeasurement.weightKg)
      : null;
    const growthTrend = computeGrowthTrend(body.weightKg ?? null, prevWeight);

    const measurement = await prisma.childMeasurement.create({
      data: {
        childId,
        measuredAt,
        ageInDays,
        weightKg: body.weightKg,
        heightCm: body.heightCm,
        headCircumferenceCm: body.headCircumferenceCm,
        armCircumferenceCm: body.armCircumferenceCm,
        armCircumferenceStatus: armStatus,
        growthTrend,
        notes: body.notes,
        weightForAgeZ: growth.weightForAge.z,
        heightForAgeZ: growth.heightForAge.z,
        weightForHeightZ: growth.weightForHeight.z,
        headCircumferenceZ: growth.headCircumference.z,
        weightForAgeStatus: growth.weightForAge.label,
        heightForAgeStatus: growth.heightForAge.label,
        weightForHeightStatus: growth.weightForHeight.label,
        headCircumferenceStatus: growth.headCircumference.label,
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

router.put("/:id", requireStrictAuth, async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = measurementBodySchema.partial().parse(req.body);
    const oldMeasurement = await prisma.childMeasurement.findFirstOrThrow({
      where: { id, childId }
    });

    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
    const measuredAt = body.measuredAt ? new Date(body.measuredAt) : undefined;
    const effectiveMeasuredAt = measuredAt ?? oldMeasurement.measuredAt;
    const ageInDays = Math.floor((effectiveMeasuredAt.getTime() - child.birthDate.getTime()) / 86_400_000);

    // P1-1: nilai akhir setelah update, bukan nilai di body, yang dihitung.
    const nextWeight = body.weightKg ?? (oldMeasurement.weightKg === null ? null : Number(oldMeasurement.weightKg));
    const nextHeight = body.heightCm ?? (oldMeasurement.heightCm === null ? null : Number(oldMeasurement.heightCm));
    const nextHead = body.headCircumferenceCm ?? (oldMeasurement.headCircumferenceCm === null ? null : Number(oldMeasurement.headCircumferenceCm));
    const nextArm = body.armCircumferenceCm ?? (oldMeasurement.armCircumferenceCm === null ? null : Number(oldMeasurement.armCircumferenceCm));

    const growth = await computeGrowthStatus({
      gender: child.gender,
      ageInDays,
      weightKg: nextWeight,
      heightCm: nextHeight,
      headCircumferenceCm: nextHead
    });

    const ageMonth = Math.floor(ageInDays / 30.4375);
    const armStatus = computeArmCircumferenceStatus(nextArm, ageMonth);

    const prevMeasurement = await prisma.childMeasurement.findFirst({
      where: { childId, measuredAt: { lt: effectiveMeasuredAt }, id: { not: id } },
      orderBy: { measuredAt: "desc" }
    });
    const prevWeight = prevMeasurement?.weightKg !== null && prevMeasurement?.weightKg !== undefined
      ? Number(prevMeasurement.weightKg)
      : null;
    const growthTrend = computeGrowthTrend(nextWeight, prevWeight);

    const measurement = await prisma.childMeasurement.update({
      where: { id },
      data: {
        measuredAt,
        ageInDays,
        weightKg: body.weightKg,
        heightCm: body.heightCm,
        headCircumferenceCm: body.headCircumferenceCm,
        armCircumferenceCm: body.armCircumferenceCm,
        armCircumferenceStatus: armStatus,
        growthTrend,
        notes: body.notes,
        weightForAgeZ: growth.weightForAge.z,
        heightForAgeZ: growth.heightForAge.z,
        weightForHeightZ: growth.weightForHeight.z,
        headCircumferenceZ: growth.headCircumference.z,
        weightForAgeStatus: growth.weightForAge.label,
        heightForAgeStatus: growth.heightForAge.label,
        weightForHeightStatus: growth.weightForHeight.label,
        headCircumferenceStatus: growth.headCircumference.label,
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

router.delete("/:id", requireStrictAuth, async (req, res, next) => {
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
