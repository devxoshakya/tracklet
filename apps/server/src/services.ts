import { createAuth as createConfiguredAuth } from "@tracklet/auth";
import { type Database, createPrismaClient } from "@tracklet/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createPrismaClient(ENV);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? (await getDb()));
}
