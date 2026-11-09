import { PrismaD1 } from "@prisma/adapter-d1";

import { PrismaClient } from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";

export function createPrismaClient(env: DatabaseConfig) {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;
