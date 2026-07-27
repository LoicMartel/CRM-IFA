#!/usr/bin/env node
/**
 * Extract reference/seed data from production database.
 * Only reference tables — no business data (contacts, companies, deals, etc.)
 * Read-only: no writes to the database.
 */
import pg from 'pg';
const { Client } = pg;

// Usage: DB_HOST=db.<ref>.supabase.co DB_PASSWORD=<password> node scripts/extract-seed.mjs
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

function escapeVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (Array.isArray(v)) return `ARRAY[${v.map(i => `'${String(i).replace(/'/g, "''")}'`).join(', ')}]::text[]`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function dumpTable(tableName, comment) {
  const rows = await q(`SELECT * FROM public."${tableName}" ORDER BY 1`);
  if (rows.length === 0) return;

  emit(`-- ${comment || tableName}`);
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');

  for (const row of rows) {
    const vals = cols.map(c => escapeVal(row[c])).join(', ');
    emit(`INSERT INTO public."${tableName}" (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
  }
  emitLine();
}

async function main() {
  await client.connect();
  console.error('Connected to database');

  emit('-- ==========================================================');
  emit('-- CRM — Seed data (reference tables)');
  emit('-- These are default values for a new CRM installation.');
  emit('-- Customize as needed for each client.');
  emit(`-- Generated: ${new Date().toISOString()}`);
  emit('-- ==========================================================');
  emitLine();

  // ── Pure reference data (labels / categories) ──
  await dumpTable('company_types', 'Company type labels');
  await dumpTable('lead_sources', 'Lead source labels');
  await dumpTable('training_types', 'Training format types');
  await dumpTable('session_themes', 'Session theme labels');
  await dumpTable('expense_categories', 'Expense category labels');
  await dumpTable('lms_forum_categories', 'LMS forum categories');

  // ── Training programs (example — client should customize) ──
  await dumpTable('training_programs', 'Training programs (example data — customize per client)');

  // ── LMS parcours (example — client should customize) ──
  await dumpTable('lms_parcours', 'LMS learning paths (example data — customize per client)');

  // ── Automation workflows & steps (CRM business logic) ──
  await dumpTable('automation_workflows', 'Automation workflow definitions');
  await dumpTable('automation_steps', 'Automation workflow steps');

  // ── Nurture sequences & steps ──
  await dumpTable('nurture_sequences', 'Nurture email sequences');
  await dumpTable('nurture_steps', 'Nurture email sequence steps');

  // ── Quote number sequence (start at 1 for new clients) ──
  emit('-- Quote number sequence (reset for new client)');
  emit(`INSERT INTO public."quote_sequences" (year, last_number) VALUES (${new Date().getFullYear()}, 0) ON CONFLICT DO NOTHING;`);
  emitLine();

  await client.end();
  console.log(out.join('\n'));
  console.error(`Done. ${out.length} lines generated.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
