import type { Response } from "express";

export function sendJson(res: Response, data: unknown, status = 200) {
  return res.status(status).json(toJson(data));
}

function toJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toJson);
  }

  if (value && typeof value === "object") {
    if (
      "toJSON" in value &&
      "s" in value &&
      "e" in value &&
      "d" in value
    ) {
      return (value as { toJSON: () => unknown }).toJSON();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toJson(nestedValue)])
    );
  }

  return value;
}
