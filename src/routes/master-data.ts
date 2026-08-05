import { Router } from "express";
import { z } from "zod";
import { sendJson } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/growth-standard-types", async (_req, res, next) => {
  try {
    const data = await prisma.growthStandardType.findMany({
      orderBy: { id: "asc" }
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

router.get("/growth-standards", async (req, res, next) => {
  try {
    const query = z.object({
      standardTypeId: z.coerce.bigint().positive().optional(),
      gender: z.enum(["MALE", "FEMALE"]).optional(),
      ageInDays: z.coerce.number().int().optional(),
      heightCm: z.coerce.number().positive().optional()
    }).parse(req.query);

    const data = await prisma.growthStandard.findMany({
      where: {
        standardTypeId: query.standardTypeId,
        gender: query.gender,
        ageInDays: query.ageInDays,
        heightCm: query.heightCm
      },
      orderBy: [{ standardTypeId: "asc" }, { gender: "asc" }, { ageInDays: "asc" }, { heightCm: "asc" }],
      take: 500
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

router.get("/growth-status-rules", async (req, res, next) => {
  try {
    const query = z.object({
      standardCode: z.string().max(30).optional(),
      ageMonth: z.coerce.number().int().optional(),
      zScore: z.coerce.number().optional()
    }).parse(req.query);

    const data = await prisma.growthStatusRule.findMany({
      where: {
        standardCode: query.standardCode,
        ageMinMonth: query.ageMonth === undefined ? undefined : { lte: query.ageMonth },
        ageMaxMonth: query.ageMonth === undefined ? undefined : { gte: query.ageMonth },
        AND: query.zScore === undefined
          ? undefined
          : [
              { OR: [{ minZScore: null }, { minZScore: { lte: query.zScore } }] },
              { OR: [{ maxZScore: null }, { maxZScore: { gt: query.zScore } }] }
            ]
      },
      orderBy: { id: "asc" }
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

router.get("/immunizations", async (_req, res, next) => {
  try {
    const data = await prisma.immunizationMaster.findMany({
      orderBy: [{ recommendedAgeMonth: "asc" }, { id: "asc" }]
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

router.get("/milestones", async (_req, res, next) => {
  try {
    const data = await prisma.milestoneMaster.findMany({
      orderBy: [{ ageMonth: "asc" }, { id: "asc" }]
    });

    sendJson(res, data);
  } catch (error) {
    next(error);
  }
});

export { router as masterDataRouter };
