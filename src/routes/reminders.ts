import { Router } from "express";
import { z } from "zod";
import { ensureChildAccess } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { childIdParamSchema, dateString, idParamSchema } from "../lib/validation.js";

const router = Router({ mergeParams: true });

const reminderBodySchema = z.object({
  title: z.string().min(1).max(150),
  reminderType: z.string().max(50).optional(),
  reminderDate: dateString,
  isDone: z.boolean().optional(),
  notes: z.string().optional()
});

router.get("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const reminders = await prisma.reminder.findMany({
      where: { childId },
      orderBy: { reminderDate: "asc" }
    });

    sendJson(res, reminders);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = reminderBodySchema.parse(req.body);
    const reminder = await prisma.reminder.create({
      data: {
        childId,
        title: body.title,
        reminderType: body.reminderType,
        reminderDate: new Date(body.reminderDate),
        isDone: body.isDone,
        notes: body.notes,
        createdBy: req.user!.id,
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "CREATE",
      tableName: "reminders",
      recordId: reminder.id,
      newData: reminder
    });

    sendJson(res, reminder, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/done", async (req, res, next) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);
    const { id } = idParamSchema.parse(req.params);
    await ensureChildAccess(req.user!, childId);

    const body = z.object({ isDone: z.boolean() }).parse(req.body);
    const oldReminder = await prisma.reminder.findFirstOrThrow({
      where: { id, childId }
    });
    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        isDone: body.isDone,
        updatedAt: new Date(),
        updatedBy: req.user!.id
      }
    });

    await writeAuditLog(req, {
      action: "UPDATE",
      tableName: "reminders",
      recordId: reminder.id,
      oldData: oldReminder,
      newData: reminder
    });

    sendJson(res, reminder);
  } catch (error) {
    next(error);
  }
});

export { router as remindersRouter };
