import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.bigint().positive()
});

export const childIdParamSchema = z.object({
  childId: z.coerce.bigint().positive()
});

export const dateString = z.preprocess((val) => {
  if (typeof val === "string" && val.length >= 10) {
    return val.slice(0, 10);
  }
  return val;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"));

export const optionalDecimal = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "string") {
    const cleaned = val.replace(",", ".").trim();
    if (cleaned === "") return null;
    return Number(cleaned);
  }
  return val;
}, z.number().positive().nullable().optional());
