import type { DatabaseSync, SupportedValueType } from "node:sqlite";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const schema = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email));

  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'paused', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    provider TEXT,
    provider_customer_id TEXT,
    provider_subscription_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('incomplete', 'trial', 'active', 'past_due', 'paused', 'cancelled')),
    price_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_unique ON subscriptions(provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS subscriptions_organization_idx ON subscriptions(organization_id);

  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value INTEGER NOT NULL CHECK (discount_value > 0),
    currency TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT,
    expires_at TEXT,
    max_redemptions INTEGER,
    redemption_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique ON coupons (UPPER(code));

  CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount_discounted_cents INTEGER NOT NULL,
    redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, organization_id)
  );

  CREATE TABLE IF NOT EXISTS billing_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload_hash TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_unique ON billing_events(provider, provider_event_id);

  CREATE TABLE IF NOT EXISTS module_projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'running', 'completed', 'failed')),
    is_example INTEGER NOT NULL DEFAULT 0,
    source_project_id TEXT REFERENCES module_projects(id) ON DELETE SET NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS module_projects_organization_idx ON module_projects(organization_id, module_slug, updated_at);

  CREATE TABLE IF NOT EXISTS module_example_seed_state (
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_slug TEXT NOT NULL,
    seeded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, module_slug)
  );

  CREATE TABLE IF NOT EXISTS workflow_nodes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES module_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    label TEXT NOT NULL,
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS workflow_nodes_project_idx ON workflow_nodes(organization_id, project_id, sort_order);

  CREATE TABLE IF NOT EXISTS workflow_edges (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES module_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_node_id TEXT NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    source_port TEXT NOT NULL DEFAULT 'output',
    target_port TEXT NOT NULL DEFAULT 'input',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, source_node_id, target_node_id)
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES module_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS workflow_runs_project_idx ON workflow_runs(organization_id, project_id, created_at);

  CREATE TABLE IF NOT EXISTS workflow_run_logs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id TEXT REFERENCES workflow_nodes(id) ON DELETE SET NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'success', 'error')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS workflow_run_logs_run_idx ON workflow_run_logs(run_id, created_at);

  CREATE TABLE IF NOT EXISTS automation_schedules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES module_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('manual', 'once', 'interval')),
    schedule_json TEXT NOT NULL DEFAULT '{}',
    timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    active INTEGER NOT NULL DEFAULT 0,
    next_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS automation_schedules_due_idx ON automation_schedules(organization_id, active, next_run_at);

  CREATE TABLE IF NOT EXISTS automation_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES module_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    schedule_id TEXT REFERENCES automation_schedules(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    attempt INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    scheduled_for TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    finished_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS automation_jobs_queue_idx ON automation_jobs(status, scheduled_for, organization_id);

  CREATE TABLE IF NOT EXISTS automation_job_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('info', 'success', 'warning', 'error')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS automation_job_logs_job_idx ON automation_job_logs(job_id, created_at);

  CREATE TABLE IF NOT EXISTS integration_connections (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    display_name TEXT NOT NULL,
    auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key', 'browser_profile')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'connected', 'expired', 'error', 'revoked')),
    external_account_label TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, provider, display_name)
  );
  CREATE INDEX IF NOT EXISTS integration_connections_org_idx ON integration_connections(organization_id, provider, status);

  CREATE TABLE IF NOT EXISTS module_outputs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES module_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    output_type TEXT NOT NULL DEFAULT 'technical_draft',
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'failed')),
    title TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS module_outputs_project_idx ON module_outputs(organization_id, project_id, created_at);

  CREATE TABLE IF NOT EXISTS ebook_projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    source_legacy_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS ebook_projects_organization_idx ON ebook_projects(organization_id, updated_at);
  CREATE UNIQUE INDEX IF NOT EXISTS ebook_projects_legacy_unique ON ebook_projects(organization_id, source_legacy_id) WHERE source_legacy_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS workspace_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    profile_type TEXT NOT NULL CHECK (profile_type IN ('browser', 'social', 'content', 'workspace')),
    platform TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'disabled')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS workspace_profiles_org_idx ON workspace_profiles(organization_id, profile_type, updated_at);

  CREATE TABLE IF NOT EXISTS organization_invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS organization_invitations_org_idx ON organization_invitations(organization_id, email);
  CREATE INDEX IF NOT EXISTS organization_invitations_expiry_idx ON organization_invitations(expires_at);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs(organization_id, created_at);

  CREATE TABLE IF NOT EXISTS integration_secrets (
    connection_id TEXT PRIMARY KEY REFERENCES integration_connections(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    key_hint TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workspace_messages (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('message', 'signal', 'keyword', 'resource')),
    module_slug TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS workspace_messages_org_idx ON workspace_messages(organization_id, kind, module_slug, created_at);

  -- Worker local : exécute les jobs sur la machine du client (profils navigateur
  -- 100% locaux, jamais envoyés au SaaS). Auth par token d'organisation révocable.
  CREATE TABLE IF NOT EXISTS worker_tokens (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    last_seen_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS worker_tokens_org_idx ON worker_tokens(organization_id);
`;

export type QueryResult<T> = { rows: T[]; rowCount: number };
type TransactionClient = Pick<JaMakerDatabase, "query" | "exec">;

type HranaValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string }
  | { type: "blob"; value: string };

// Client HTTP minimal pour Turso (API Hrana v2, 100% fetch, zéro dépendance native).
// Évite @libsql/client qui fait crasher Turbopack sous Windows en dev.
class TursoHttp {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.baseUrl = url.replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
    this.token = token;
  }

  encodeArgs(params: SupportedValueType[]): HranaValue[] {
    return params.map((value): HranaValue => {
      if (value === undefined || value === null) return { type: "null" };
      if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
      if (typeof value === "number") return Number.isInteger(value) ? { type: "integer", value: String(value) } : { type: "float", value };
      if (typeof value === "bigint") return { type: "integer", value: String(value) };
      if (typeof value === "string") return { type: "text", value };
      const bytes = Buffer.isBuffer(value) ? new Uint8Array(value) : (value as Uint8Array);
      return { type: "blob", value: Buffer.from(bytes).toString("base64") };
    });
  }

  private decodeValue(cell: { type: string; value?: unknown }) {
    if (cell.type === "null") return null;
    if (cell.type === "integer" || cell.type === "float") return Number(cell.value);
    return cell.value as unknown;
  }

  async pipeline(statements: Array<{ sql: string; args?: HranaValue[] }>) {
    const response = await fetch(`${this.baseUrl}/v2/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: statements.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: s.args || [] } })) }),
    });
    if (!response.ok) throw new Error(`Turso HTTP ${response.status}`);
    const data = (await response.json()) as {
      results: Array<
        | { type: "ok"; response: { type: "execute"; result: { cols: Array<{ name: string }>; rows: Array<Array<{ type: string; value?: unknown }>>; rows_affected: number } } }
        | { type: "error"; error: { message: string } }
      >;
    };
    return data.results.map((result) => {
      if (result.type === "error") throw new Error(`Turso: ${result.error.message}`.slice(0, 300));
      const inner = result.response.result;
      return {
        rows: inner.rows.map((row) => {
          const obj: Record<string, unknown> = {};
          inner.cols.forEach((col, index) => {
            obj[col.name] = this.decodeValue(row[index]);
          });
          return obj;
        }),
        rowsAffected: inner.rows_affected,
      };
    });
  }

  async execute(sql: string, args: HranaValue[] = []) {
    const [result] = await this.pipeline([{ sql, args }]);
    return result;
  }
}

class JaMakerDatabase {
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly backend: { kind: "local"; database: DatabaseSync } | { kind: "turso"; turso: TursoHttp }) {}

  private toSqlite(sql: string, params: SupportedValueType[]) {
    const orderedParams: SupportedValueType[] = [];
    const sqliteSql = sql.replace(/\$(\d+)/g, (_match, index: string) => {
      orderedParams.push(params[Number(index) - 1]);
      return "?";
    });
    return { sqliteSql, orderedParams };
  }

  async query<T>(sql: string, params: SupportedValueType[] = []): Promise<QueryResult<T>> {
    const { sqliteSql, orderedParams } = this.toSqlite(sql, params);
    if (this.backend.kind === "turso") {
      const readsRows = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sqliteSql) || /\bRETURNING\b/i.test(sqliteSql);
      const result = await this.backend.turso.execute(sqliteSql, this.backend.turso.encodeArgs(orderedParams));
      if (readsRows) return { rows: result.rows as T[], rowCount: result.rows.length };
      return { rows: [], rowCount: Number(result.rowsAffected ?? 0) };
    }
    const statement = this.backend.database.prepare(sqliteSql);

    const readsRows = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sqliteSql) || /\bRETURNING\b/i.test(sqliteSql);
    if (readsRows) {
      const raw = statement.all(...orderedParams) as Array<Record<string, unknown>>;
      // node:sqlite retourne des objets à prototype null → convertir en objets plains
      // pour les Client Components Next.js (erreur "null prototypes are not supported").
      const rows = raw.map((row) => ({ ...row })) as T[];
      return { rows, rowCount: rows.length };
    }

    const result = statement.run(...orderedParams);
    return { rows: [], rowCount: Number(result.changes) };
  }

  async exec(sql: string) {
    if (this.backend.kind === "turso") {
      // PRAGMA journal_mode/foreign_keys : locaux uniquement, ignorés sur Turso.
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !/^PRAGMA/i.test(s));
      // Schéma idempotent (IF NOT EXISTS) : exécution séquentielle, reprise safe.
      for (const stmt of statements) {
        await this.backend.turso.execute(stmt);
      }
      return;
    }
    this.backend.database.exec(sql);
  }

  async transaction<T>(callback: (transaction: TransactionClient) => Promise<T>) {
    let releaseTransaction: () => void = () => undefined;
    const previousTransaction = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    await previousTransaction;
    // Turso HTTP : pas de transaction interactive multi-requêtes sur le tier test ;
    // sérialisation par instance + atomicité par statement. Suffisant pour le test,
    // à durcir (batch BEGIN/COMMIT single-pipeline) avant production multi-instances.
    if (this.backend.kind === "local") this.backend.database.exec("BEGIN IMMEDIATE");
    try {
      const result = await callback(this);
      if (this.backend.kind === "local") this.backend.database.exec("COMMIT");
      return result;
    } catch (error) {
      if (this.backend.kind === "local") {
        try {
          this.backend.database.exec("ROLLBACK");
        } catch {
          // ignore rollback errors
        }
      }
      throw error;
    } finally {
      releaseTransaction();
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __jaMakerDb: Promise<JaMakerDatabase> | undefined;
  // eslint-disable-next-line no-var
  var __jaMakerDbSchemaVersion: number | undefined;
}

// Increment this whenever the bootstrap schema changes. Next.js keeps globals
// alive during hot reloads, so a version guard makes pending migrations run
// without requiring the user to restart the development server.
const schemaVersion = 13;

async function createDatabase() {
  // Turso (SQLite cloud, free tier) pour Vercel/serverless : mêmes tables, zéro migration SQL.
  // Client HTTP Hrana maison (fetch) : aucune dépendance native → compatible Turbopack Windows.
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const turso = new TursoHttp(tursoUrl, process.env.TURSO_AUTH_TOKEN || "");
    const db = new JaMakerDatabase({ kind: "turso", turso });
    await db.exec(schema);
    return db;
  }
  const configuredPath = process.env.JAMAKER_DATABASE_PATH || ".data/jamaker.sqlite";
  const databasePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  await mkdir(path.dirname(databasePath), { recursive: true });
  // Import dynamique : Vercel/serverless (Turso) ne touche jamais à node:sqlite.
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(databasePath);
  const db = new JaMakerDatabase({ kind: "local", database });
  await db.exec(schema);
  return db;
}

export function getDb() {
  if (globalThis.__jaMakerDbSchemaVersion !== schemaVersion) {
    globalThis.__jaMakerDb = undefined;
    globalThis.__jaMakerDbSchemaVersion = schemaVersion;
  }
  globalThis.__jaMakerDb ??= createDatabase().catch((error) => {
    globalThis.__jaMakerDb = undefined;
    throw error;
  });
  return globalThis.__jaMakerDb;
}
