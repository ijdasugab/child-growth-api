import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Invalid request",
      issues: error.issues
    });
    return;
  }

  if (error instanceof Error && error.name === "ForbiddenError") {
    res.status(403).json({ message: error.message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      res.status(404).json({ message: "Data not found" });
      return;
    }

    if (error.code === "P2002") {
      res.status(409).json({ message: "Data already exists", target: error.meta?.target });
      return;
    }

    if (error.code === "P2003") {
      res.status(400).json({ message: "Invalid relation", field: error.meta?.field_name });
      return;
    }
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
