import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ImportItem {
  action: "create" | "update";
  existingId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  tel: string;
  companyId: string | null;
  position?: string;
}

export async function POST(request: Request) {
  const { rows } = (await request.json()) as { rows: ImportItem[] };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      if (row.action === "update" && row.existingId) {
        const { error } = await supabase.from("learners").update({
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email || null,
          phone: row.tel || null,
          company_id: row.companyId || null,
          position: row.position || null,
        }).eq("id", row.existingId);

        if (error) {
          errors.push(`Update ${row.firstName} ${row.lastName}: ${error.message}`);
        } else {
          updated++;
        }
      } else if (row.action === "create") {
        const { error } = await supabase.from("learners").insert({
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email || null,
          phone: row.tel || null,
          company_id: row.companyId || null,
          position: row.position || null,
          status: "actuel",
        });

        if (error) {
          errors.push(`Create ${row.firstName} ${row.lastName}: ${error.message}`);
        } else {
          created++;
        }
      }
    } catch (e: any) {
      errors.push(`${row.firstName} ${row.lastName}: ${e.message}`);
    }
  }

  return NextResponse.json({ created, updated, errors });
}
