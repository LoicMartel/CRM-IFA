import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET: called from Webflow page — tracks + redirects to PDF
export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get("cid");

  if (cid) {
    await addDownloadNote(cid);
  }

  // Redirect to the PDF file
  const pdfUrl = `${req.nextUrl.origin}/book-financement-download.pdf`;
  return NextResponse.redirect(pdfUrl);
}

// POST: called from our own page via fetch
export async function POST(req: NextRequest) {
  try {
    const { contactId } = await req.json();
    if (!contactId) {
      return NextResponse.json({ error: "Missing contactId" }, { status: 400, headers: CORS_HEADERS });
    }
    await addDownloadNote(contactId);
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}

async function addDownloadNote(contactId: string) {
  const now = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Check if we already logged a download for this contact (avoid duplicates)
  const { data: existing } = await supabase
    .from("activities")
    .select("id")
    .eq("contact_id", contactId)
    .eq("type", "note")
    .ilike("title", "%Book gratuit téléchargé%")
    .limit(1);

  if (existing && existing.length > 0) return;

  // Add activity note
  await supabase.from("activities").insert({
    type: "note",
    title: "Book gratuit téléchargé",
    description: `Le contact a téléchargé le Book Financements gratuit (version offerte) le ${now}.`,
    contact_id: contactId,
    created_at: new Date().toISOString(),
  });

  // Also append to contact notes
  const { data: contact } = await supabase
    .from("contacts")
    .select("notes")
    .eq("id", contactId)
    .single();

  const existingNotes = contact?.notes || "";
  const downloadNote = `\n[${now}] Book Financements gratuit téléchargé`;

  if (!existingNotes.includes("Book Financements gratuit téléchargé")) {
    await supabase.from("contacts").update({
      notes: existingNotes + downloadNote,
    }).eq("id", contactId);
  }
}
