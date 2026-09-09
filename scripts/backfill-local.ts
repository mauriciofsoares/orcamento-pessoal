import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { getSupabaseUserProfile } from "@/lib/auth/supabase-user-profile";

type ControlSnapshot = {
  total: number;
  userIdNull: number;
  byType: Record<string, number>;
  byRecurrence: Record<string, number>;
  amountByType: Record<string, string>;
  byPaid: Record<string, number>;
  minDueDate: string | null;
  maxDueDate: string | null;
  transactionFingerprint: string;
};

type Options = {
  userId: string;
  execute: boolean;
};

const EXPECTED_TOTAL = 19;
const EXPECTED_USER_COUNT = 0;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const dryRun = args.includes("--dry-run");
  const userId = args.find((arg) => !arg.startsWith("--"));

  if (execute && dryRun) {
    throw new Error("Use apenas uma das flags: --dry-run ou --execute.");
  }

  if (!userId || !UUID_PATTERN.test(userId)) {
    throw new Error(
      "Informe um UUID Supabase válido: npx tsx -r dotenv/config scripts/backfill-local.ts <UUID> [--dry-run|--execute]",
    );
  }

  return { userId, execute };
}

function getLocalDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não está configurada.");

  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error("Abortado: DATABASE_URL não aponta para um banco local.");
  }

  return { databaseUrl, url };
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não está configurada.");
  }

  if (!adminKey) {
    throw new Error(
      "Abortado: configure uma chave administrativa Supabase server-side.",
    );
  }

  return createSupabaseClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function countMap(rows: Array<{ key: string; count: number }>) {
  return Object.fromEntries(rows.map((row) => [row.key, row.count]));
}

function amountMap(rows: Array<{ key: string; total: string | null }>) {
  return Object.fromEntries(rows.map((row) => [row.key, row.total ?? "0"]));
}

async function getControlSnapshot(client: Client): Promise<ControlSnapshot> {
  const total = await client.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM "Transaction"',
  );
  const userIdNull = await client.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM "Transaction" WHERE "userId" IS NULL',
  );
  const byType = await client.query<{ key: string; count: number }>(
    'SELECT "type" AS key, COUNT(*)::int AS count FROM "Transaction" GROUP BY "type" ORDER BY "type"',
  );
  const byRecurrence = await client.query<{ key: string; count: number }>(
    'SELECT "recurrence" AS key, COUNT(*)::int AS count FROM "Transaction" GROUP BY "recurrence" ORDER BY "recurrence"',
  );
  const amountByType = await client.query<{
    key: string;
    total: string | null;
  }>(
    'SELECT "type" AS key, COALESCE(SUM("amount"), 0)::text AS total FROM "Transaction" GROUP BY "type" ORDER BY "type"',
  );
  const byPaid = await client.query<{ key: string; count: number }>(
    'SELECT "isPaid"::text AS key, COUNT(*)::int AS count FROM "Transaction" GROUP BY "isPaid" ORDER BY "isPaid"',
  );
  const dates = await client.query<{ min: string | null; max: string | null }>(
    'SELECT TO_CHAR(MIN("dueDate"), \'YYYY-MM-DD\') AS min, TO_CHAR(MAX("dueDate"), \'YYYY-MM-DD\') AS max FROM "Transaction"',
  );
  const fingerprint = await client.query<{ fingerprint: string }>(
    'SELECT MD5(COALESCE(JSONB_AGG(TO_JSONB(t) - \'userId\' ORDER BY t.id)::text, \'[]\')) AS fingerprint FROM "Transaction" t',
  );

  return {
    total: total.rows[0].count,
    userIdNull: userIdNull.rows[0].count,
    byType: countMap(byType.rows),
    byRecurrence: countMap(byRecurrence.rows),
    amountByType: amountMap(amountByType.rows),
    byPaid: countMap(byPaid.rows),
    minDueDate: dates.rows[0].min,
    maxDueDate: dates.rows[0].max,
    transactionFingerprint: fingerprint.rows[0].fingerprint,
  };
}

function assertPreconditions(snapshot: ControlSnapshot) {
  if (
    snapshot.total !== EXPECTED_TOTAL ||
    snapshot.userIdNull !== EXPECTED_TOTAL
  ) {
    throw new Error(
      `Abortado: esperado Transaction=${EXPECTED_TOTAL} e userId NULL=${EXPECTED_TOTAL}.`,
    );
  }
}

function compareFinancialInvariants(
  before: ControlSnapshot,
  after: ControlSnapshot,
) {
  const beforeComparable = { ...before, userIdNull: undefined };
  const afterComparable = { ...after, userIdNull: undefined };

  return JSON.stringify(beforeComparable) === JSON.stringify(afterComparable);
}

function maskUserId(userId: string) {
  return `${userId.slice(0, 8)}...${userId.slice(-4)}`;
}

async function validateSupabaseUser(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new Error("Abortado: o UUID não pertence a um usuário Supabase válido.");
  }

  return getSupabaseUserProfile(data.user);
}

async function assertLocalUserState(client: Client, userId: string) {
  const result = await client.query<{ total: number; target: number }>(
    'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "id" = $1)::int AS target FROM "User"',
    [userId],
  );

  if (
    result.rows[0].total !== EXPECTED_USER_COUNT ||
    result.rows[0].target !== EXPECTED_USER_COUNT
  ) {
    throw new Error("Abortado: public.User não está no estado inicial esperado.");
  }
}

function redactSensitiveText(value: string) {
  let safeValue = value;

  for (const name of [
    "DATABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    const secret = process.env[name];
    if (secret) safeValue = safeValue.split(secret).join("[REDACTED]");
  }

  return safeValue
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(
      /((?:password|secret|token|cookie|authorization|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    );
}

function formatOriginalError(error: unknown) {
  const source =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const text = (value: unknown) =>
    value === undefined || value === null
      ? "<não disponível>"
      : redactSensitiveText(String(value));

  return [
    `name: ${text(source.name ?? (error instanceof Error ? error.name : undefined))}`,
    `message: ${text(source.message ?? (error instanceof Error ? error.message : error))}`,
    `code: ${text(source.code)}`,
    `detail: ${text(source.detail)}`,
    `constraint: ${text(source.constraint)}`,
    `table: ${text(source.table)}`,
    `column: ${text(source.column)}`,
    `stack: ${text(source.stack ?? (error instanceof Error ? error.stack : undefined))}`,
  ].join("\n");
}

async function run(options: Options) {
  const { databaseUrl, url } = getLocalDatabaseUrl();
  const profile = await validateSupabaseUser(options.userId);
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const before = await getControlSnapshot(client);
    assertPreconditions(before);
    await assertLocalUserState(client, options.userId);

    console.log(`Banco local validado: ${url.hostname}:${url.port}/${url.pathname.slice(1)}`);
    console.log(`Usuário Supabase validado: ${maskUserId(profile.id)}`);
    console.log(`E-mail disponível: ${Boolean(profile.email)}`);
    console.log(`Nome disponível: ${Boolean(profile.name)}`);
    console.log(`Imagem disponível: ${Boolean(profile.image)}`);
    console.log(`Modo: ${options.execute ? "EXECUTE" : "DRY-RUN"}`);
    console.log("Plano: criar 1 User e preencher userId nas 19 Transactions.");
    console.log("Campos financeiros preservados por fingerprint agregado.");

    if (!options.execute) return;

    await client.query("BEGIN");
    try {
      const insideBefore = await getControlSnapshot(client);
      assertPreconditions(insideBefore);
      await assertLocalUserState(client, options.userId);

      await client.query(
        'INSERT INTO "User" ("id", "email", "name", "image", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
        [profile.id, profile.email, profile.name, profile.image],
      );

      const updated = await client.query(
        'UPDATE "Transaction" SET "userId" = $1 WHERE "userId" IS NULL',
        [profile.id],
      );

      if (updated.rowCount !== EXPECTED_TOTAL) {
        throw new Error("Abortado: o UPDATE não afetou exatamente 19 Transactions.");
      }

      const after = await getControlSnapshot(client);
      if (
        after.total !== EXPECTED_TOTAL ||
        after.userIdNull !== 0 ||
        !compareFinancialInvariants(insideBefore, after)
      ) {
        throw new Error("Abortado: invariantes pós-backfill não conferem.");
      }

      const ownership = await client.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM "Transaction" WHERE "userId" = $1',
        [profile.id],
      );
      if (ownership.rows[0].count !== EXPECTED_TOTAL) {
        throw new Error("Abortado: nem todas as Transactions pertencem ao UUID informado.");
      }

      await client.query("COMMIT");
      console.log("Backfill concluído com sucesso.");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("ROLLBACK falhou:");
        console.error(formatOriginalError(rollbackError));
      }
      console.error("Erro original do backfill:");
      console.error(formatOriginalError(error));
      throw error;
    }
  } finally {
    await client.end();
  }
}

run(parseOptions()).catch(() => {
  console.error("Backfill abortado sem alteração de dados.");
  process.exitCode = 1;
});
