import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.bigint().positive()
});

export const childIdParamSchema = z.object({
  childId: z.coerce.bigint().positive()
});

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");

export const optionalDecimal = z.coerce.number().positive().optional();
