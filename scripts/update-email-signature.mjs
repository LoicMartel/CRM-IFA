#!/usr/bin/env node
import { readFileSync } from "fs";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const [teamMemberId, htmlPath] = process.argv.slice(2);

if (!teamMemberId || !htmlPath) {
  console.error("Usage: node scripts/update-email-signature.mjs <team_member_id> <path/to/signature.html>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Read HTML file
let html;
try {
  html = readFileSync(htmlPath, "utf-8");
} catch (err) {
  console.error(`Cannot read file: ${htmlPath}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Fetch current team member to show context
const { data: member, error: fetchErr } = await supabase
  .from("team_members")
  .select("first_name, last_name, email")
  .eq("id", teamMemberId)
  .single();

if (fetchErr || !member) {
  console.error(`Team member not found: ${teamMemberId}`);
  process.exit(1);
}

console.log("\n--- UPDATE PREVIEW ---");
console.log(`Member : ${member.first_name} ${member.last_name} (${member.email})`);
console.log(`ID     : ${teamMemberId}`);
console.log(`File   : ${htmlPath}`);
console.log(`HTML   : ${html.length} chars (first 120: ${html.slice(0, 120).replace(/\n/g, " ")}...)`);
console.log("----------------------\n");

// Interactive confirmation
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((resolve) => rl.question("Confirm update? (y/n) ", resolve));
rl.close();

if (answer.toLowerCase() !== "y") {
  console.log("Cancelled.");
  process.exit(0);
}

const { error: updateErr } = await supabase
  .from("team_members")
  .update({ email_signature: html })
  .eq("id", teamMemberId);

if (updateErr) {
  console.error("UPDATE failed:", updateErr.message);
  process.exit(1);
}

console.log(`Done — signature updated for ${member.first_name} ${member.last_name}.`);
