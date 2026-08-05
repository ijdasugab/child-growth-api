import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type AuditInput = {
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";
  tableName?: string;
  recordId?: bigint;
  oldData?: unknown;
  newData?: unknown;
};

export async function writeAuditLog(req: Request, input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      action: input.action,
      tableName: input.tableName,
      recordId: input.recordId,
      oldData: toPrismaJson(input.oldData),
      newData: toPrismaJson(input.newData),
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    }
  });
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === "bigint") {
        return nestedValue.toString();
      }

      return nestedValue;
    })
  ) as Prisma.InputJsonValue;
}
