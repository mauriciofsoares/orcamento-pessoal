import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTestDatabaseUrl, integrationDatabase } from "./database-guard";
import { createIntegrationPrisma } from "./prisma";

const prisma = createIntegrationPrisma();

beforeAll(async () => {
  const result = await prisma.$queryRaw<Array<{ database: string; port: number }>>`
    SELECT current_database() AS database, inet_server_port() AS port
  `;

  expect(result[0]).toEqual({
    database: integrationDatabase.database,
    port: integrationDatabase.serverPort,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("isolated PostgreSQL integration database", () => {
  it("requires the guarded test URL", () => {
    expect(getTestDatabaseUrl()).toContain("55432");
  });

  it("starts empty after migrations", async () => {
    const [users, transactions] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
    ]);

    expect(users).toBe(0);
    expect(transactions).toBe(0);
  });

  it("has the ownership structure", async () => {
    const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('User', 'Transaction')
      ORDER BY table_name
    `;

    expect(result.map((row) => row.table_name)).toEqual(["Transaction", "User"]);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Transaction'
        AND column_name = 'userId'
    `;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'Transaction_userId_idx'
    `;
    const constraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name = 'Transaction_userId_fkey'
    `;

    expect(columns).toEqual([{ column_name: "userId" }]);
    expect(indexes).toEqual([{ indexname: "Transaction_userId_idx" }]);
    expect(constraints).toEqual([{ constraint_name: "Transaction_userId_fkey" }]);
  });
});
