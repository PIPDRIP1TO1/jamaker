import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const legacyRoot = resolve(process.argv[2] || "D:\\EBOOKS");
const storePath = join(legacyRoot, "data", "store.json");
const databasePath = resolve(process.env.JAMAKER_DATABASE_PATH || ".data/jamaker.sqlite");
if (!existsSync(storePath)) throw new Error(`Store legacy introuvable: ${storePath}`);

const store = JSON.parse(readFileSync(storePath, "utf8"));
const projects = Array.isArray(store.projects) ? store.projects : [];
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
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
`);
const organizations = database.prepare("SELECT id, name FROM organizations ORDER BY datetime(created_at) ASC").all();
if (organizations.length !== 1) throw new Error(`Migration sûre impossible: ${organizations.length} organisations trouvées (1 attendue).`);
const organization = organizations[0];
const targetUploads = join(process.cwd(), "public", "ebook-uploads", "legacy");
mkdirSync(targetUploads, { recursive: true });

function migrateImage(value) {
  if (typeof value !== "string" || !value) return "";
  if (!value.startsWith("/uploads/")) return value;
  const fileName = basename(value);
  const source = join(legacyRoot, "public", "uploads", fileName);
  if (!existsSync(source)) return "";
  copyFileSync(source, join(targetUploads, fileName));
  return `/ebook-uploads/legacy/${fileName}`;
}

const upsert = database.prepare(`
  INSERT INTO ebook_projects (id, organization_id, title, content_json, source_legacy_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(organization_id, source_legacy_id) WHERE source_legacy_id IS NOT NULL
  DO UPDATE SET title = excluded.title, content_json = excluded.content_json, updated_at = excluded.updated_at
`);

database.exec("BEGIN IMMEDIATE");
try {
  for (const legacy of projects) {
    const now = new Date().toISOString();
    const project = {
      ...legacy,
      id: `ebook_${randomUUID()}`,
      title: String(legacy.title || "Untitled Cookbook"),
      coverImage: migrateImage(legacy.coverImage),
      backCoverImage: migrateImage(legacy.backCoverImage),
      recipes: (Array.isArray(legacy.recipes) ? legacy.recipes : []).map((recipe) => ({
        ...recipe,
        id: String(recipe.id || randomUUID()),
        imageUrl: migrateImage(recipe.imageUrl),
        imageSource: recipe.imageSource === "original" || recipe.imageSource === "custom" ? recipe.imageSource : "ai",
        status: recipe.status === "generated" || recipe.status === "edited" ? recipe.status : "imported",
      })),
      createdAt: legacy.createdAt || now,
      updatedAt: now,
    };
    upsert.run(project.id, organization.id, project.title, JSON.stringify(project), String(legacy.id || project.title), project.createdAt, project.updatedAt);
  }
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
} finally {
  database.close();
}

console.log(JSON.stringify({ organization: organization.name, imported: projects.length, secretsCopied: false, targetUploads }, null, 2));
