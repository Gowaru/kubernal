import type { Prisma } from "@prisma/client";

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function toJsonArray(values: unknown[]): Prisma.InputJsonValue[] {
  return values.map(toJsonValue);
}
