const EXPECTED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const EXPECTED_PORT = "55432";
const EXPECTED_DATABASE = "orcamento_pessoal_integration";

export function getTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error("TEST_DATABASE_URL is required for integration tests.");
  }

  const url = new URL(value);
  if (url.protocol !== "postgresql:") {
    throw new Error("TEST_DATABASE_URL must use the postgresql protocol.");
  }

  if (!EXPECTED_HOSTS.has(url.hostname)) {
    throw new Error("TEST_DATABASE_URL must point to localhost or 127.0.0.1.");
  }

  if (url.port !== EXPECTED_PORT) {
    throw new Error("TEST_DATABASE_URL must use integration port 55432.");
  }

  if (url.pathname.slice(1) !== EXPECTED_DATABASE) {
    throw new Error("TEST_DATABASE_URL must use the integration database.");
  }

  if (url.hostname.includes("supabase.com")) {
    throw new Error("TEST_DATABASE_URL must not point to Supabase.");
  }

  if (value === process.env.DATABASE_URL || value === process.env.DIRECT_URL) {
    throw new Error("TEST_DATABASE_URL must not reuse DATABASE_URL or DIRECT_URL.");
  }

  return value;
}

export const integrationDatabase = {
  host: "127.0.0.1",
  externalPort: 55432,
  serverPort: 5432,
  database: EXPECTED_DATABASE,
};
