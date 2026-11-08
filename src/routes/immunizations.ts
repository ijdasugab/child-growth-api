import { Router } from "express";
import { z } from "zod";
import { ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { childIdParamSchema, dateString, idParamSchema } from "../lib/validation.js";
import { requireStrictAuth } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

const immunizationSchema = z.object({
  immunizationMasterId: z.coerce.bigint().positive().optional(),
  givenDate: dateString.optional(),
  location: z.string().max(150).optional(),
  batchNumber: z.string().max(100).optional(),
  administeredBy: z.string().max(100).optional(),
  notes: z.string().optional()
});

/**
 * Smart Reminder & Jadwal Imunisasi Buku KIA 2024.
 *
 * Menggabungkan 21 master vaksin nasional dengan data riwayat anak, lalu
 * menghitung status:
 *  - COMPLETED: Sudah diberikan
 *  - DUE: Waktunya diberikan bulan ini (rentang -30 hari s/d +14 hari)
 *  - OVERDUE: Melewati usia anjuran dan belum disuntik (imunisasi kejar)
 *  - UPCOMING: Belum mencapai usia rekomendasi
 */
router.get("/schedule", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
    const masters = await prisma.immunizationMaster.findMany({
      orderBy: [{ recommendedAgeMonth: "asc" }, { id: "asc" }]
    });

    const givenRecords = await prisma.childImmunization.findMany({
      where: { childId },
      include: { immunizationMaster: true }
    });

    const birth = new Date(child.birthDate);
    const now = new Date();

    const ageInDaysToday = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);
    const ageInMonthsToday = Math.floor(ageInDaysToday / 30.4375);

    const schedule = masters.map((master) => {
      const recAgeMonth = master.recommendedAgeMonth ?? 0;
      const targetDate = new Date(birth);
      targetDate.setMonth(targetDate.getMonth() + recAgeMonth);

      const existing = givenRecords.find((r) => r.immunizationMasterId === master.id);
      const isCompleted = Boolean(existing && existing.givenDate);

      const diffDays = Math.floor((targetDate.getTime() - now.getTime()) / 86_400_000);

      let status: "COMPLETED" | "DUE" | "OVERDUE" | "UPCOMING";
      if (isCompleted) {
        status = "COMPLETED";
      } else if (diffDays > 14) {
        status = "UPCOMING";
      } else if (diffDays >= -30) {
        status = "DUE";
      } else {
        status = "OVERDUE";
      }

      return {
        masterId: master.id,
        vaccineName: master.vaccineName,
        recommendedAgeMonth: recAgeMonth,
        targetDate: targetDate.toISOString().slice(0, 10),
        description: master.description,
        isCompleted,
        status,
        diffDays,
        recordId: existing ? existing.id : null,
        givenDate: existing?.givenDate ? existing.givenDate.toISOString().slice(0, 10) : null,
        location: existing?.location ?? null,
        batchNumber: existing?.batchNumber ?? null,
        administeredBy: existing?.administeredBy ?? null,
        notes: existing?.notes ?? null
      };
    });

    const completed = schedule.filter((s) => s.status === "COMPLETED").length;
    const due = schedule.filter((s) => s.status === "DUE").length;
    const overdue = schedule.filter((s) => s.status === "OVERDUE").length;
    const upcoming = schedule.filter((s) => s.status === "UPCOMING").length;

    sendJson(res, {
      childId,
      childName: child.fullName,
      birthDate: child.birthDate.toISOString().slice(0, 10),
      ageInMonthsToday,
      summary: {
        total: masters.length,
        completed,
        due,
        overdue,
        upcoming,
        hasActionRequired: due > 0 || overdue > 0
      },
      schedule
    });
  } catch (error) {
    next(error);
  }
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

router.post("/", requireStrictAuth, async (req, res, next) => {
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
        batchNumber: body.batchNumber,
        administeredBy: body.administeredBy,
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

router.put("/:id", requireStrictAuth, async (req, res, next) => {
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
        batchNumber: body.batchNumber,
        administeredBy: body.administeredBy,
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
