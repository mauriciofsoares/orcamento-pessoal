import { spawnSync } from "node:child_process";
import path from "node:path";
import { getTestDatabaseUrl } from "@/tests/integration/database-guard";

const testDatabaseUrl = getTestDatabaseUrl();
const result = spawnSync(
  process.execPath,
  [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
    },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
