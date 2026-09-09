import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getTestDatabaseUrl } from "./database-guard";

export function createIntegrationPrisma() {
  const pool = new Pool({ connectionString: getTestDatabaseUrl(), max: 1 });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
