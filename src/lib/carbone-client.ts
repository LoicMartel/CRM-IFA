/**
 * Client Carbone Cloud (génération .docx / conversion PDF).
 * Render : POST /render/{templateId} -> renderId, puis GET /render/{renderId} -> bytes.
 */
const BASE_URL = "https://api.carbone.io";

export class CarboneError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CarboneError";
  }
}

function apiKey(): string {
  const key = process.env.CARBONE_API_KEY;
  if (!key) throw new CarboneError("CARBONE_API_KEY manquant");
  return key;
}

/** Render générique d'un template Carbone (par id) avec data + format de sortie. */
async function renderTemplate(
  templateId: string,
  data: Record<string, unknown>,
  convertTo: "pdf" | "docx",
): Promise<Buffer> {
  const key = apiKey();
  const headers = { Authorization: `Bearer ${key}`, "carbone-version": "4", "Content-Type": "application/json" };
  const renderRes = await fetch(`${BASE_URL}/render/${templateId}`, {
    method: "POST", headers, body: JSON.stringify({ data, convertTo }),
  });
  if (!renderRes.ok) throw new CarboneError(`Carbone render failed: ${await renderRes.text()}`, renderRes.status);
  const json = (await renderRes.json()) as { success: boolean; data?: { renderId?: string }; error?: string };
  const renderId = json.data?.renderId;
  if (!json.success || !renderId) throw new CarboneError(`Carbone render error: ${json.error ?? "no renderId"}`);
  const fileRes = await fetch(`${BASE_URL}/render/${renderId}`, {
    headers: { Authorization: `Bearer ${key}`, "carbone-version": "4" },
  });
  if (!fileRes.ok) throw new CarboneError(`Carbone fetch failed: ${fileRes.status}`, fileRes.status);
  return Buffer.from(await fileRes.arrayBuffer());
}

/** Rend le template convention -> PDF. */
export async function renderConventionPdf(data: Record<string, unknown>): Promise<Buffer> {
  const templateId = process.env.CARBONE_CONVENTION_TEMPLATE_ID;
  if (!templateId) throw new CarboneError("CARBONE_CONVENTION_TEMPLATE_ID manquant");
  return renderTemplate(templateId, data, "pdf");
}

/** Rend le template devis -> .docx (éditable, round-trip Word). */
export async function renderDevisDocx(data: Record<string, unknown>): Promise<Buffer> {
  const templateId = process.env.CARBONE_DEVIS_TEMPLATE_ID;
  if (!templateId) throw new CarboneError("CARBONE_DEVIS_TEMPLATE_ID manquant");
  return renderTemplate(templateId, data, "docx");
}

/** Convertit un .docx arbitraire (édité) en PDF : upload comme template puis render. */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  if (!docx || docx.length === 0) throw new CarboneError("Devis .docx vide — conversion PDF impossible");
  const key = apiKey();
  const form = new FormData();
  form.append("template", new Blob([new Uint8Array(docx)]), "devis.docx");
  const upRes = await fetch(`${BASE_URL}/template`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "carbone-version": "4" },
    body: form,
  });
  if (!upRes.ok) throw new CarboneError(`Carbone template upload failed: ${await upRes.text()}`, upRes.status);
  const upJson = (await upRes.json()) as { success: boolean; data?: { templateId?: string }; error?: string };
  const templateId = upJson.data?.templateId;
  if (!upJson.success || !templateId) throw new CarboneError(`Carbone upload error: ${upJson.error ?? "no templateId"}`);
  return renderTemplate(templateId, {}, "pdf");
}
