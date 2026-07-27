#!/usr/bin/env node
/**
 * Extract complete schema from production Supabase database.
 * Produces DDL-only output equivalent to pg_dump --schema-only.
 * Read-only: no writes to the database.
 */
import pg from 'pg';
const { Client } = pg;

// Usage: DB_HOST=db.<ref>.supabase.co DB_PASSWORD=<password> node scripts/extract-schema.mjs
const client = new Client({
  host: process.env.DB_HOST || 'db.<project-ref>.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

const out = [];
function emit(sql) { out.push(sql); }
function emitLine() { out.push(''); }

async function q(sql) {
  const res = await client.query(sql);
  return res.rows;
}

// ── Extensions ──────────────────────────────────────────────
async function dumpExtensions() {
  emit('-- ============================================================');
  emit('-- Extensions');
  emit('-- ============================================================');
  const rows = await q(`
    SELECT e.extname, n.nspname as schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname NOT IN ('plpgsql')
    ORDER BY e.extname
  `);
  for (const r of rows) {
    // pg_cron is managed by Supabase (pg_catalog schema), skip it
    if (r.extname === 'pg_cron') {
      emit(`-- pg_cron: must be enabled via Supabase dashboard (Extensions page)`);
      continue;
    }
    // supabase_vault is pre-installed, skip
    if (r.extname === 'supabase_vault') {
      emit(`-- supabase_vault: pre-installed on Supabase projects`);
      continue;
    }
    // pg_stat_statements is pre-installed
    if (r.extname === 'pg_stat_statements') {
      emit(`-- pg_stat_statements: pre-installed on Supabase projects`);
      continue;
    }
    emit(`CREATE EXTENSION IF NOT EXISTS "${r.extname}" WITH SCHEMA "${r.schema}";`);
  }
  emitLine();
}

// ── Enum types ──────────────────────────────────────────────
async function dumpEnums() {
  emit('-- ============================================================');
  emit('-- Enum types');
  emit('-- ============================================================');
  const rows = await q(`
    SELECT t.typname,
      string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `);
  for (const r of rows) {
    emit(`CREATE TYPE public.${r.typname} AS ENUM (${r.labels});`);
  }
  emitLine();
}

// ── Helper: column type string ──────────────────────────────
function colType(c) {
  // Use udt_name for user-defined types (enums), otherwise data_type
  if (c.data_type === 'USER-DEFINED') return `public.${c.udt_name}`;
  if (c.data_type === 'ARRAY') {
    // udt_name starts with _ for arrays
    const base = c.udt_name.replace(/^_/, '');
    return `${base}[]`;
  }
  if (c.data_type === 'character varying') {
    return c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'varchar';
  }
  if (c.data_type === 'character') {
    return c.character_maximum_length ? `char(${c.character_maximum_length})` : 'char';
  }
  if (c.data_type === 'numeric' && c.numeric_precision) {
    return `numeric(${c.numeric_precision},${c.numeric_scale || 0})`;
  }
  // Map information_schema names to SQL types
  const typeMap = {
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'time with time zone': 'timetz',
    'time without time zone': 'time',
    'double precision': 'double precision',
    'boolean': 'boolean',
    'integer': 'integer',
    'bigint': 'bigint',
    'smallint': 'smallint',
    'text': 'text',
    'uuid': 'uuid',
    'jsonb': 'jsonb',
    'json': 'json',
    'date': 'date',
    'real': 'real',
    'bytea': 'bytea',
    'inet': 'inet',
    'cidr': 'cidr',
    'macaddr': 'macaddr',
    'interval': 'interval',
    'oid': 'oid',
    'name': 'name',
    'regclass': 'regclass',
  };
  return typeMap[c.data_type] || c.udt_name || c.data_type;
}

// ── Tables (CREATE TABLE without FK) ────────────────────────
async function dumpTables(schema) {
  emit(`-- ============================================================`);
  emit(`-- Tables: ${schema}`);
  emit(`-- ============================================================`);

  // Get all tables
  const tables = await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = '${schema}'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  for (const t of tables) {
    const tname = t.table_name;

    // Skip Supabase internal storage tables (managed by Supabase)
    if (schema === 'storage' && ['migrations', 'buckets_vectors', 'buckets_analytics',
        'vector_indexes', 's3_multipart_uploads', 's3_multipart_uploads_parts'].includes(tname)) {
      continue;
    }

    // Get columns
    const cols = await q(`
      SELECT column_name, data_type, udt_name, column_default, is_nullable,
             character_maximum_length, numeric_precision, numeric_scale,
             is_identity, identity_generation
      FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${tname}'
      ORDER BY ordinal_position
    `);

    // Get primary key columns
    const pkCols = await q(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = '${schema}'
        AND tc.table_name = '${tname}'
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `);

    // Get unique constraints (non-PK)
    const uniqConstraints = await q(`
      SELECT tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = '${schema}'
        AND tc.table_name = '${tname}'
        AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name
      ORDER BY tc.constraint_name
    `);

    // Get check constraints
    const checks = await q(`
      SELECT cc.constraint_name, cc.check_clause
      FROM information_schema.check_constraints cc
      JOIN information_schema.table_constraints tc
        ON cc.constraint_name = tc.constraint_name
        AND cc.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = '${schema}'
        AND tc.table_name = '${tname}'
        AND tc.constraint_type = 'CHECK'
        AND cc.constraint_name NOT LIKE '%_not_null'
      ORDER BY cc.constraint_name
    `);

    // Build CREATE TABLE
    const colDefs = cols.map(c => {
      let def = `  "${c.column_name}" ${colType(c)}`;
      if (c.is_nullable === 'NO') def += ' NOT NULL';
      if (c.column_default !== null && c.is_identity !== 'YES') {
        def += ` DEFAULT ${c.column_default}`;
      }
      if (c.is_identity === 'YES') {
        def += ` GENERATED ${c.identity_generation === 'ALWAYS' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`;
      }
      return def;
    });

    // Add PK
    if (pkCols.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pkCols.map(p => `"${p.column_name}"`).join(', ')})`);
    }

    // Add UNIQUE
    for (const u of uniqConstraints) {
      colDefs.push(`  CONSTRAINT "${u.constraint_name}" UNIQUE (${u.columns})`);
    }

    // Add CHECK
    for (const ck of checks) {
      colDefs.push(`  CONSTRAINT "${ck.constraint_name}" CHECK (${ck.check_clause})`);
    }

    emit(`CREATE TABLE ${schema}."${tname}" (`);
    emit(colDefs.join(',\n'));
    emit(`);`);
    emitLine();
  }
}

// ── Foreign keys (separate ALTER TABLE) ─────────────────────
async function dumpForeignKeys(schema) {
  emit(`-- ============================================================`);
  emit(`-- Foreign keys: ${schema}`);
  emit(`-- ============================================================`);
  const rows = await q(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      pg_get_constraintdef(pgc.oid) AS definition
    FROM information_schema.table_constraints tc
    JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
    JOIN pg_namespace ns ON ns.oid = pgc.connamespace AND ns.nspname = '${schema}'
    WHERE tc.table_schema = '${schema}'
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, tc.constraint_name
  `);
  for (const r of rows) {
    emit(`ALTER TABLE ${schema}."${r.table_name}" ADD CONSTRAINT "${r.constraint_name}" ${r.definition};`);
  }
  emitLine();
}

// ── Indexes ─────────────────────────────────────────────────
async function dumpIndexes(schema) {
  emit(`-- ============================================================`);
  emit(`-- Indexes: ${schema}`);
  emit(`-- ============================================================`);
  const rows = await q(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = '${schema}'
      AND indexname NOT IN (
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_schema = '${schema}'
          AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      )
    ORDER BY tablename, indexname
  `);
  for (const r of rows) {
    emit(`${r.indexdef};`);
  }
  emitLine();
}

// ── Functions ───────────────────────────────────────────────
async function dumpFunctions(schema) {
  emit(`-- ============================================================`);
  emit(`-- Functions: ${schema}`);
  emit(`-- ============================================================`);
  const rows = await q(`
    SELECT pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = '${schema}'
      AND p.prokind IN ('f', 'p')  -- functions and procedures
    ORDER BY p.proname
  `);
  for (const r of rows) {
    emit(`${r.definition};`);
    emitLine();
  }
}

// ── Triggers ────────────────────────────────────────────────
async function dumpTriggers(schema) {
  emit(`-- ============================================================`);
  emit(`-- Triggers: ${schema}`);
  emit(`-- ============================================================`);
  const rows = await q(`
    SELECT pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = '${schema}'
      AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `);
  for (const r of rows) {
    emit(`${r.definition};`);
  }
  emitLine();
}

// ── RLS policies ────────────────────────────────────────────
async function dumpRLS(schema) {
  emit(`-- ============================================================`);
  emit(`-- Row Level Security: ${schema}`);
  emit(`-- ============================================================`);

  // Enable RLS on tables that have it
  const rlsTables = await q(`
    SELECT relname
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = '${schema}'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
    ORDER BY relname
  `);
  for (const t of rlsTables) {
    emit(`ALTER TABLE ${schema}."${t.relname}" ENABLE ROW LEVEL SECURITY;`);
  }
  emitLine();

  // Force RLS for table owners
  const forceRls = await q(`
    SELECT relname
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = '${schema}'
      AND c.relkind = 'r'
      AND c.relforcerowsecurity = true
    ORDER BY relname
  `);
  for (const t of forceRls) {
    emit(`ALTER TABLE ${schema}."${t.relname}" FORCE ROW LEVEL SECURITY;`);
  }
  if (forceRls.length > 0) emitLine();

  // Policies
  const policies = await q(`
    SELECT
      schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = '${schema}'
    ORDER BY tablename, policyname
  `);
  for (const p of policies) {
    let sql = `CREATE POLICY "${p.policyname}" ON ${p.schemaname}."${p.tablename}"`;
    sql += ` AS ${p.permissive}`;
    sql += ` FOR ${p.cmd}`;
    // pg_policies.roles comes back as "{authenticated}" or "{public}" — strip braces
    let rolesStr = Array.isArray(p.roles) ? p.roles.join(', ') : String(p.roles);
    rolesStr = rolesStr.replace(/[{}]/g, '');
    sql += ` TO ${rolesStr}`;
    if (p.qual) sql += ` USING (${p.qual})`;
    if (p.with_check) sql += ` WITH CHECK (${p.with_check})`;
    sql += ';';
    emit(sql);
  }
  emitLine();
}

// ── Storage policies (only on objects/buckets) ──────────────
async function dumpStoragePolicies() {
  emit(`-- ============================================================`);
  emit(`-- Storage policies (custom — on storage.objects)`);
  emit(`-- ============================================================`);
  // Only dump policies on storage.objects (user-created policies)
  // storage.buckets, storage.migrations etc. have Supabase-managed RLS
  const policies = await q(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
    ORDER BY policyname
  `);
  for (const p of policies) {
    let sql = `CREATE POLICY "${p.policyname}" ON storage."objects"`;
    sql += ` AS ${p.permissive}`;
    sql += ` FOR ${p.cmd}`;
    let rolesStr = Array.isArray(p.roles) ? p.roles.join(', ') : String(p.roles);
    rolesStr = rolesStr.replace(/[{}]/g, '');
    sql += ` TO ${rolesStr}`;
    if (p.qual) sql += ` USING (${p.qual})`;
    if (p.with_check) sql += ` WITH CHECK (${p.with_check})`;
    sql += ';';
    emit(sql);
  }
  emitLine();
}

// ── Storage buckets (reference data) ────────────────────────
async function dumpStorageBuckets() {
  emit(`-- ============================================================`);
  emit(`-- Storage buckets`);
  emit(`-- ============================================================`);
  const rows = await q(`
    SELECT id, name, public, file_size_limit, allowed_mime_types, avif_autodetection
    FROM storage.buckets
    ORDER BY name
  `);
  for (const r of rows) {
    const mimeTypes = r.allowed_mime_types
      ? `ARRAY[${r.allowed_mime_types.map(m => `'${m}'`).join(', ')}]::text[]`
      : 'NULL';
    emit(`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)`);
    emit(`  VALUES ('${r.id}', '${r.name}', ${r.public}, ${r.file_size_limit || 'NULL'}, ${mimeTypes}, ${r.avif_autodetection || false})`);
    emit(`  ON CONFLICT (id) DO NOTHING;`);
  }
  emitLine();
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  await client.connect();
  console.error('Connected to database');

  emit('-- ==========================================================');
  emit('-- CRM LCA — Initial schema migration');
  emit('-- Generated from production database catalog');
  emit(`-- Date: ${new Date().toISOString()}`);
  emit('-- ==========================================================');
  emit('');
  emit('BEGIN;');
  emitLine();

  await dumpExtensions();
  await dumpEnums();
  await dumpTables('public');
  await dumpForeignKeys('public');
  await dumpIndexes('public');
  await dumpFunctions('public');
  await dumpTriggers('public');
  await dumpRLS('public');

  // Storage schema: tables are managed by Supabase — only dump custom policies + buckets
  await dumpStoragePolicies();
  await dumpStorageBuckets();

  emit('COMMIT;');

  await client.end();

  // Write to stdout
  console.log(out.join('\n'));
  console.error(`Done. ${out.length} lines generated.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
