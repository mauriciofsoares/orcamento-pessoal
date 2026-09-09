import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está definida. Verifique o arquivo .env");
}

const databaseUrl = connectionString;
const isSupabaseUrl = databaseUrl.includes("supabase.com");
const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";

function createPrismaClient() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isSupabaseUrl
      ? { rejectUnauthorized }
      : undefined,
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// O fast refresh do Next recria os módulos a cada edição; sem o cache global cada
// recarga abriria um novo pool de conexões até esgotar o limite do Postgres.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
